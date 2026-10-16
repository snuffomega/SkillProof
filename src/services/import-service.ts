import { setFrontmatterField } from '@/domain/skill-markdown';
import type { ParsedBundle } from '@/domain/bundle';
import type { SkillCandidate } from '@/domain/importers';
import type { Skill, SkillSourceKind } from '@/domain/types';
import type { SkillProofRepository } from '@/data/repository';

export type DuplicateStrategy = 'skip' | 'overwrite' | 'copy';

export interface ImportableSkill extends SkillCandidate {
  tags?: string[];
  folder?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  reused: number;
  idsByKey: Map<string, string>;
}

function uniqueName(base: string, taken: Set<string>) {
  let i = 2;
  let name = `${base}-copy`;
  while (taken.has(name)) name = `${base}-copy-${i++}`;
  return name;
}

export async function importSkills(
  repo: SkillProofRepository,
  candidates: ImportableSkill[],
  strategy: DuplicateStrategy,
  source: { kind: SkillSourceKind; ref?: string },
): Promise<ImportResult> {
  const existing = await repo.listSkills();
  const byName = new Map<string, Skill>(existing.filter((s) => s.name).map((s) => [s.name, s]));
  const taken = new Set(byName.keys());
  const result: ImportResult = { created: 0, updated: 0, reused: 0, idsByKey: new Map() };

  for (const c of candidates) {
    const dup = c.name ? byName.get(c.name) : undefined;
    if (dup && strategy === 'skip') {
      result.reused++;
      result.idsByKey.set(c.key, dup.id);
      continue;
    }
    if (dup && strategy === 'overwrite') {
      await repo.updateSkill(dup.id, { content: c.content, files: c.files });
      result.updated++;
      result.idsByKey.set(c.key, dup.id);
      continue;
    }
    let content = c.content;
    if (dup) {
      const name = uniqueName(c.name, taken);
      content = setFrontmatterField(content, 'name', name);
      taken.add(name);
    } else if (c.name) taken.add(c.name);
    const created = await repo.createSkill({ content, files: c.files, tags: c.tags ?? [], folder: c.folder ?? '', source });
    result.created++;
    result.idsByKey.set(c.key, created.id);
  }
  return result;
}

export async function importBundle(repo: SkillProofRepository, bundle: ParsedBundle, strategy: DuplicateStrategy) {
  const { manifest } = bundle;
  const skillResult = await importSkills(
    repo,
    bundle.skills.map((s) => ({ ...s, key: s.dir })),
    strategy,
    { kind: 'bundle', ref: manifest.stack.name },
  );
  const stackNames = new Set((await repo.listStacks()).map((s) => s.name));
  let name = manifest.stack.name;
  if (stackNames.has(name)) name = `${name} (imported)`;
  const stack = await repo.createStack({
    name,
    description: manifest.stack.description,
    nodes: manifest.stack.nodes.map((n) => ({ id: n.id, skillId: skillResult.idsByKey.get(n.skill)!, role: n.role, position: n.position })),
    edges: manifest.stack.edges,
    contract: manifest.stack.contract,
  });
  return { stackId: stack.id, skillsCreated: skillResult.created, skillsUpdated: skillResult.updated, skillsReused: skillResult.reused };
}
