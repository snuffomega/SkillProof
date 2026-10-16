import { diffLines } from 'diff';
import { hashString } from '@/lib/id';
import type { Contract, PublishStatus, Skill, SkillFile, Stack, StackEdge, StackNode } from './types';
import { RELATION_META } from './types';

export function skillHash(content: string, files: SkillFile[]): string {
  return hashString(content + '\u0000' + JSON.stringify([...files].sort((a, b) => a.path.localeCompare(b.path))));
}

/** Layout positions are intentionally excluded: moving nodes is not a semantic change. */
export function stackHash(s: { name: string; description: string; nodes: StackNode[]; edges: StackEdge[]; contract: Contract }): string {
  return hashString(
    JSON.stringify({
      name: s.name,
      description: s.description,
      nodes: s.nodes.map((n) => [n.id, n.skillId, n.role]),
      edges: s.edges.map((e) => [e.id, e.source, e.target, e.kind, e.label, e.notes, e.detail]),
      contract: s.contract,
    }),
  );
}

export function publishStatus(publishedVersion: number | null, publishedHash: string | null, currentHash: string): PublishStatus {
  if (publishedVersion === null) return 'draft';
  return publishedHash === currentHash ? 'published' : 'modified';
}

export function skillStatus(s: Pick<Skill, 'publishedVersion' | 'publishedHash' | 'content' | 'files'>): PublishStatus {
  return publishStatus(s.publishedVersion, s.publishedHash, skillHash(s.content, s.files));
}

export function stackStatus(s: Stack): PublishStatus {
  return publishStatus(s.publishedVersion, s.publishedHash, stackHash(s));
}

export interface DiffRow {
  type: 'add' | 'remove' | 'same';
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export function diffText(before: string, after: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let o = 1;
  let n = 1;
  for (const part of diffLines(before, after)) {
    const lines = part.value.replace(/\n$/, '').split('\n');
    for (const text of lines) {
      if (part.added) rows.push({ type: 'add', text, oldLine: null, newLine: n++ });
      else if (part.removed) rows.push({ type: 'remove', text, oldLine: o++, newLine: null });
      else rows.push({ type: 'same', text, oldLine: o++, newLine: n++ });
    }
  }
  return rows;
}

export function diffStats(rows: DiffRow[]) {
  return { added: rows.filter((r) => r.type === 'add').length, removed: rows.filter((r) => r.type === 'remove').length };
}

/** Collapse long unchanged runs, keeping `context` lines around each change. */
export function collapseDiff(rows: DiffRow[], context = 3): (DiffRow | { type: 'gap'; count: number })[] {
  const keep = new Array(rows.length).fill(false);
  rows.forEach((r, i) => {
    if (r.type !== 'same') for (let j = Math.max(0, i - context); j <= Math.min(rows.length - 1, i + context); j++) keep[j] = true;
  });
  const out: (DiffRow | { type: 'gap'; count: number })[] = [];
  let gap = 0;
  rows.forEach((r, i) => {
    if (keep[i]) {
      if (gap) out.push({ type: 'gap', count: gap });
      gap = 0;
      out.push(r);
    } else gap++;
  });
  if (gap) out.push({ type: 'gap', count: gap });
  return out;
}

export interface StackShape {
  nodes: StackNode[];
  edges: StackEdge[];
  contract: Contract;
}

export interface StackChange {
  type: 'added' | 'removed' | 'changed';
  area: 'skill' | 'connection' | 'contract';
  text: string;
}

export function diffStacks(before: StackShape, after: StackShape, skillName: (skillId: string) => string): StackChange[] {
  const changes: StackChange[] = [];
  const nodeLabel = (s: StackShape, nodeId: string) => {
    const node = s.nodes.find((n) => n.id === nodeId);
    return node ? skillName(node.skillId) : 'removed node';
  };
  const beforeSkills = new Map(before.nodes.map((n) => [n.skillId, n]));
  const afterSkills = new Map(after.nodes.map((n) => [n.skillId, n]));
  afterSkills.forEach((n, id) => {
    const prev = beforeSkills.get(id);
    if (!prev) changes.push({ type: 'added', area: 'skill', text: skillName(id) });
    else if (prev.role !== n.role) changes.push({ type: 'changed', area: 'skill', text: `${skillName(id)} role: "${prev.role || '—'}" → "${n.role || '—'}"` });
  });
  beforeSkills.forEach((_, id) => {
    if (!afterSkills.has(id)) changes.push({ type: 'removed', area: 'skill', text: skillName(id) });
  });

  const edgeKey = (s: StackShape, e: StackEdge) => `${nodeLabel(s, e.source)}|${e.kind}|${nodeLabel(s, e.target)}`;
  const edgeText = (s: StackShape, e: StackEdge) => `${nodeLabel(s, e.source)} ${RELATION_META[e.kind].verb} ${nodeLabel(s, e.target)}`;
  const be = new Map(before.edges.map((e) => [edgeKey(before, e), e]));
  const ae = new Map(after.edges.map((e) => [edgeKey(after, e), e]));
  ae.forEach((e, k) => {
    const prev = be.get(k);
    if (!prev) changes.push({ type: 'added', area: 'connection', text: edgeText(after, e) });
    else if (prev.label !== e.label || prev.detail !== e.detail || prev.notes !== e.notes)
      changes.push({ type: 'changed', area: 'connection', text: `${edgeText(after, e)} (details edited)` });
  });
  be.forEach((e, k) => {
    if (!ae.has(k)) changes.push({ type: 'removed', area: 'connection', text: edgeText(before, e) });
  });

  const sections: [keyof Contract, string][] = [
    ['goals', 'Goal'],
    ['expectations', 'Expectation'],
    ['standards', 'Quality standard'],
  ];
  for (const [key, label] of sections) {
    const b = new Set((before.contract[key] as { text: string }[]).map((i) => i.text.trim()).filter(Boolean));
    const a = new Set((after.contract[key] as { text: string }[]).map((i) => i.text.trim()).filter(Boolean));
    a.forEach((t) => !b.has(t) && changes.push({ type: 'added', area: 'contract', text: `${label}: ${t}` }));
    b.forEach((t) => !a.has(t) && changes.push({ type: 'removed', area: 'contract', text: `${label}: ${t}` }));
  }
  const bo = new Set(before.contract.outputs.map((o) => o.name));
  const ao = new Set(after.contract.outputs.map((o) => o.name));
  ao.forEach((t) => !bo.has(t) && changes.push({ type: 'added', area: 'contract', text: `Required output: ${t}` }));
  bo.forEach((t) => !ao.has(t) && changes.push({ type: 'removed', area: 'contract', text: `Required output: ${t}` }));
  const bc = new Set(before.contract.checkpoints.map((o) => o.title));
  const ac = new Set(after.contract.checkpoints.map((o) => o.title));
  ac.forEach((t) => !bc.has(t) && changes.push({ type: 'added', area: 'contract', text: `Checkpoint: ${t}` }));
  bc.forEach((t) => !ac.has(t) && changes.push({ type: 'removed', area: 'contract', text: `Checkpoint: ${t}` }));
  return changes;
}
