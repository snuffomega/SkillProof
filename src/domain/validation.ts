import { extractHeadings, extractLinks, parseSkillMarkdown } from './skill-markdown';
import { findCycles } from './graph';
import type { Issue, Severity, Skill, Stack } from './types';
import { RELATION_META } from './types';

export const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KNOWN_FIELDS = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);
const MAX_BODY_LINES = 500;

export interface SkillValidationContext {
  /** Names of every skill in the library, used to resolve cross-skill links. */
  skillNames: Set<string>;
}

type SkillLike = Pick<Skill, 'id' | 'content' | 'files'>;

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const seg of path.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length && parts[parts.length - 1] !== '..') parts.pop();
      else parts.push('..');
    } else parts.push(seg);
  }
  return parts.join('/');
}

function isExternal(href: string) {
  return /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href);
}

export function validateSkill(skill: SkillLike, ctx: SkillValidationContext): Issue[] {
  const issues: Issue[] = [];
  const target = { type: 'skill' as const, skillId: skill.id };
  const add = (code: string, severity: Severity, message: string) =>
    issues.push({ id: `${skill.id}:${code}:${issues.length}`, code, severity, message, target });

  const parsed = parseSkillMarkdown(skill.content);
  if (!parsed.hasFrontmatter) {
    add('FM_MISSING', 'error', 'Missing YAML frontmatter. SKILL.md must start with a --- block containing name and description.');
  } else if (parsed.frontmatterError) {
    add('FM_INVALID', 'error', `Frontmatter is not valid YAML: ${parsed.frontmatterError}`);
  }

  const fm = parsed.frontmatter;
  if (parsed.hasFrontmatter && !parsed.frontmatterError) {
    const name = fm.name;
    if (typeof name !== 'string' || !name.trim()) add('NAME_MISSING', 'error', 'Frontmatter is missing a "name".');
    else {
      if (name.length > 64) add('NAME_LENGTH', 'error', `Name is ${name.length} characters; the limit is 64.`);
      if (!NAME_PATTERN.test(name)) add('NAME_FORMAT', 'error', `Name "${name}" must use lowercase letters, numbers and single hyphens.`);
    }
    const desc = fm.description;
    if (typeof desc !== 'string' || !desc.trim()) add('DESC_MISSING', 'error', 'Frontmatter is missing a "description". Agents use it to decide when to load the skill.');
    else if (desc.length > 1024) add('DESC_LENGTH', 'error', `Description is ${desc.length} characters; the limit is 1024.`);
    else if (desc.trim().length < 40) add('DESC_SHORT', 'warning', 'Description is very short. Say what the skill does and when it should be used.');
    Object.keys(fm)
      .filter((k) => !KNOWN_FIELDS.has(k))
      .forEach((k) => add('FM_UNKNOWN', 'info', `Unrecognized frontmatter field "${k}". Agents may ignore it; consider moving it under "metadata".`));
  }

  const body = parsed.body.trim();
  if (!body) add('BODY_EMPTY', 'error', 'The skill has no instructions below the frontmatter.');
  else {
    const lines = parsed.body.split('\n').length;
    if (lines > MAX_BODY_LINES) add('BODY_LONG', 'warning', `Body is ${lines} lines. Move detail into reference files to keep it under ${MAX_BODY_LINES}.`);
    if (!extractHeadings(body).length) add('NO_HEADINGS', 'info', 'No headings found. Sections make expectations easier for agents to scan.');
  }

  const filePaths = new Set(skill.files.map((f) => normalizePath(f.path)));
  const referenced = new Set<string>();
  for (const link of extractLinks(parsed.body, parsed.bodyLine)) {
    if (isExternal(link.href)) continue;
    const href = normalizePath(decodeURIComponent(link.href.split('#')[0]));
    if (!href) continue;
    const skillRef = href.match(/^\.\.\/([^/]+)\/SKILL\.md$/i);
    if (skillRef) {
      if (!ctx.skillNames.has(skillRef[1])) add('LINK_SKILL_BROKEN', 'error', `Line ${link.line}: links to skill "${skillRef[1]}", which is not in the library.`);
      continue;
    }
    referenced.add(href);
    if (!filePaths.has(href)) add('LINK_FILE_BROKEN', 'error', `Line ${link.line}: references "${href}", but no such file is attached.`);
  }
  skill.files
    .filter((f) => !referenced.has(normalizePath(f.path)) && !parsed.body.includes(f.path))
    .forEach((f) => add('FILE_UNREFERENCED', 'info', `Attached file "${f.path}" is never referenced from the instructions.`));

  return issues;
}

export interface StackValidationContext extends SkillValidationContext {
  skillsById: Map<string, Skill>;
}

