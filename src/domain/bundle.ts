import JSZip from 'jszip';
import { z } from 'zod';
import { slugify } from '@/lib/id';
import { groupFilesIntoSkills, isIgnoredPath, isTextPath, MAX_TEXT_FILE_BYTES, type ImportedFile, type SkillCandidate } from './importers';
import type { Skill, Stack } from './types';

export const MANIFEST_FILE = 'skillproof.json';
export const BUNDLE_FORMAT = 'skillproof.stack';

const itemSchema = z.object({ id: z.string(), text: z.string() });
const manifestSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  stack: z.object({
    name: z.string().min(1),
    description: z.string(),
    nodes: z.array(
      z.object({
        id: z.string(),
        skill: z.string(),
        role: z.string().default(''),
        position: z.object({ x: z.number(), y: z.number() }),
      }),
    ),
    edges: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        kind: z.enum(['depends', 'handoff', 'policy', 'conflict']),
        label: z.string().default(''),
        notes: z.string().default(''),
        detail: z.string().default(''),
      }),
    ),
    contract: z.object({
      goals: z.array(itemSchema),
      expectations: z.array(itemSchema),
      standards: z.array(itemSchema),
      checkpoints: z.array(z.object({ id: z.string(), title: z.string(), afterNodeId: z.string().nullable(), approver: z.string() })),
      outputs: z.array(z.object({ id: z.string(), name: z.string(), description: z.string(), producedBy: z.string().nullable() })),
    }),
  }),
  skills: z.array(
    z.object({
      dir: z.string(),
      name: z.string(),
      tags: z.array(z.string()).default([]),
      folder: z.string().default(''),
    }),
  ),
});

export type StackManifest = z.infer<typeof manifestSchema>;

function uniqueDirs(skills: Skill[]): Map<string, string> {
  const used = new Set<string>();
  const dirs = new Map<string, string>();
  for (const s of skills) {
    const base = slugify(s.name) || 'skill';
    let dir = base;
    let i = 2;
    while (used.has(dir)) dir = `${base}-${i++}`;
    used.add(dir);
    dirs.set(s.id, dir);
  }
  return dirs;
}

export function buildManifest(stack: Stack, skills: Skill[], now = new Date(), dirs = uniqueDirs(skills)): StackManifest {
  return {
    format: BUNDLE_FORMAT,
    formatVersion: 1,
    exportedAt: now.toISOString(),
    stack: {
      name: stack.name,
      description: stack.description,
      nodes: stack.nodes
        .filter((n) => dirs.has(n.skillId))
        .map((n) => ({ id: n.id, skill: dirs.get(n.skillId)!, role: n.role, position: n.position })),
      edges: stack.edges,
      contract: stack.contract,
    },
    skills: skills.map((s) => ({ dir: dirs.get(s.id)!, name: s.name, tags: s.tags, folder: s.folder })),
  };
}

function bundleReadme(stack: Stack, manifest: StackManifest) {
  const goals = stack.contract.goals.map((g) => `- ${g.text}`).join('\n') || '- (none)';
  const outputs = stack.contract.outputs.map((o) => `- **${o.name}** — ${o.description}`).join('\n') || '- (none)';
  return `# ${stack.name}\n\n${stack.description}\n\nExported from SkillProof on ${manifest.exportedAt}.\n\n## Goals\n${goals}\n\n## Required outputs\n${outputs}\n\n## Skills\n${manifest.skills
    .map((s) => `- [${s.name}](skills/${s.dir}/SKILL.md)`)
    .join('\n')}\n\nRelationships and the workflow contract are stored in \`${MANIFEST_FILE}\`. Each folder under \`skills/\` is a standalone Agent Skill.\n`;
}

export async function exportStackBundle(stack: Stack, skills: Skill[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const dirs = uniqueDirs(skills);
  const manifest = buildManifest(stack, skills, new Date(), dirs);
  zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  zip.file('README.md', bundleReadme(stack, manifest));
  for (const s of skills) {
    const dir = dirs.get(s.id)!;
    zip.file(`skills/${dir}/SKILL.md`, s.content);
    s.files.forEach((f) => zip.file(`skills/${dir}/${f.path}`, f.content));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function exportSkillsZip(skills: Skill[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const dirs = uniqueDirs(skills);
  for (const s of skills) {
    const dir = dirs.get(s.id)!;
    zip.file(`${dir}/SKILL.md`, s.content);
    s.files.forEach((f) => zip.file(`${dir}/${f.path}`, f.content));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function readZip(data: ArrayBuffer | Uint8Array): Promise<{ files: ImportedFile[]; skipped: string[] }> {
  const zip = await JSZip.loadAsync(data);
  const files: ImportedFile[] = [];
  const skipped: string[] = [];
  const entries = Object.values(zip.files).filter((e) => !e.dir && !isIgnoredPath(e.name));
  for (const entry of entries) {
    if (!isTextPath(entry.name)) {
      skipped.push(entry.name);
      continue;
    }
    const content = await entry.async('string');
    if (content.length > MAX_TEXT_FILE_BYTES) {
      skipped.push(entry.name);
      continue;
    }
    files.push({ path: entry.name, content });
  }
  return { files, skipped };
}

export interface ParsedBundle {
  manifest: StackManifest;
  skills: (SkillCandidate & { dir: string; tags: string[]; folder: string })[];
}

/** Returns null when the files are not a SkillProof bundle; throws when the manifest is malformed. */
export function parseStackBundle(files: ImportedFile[]): ParsedBundle | null {
  const manifestFile = files.find((f) => f.path === MANIFEST_FILE || f.path.endsWith('/' + MANIFEST_FILE));
  if (!manifestFile) return null;
  const prefix = manifestFile.path.slice(0, manifestFile.path.length - MANIFEST_FILE.length);
  let raw: unknown;
  try {
    raw = JSON.parse(manifestFile.content);
  } catch {
    throw new Error('skillproof.json is not valid JSON.');
  }
  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`skillproof.json is invalid at "${first.path.join('.')}": ${first.message}`);
  }
  const manifest = result.data;
  const relative = files
    .filter((f) => f.path.startsWith(prefix + 'skills/'))
    .map((f) => ({ ...f, path: f.path.slice(prefix.length + 'skills/'.length) }));
  const candidates = groupFilesIntoSkills(relative);
  const skills = manifest.skills.map((m) => {
    const c = candidates.find((x) => x.key === m.dir);
    if (!c) throw new Error(`Bundle is missing skills/${m.dir}/SKILL.md.`);
    return { ...c, dir: m.dir, tags: m.tags, folder: m.folder };
  });
  const dirs = new Set(manifest.skills.map((s) => s.dir));
  const orphan = manifest.stack.nodes.find((n) => !dirs.has(n.skill));
  if (orphan) throw new Error(`Stack node refers to unknown skill folder "${orphan.skill}".`);
  return { manifest, skills };
}