export function validateStack(stack: Stack, ctx: StackValidationContext): Issue[] {
  const issues: Issue[] = [];
  let n = 0;
  const push = (i: Omit<Issue, 'id'>) => issues.push({ ...i, id: `${stack.id}:${i.code}:${n++}` });
  const nodeIds = new Set(stack.nodes.map((x) => x.id));
  const nodeName = (id: string) => {
    const node = stack.nodes.find((x) => x.id === id);
    return (node && ctx.skillsById.get(node.skillId)?.name) || 'unknown node';
  };

  if (!stack.nodes.length) push({ code: 'STACK_EMPTY', severity: 'warning', message: 'This stack has no skills yet.', target: { type: 'contract', section: 'goals' } });

  const seenSkills = new Map<string, string>();
  const connected = new Set<string>();
  stack.edges.forEach((e) => {
    connected.add(e.source);
    connected.add(e.target);
  });

  for (const node of stack.nodes) {
    const skill = ctx.skillsById.get(node.skillId);
    const target = { type: 'node' as const, nodeId: node.id, skillId: node.skillId };
    if (!skill) {
      push({ code: 'NODE_MISSING_SKILL', severity: 'error', message: 'A node references a skill that no longer exists in the library.', target });
      continue;
    }
    if (seenSkills.has(skill.id)) push({ code: 'NODE_DUPLICATE', severity: 'warning', message: `"${skill.name}" appears more than once in this stack.`, target });
    seenSkills.set(skill.id, node.id);
    if (stack.nodes.length > 1 && !connected.has(node.id))
      push({ code: 'NODE_ISOLATED', severity: 'info', message: `"${skill.name}" is not connected to any other skill.`, target });
    validateSkill(skill, ctx)
      .filter((i) => i.severity !== 'info')
      .forEach((i) => push({ code: i.code, severity: i.severity, message: `${skill.name}: ${i.message}`, target }));
  }

  const edgeKeys = new Set<string>();
  for (const e of stack.edges) {
    const target = { type: 'edge' as const, edgeId: e.id };
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      push({ code: 'EDGE_DANGLING', severity: 'error', message: 'A connection points to a skill that was removed from the stack.', target });
      continue;
    }
    if (e.source === e.target) push({ code: 'EDGE_SELF', severity: 'error', message: `"${nodeName(e.source)}" is connected to itself.`, target });
    const key = `${e.kind}:${e.source}:${e.target}`;
    if (edgeKeys.has(key)) push({ code: 'EDGE_DUPLICATE', severity: 'warning', message: `Duplicate "${RELATION_META[e.kind].label}" connection between ${nodeName(e.source)} and ${nodeName(e.target)}.`, target });
    edgeKeys.add(key);
    const pair = `${nodeName(e.source)} → ${nodeName(e.target)}`;
    if (e.kind === 'conflict' && !e.detail.trim())
      push({ code: 'CONFLICT_UNRESOLVED', severity: 'error', message: `Conflict ${pair} has no resolution rule. Agents will receive contradictory instructions.`, target });
    if (e.kind === 'handoff' && !e.detail.trim())
      push({ code: 'HANDOFF_NO_ARTIFACT', severity: 'warning', message: `Handoff ${pair} does not name the artifact being passed.`, target });
    if (e.kind === 'policy' && !e.label.trim())
      push({ code: 'POLICY_UNNAMED', severity: 'info', message: `Shared policy ${pair} has no name.`, target });
  }

  const deps = stack.edges.filter((e) => e.kind === 'depends' && e.source !== e.target);
  for (const cycle of findCycles(stack.nodes.map((x) => x.id), deps)) {
    const edge = deps.find((e) => cycle.includes(e.source) && cycle.includes(e.target))!;
    push({ code: 'DEP_CYCLE', severity: 'error', message: `Circular dependency: ${cycle.map(nodeName).join(' → ')} → ${nodeName(cycle[0])}.`, target: { type: 'edge', edgeId: edge.id } });
  }

  const c = stack.contract;
  if (!c.goals.some((g) => g.text.trim())) push({ code: 'CONTRACT_NO_GOALS', severity: 'warning', message: 'The workflow contract has no goals.', target: { type: 'contract', section: 'goals' } });
  if (!c.outputs.length) push({ code: 'CONTRACT_NO_OUTPUTS', severity: 'info', message: 'No required outputs are defined, so there is no clear definition of done.', target: { type: 'contract', section: 'outputs' } });
  for (const o of c.outputs) {
    const target = { type: 'contract' as const, section: 'outputs' as const, itemId: o.id };
    if (!o.producedBy) push({ code: 'OUTPUT_NO_PRODUCER', severity: 'error', message: `Required output "${o.name || 'Untitled'}" is not assigned to any skill.`, target });
    else if (!nodeIds.has(o.producedBy)) push({ code: 'OUTPUT_PRODUCER_MISSING', severity: 'error', message: `Required output "${o.name || 'Untitled'}" is assigned to a skill no longer in the stack.`, target });
  }
  for (const cp of c.checkpoints) {
    if (cp.afterNodeId && !nodeIds.has(cp.afterNodeId))
      push({ code: 'CHECKPOINT_NODE_MISSING', severity: 'error', message: `Checkpoint "${cp.title || 'Untitled'}" follows a skill that is no longer in the stack.`, target: { type: 'contract', section: 'checkpoints', itemId: cp.id } });
    if (!cp.approver.trim())
      push({ code: 'CHECKPOINT_NO_APPROVER', severity: 'warning', message: `Checkpoint "${cp.title || 'Untitled'}" has no approver.`, target: { type: 'contract', section: 'checkpoints', itemId: cp.id } });
  }

  return issues;
}

export function summarize(issues: Issue[]) {
  return {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length,
  };
}
