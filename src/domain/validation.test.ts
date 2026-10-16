import { describe, expect, it } from 'vitest';
import { validateSkill, validateStack } from './validation';
import { autoLayout, findCycles } from './graph';
import { emptyContract, type Skill, type Stack } from './types';

const skill = (id: string, content: string, files: Skill['files'] = []): Skill => ({
  id,
  name: content.match(/name: (.+)/)?.[1] ?? '',
  description: '',
  content,
  files,
  tags: [],
  folder: '',
  source: { kind: 'manual' },
  createdAt: 0,
  updatedAt: 0,
  publishedVersion: null,
  publishedHash: null,
});

const valid = (name: string, body = '# Title\n\nDo the thing.') =>
  `---\nname: ${name}\ndescription: A sufficiently descriptive explanation of when to use ${name}.\n---\n\n${body}\n`;

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe('validateSkill', () => {
  const ctx = { skillNames: new Set(['alpha', 'beta']) };

  it('passes a well-formed skill', () => {
    expect(validateSkill(skill('1', valid('alpha')), ctx).filter((i) => i.severity !== 'info')).toEqual([]);
  });

  it('flags missing frontmatter', () => {
    expect(codes(validateSkill(skill('1', '# Hi'), ctx))).toContain('FM_MISSING');
  });

  it('enforces name format and description presence', () => {
    const c = codes(validateSkill(skill('1', '---\nname: Bad_Name\n---\n# x'), ctx));
    expect(c).toContain('NAME_FORMAT');
    expect(c).toContain('DESC_MISSING');
  });

  it('detects broken file and skill links', () => {
    const body = '# T\n[ok](refs/a.md) [missing](refs/b.md) [peer](../beta/SKILL.md) [ghost](../gamma/SKILL.md) [web](https://x.dev)';
    const issues = validateSkill(skill('1', valid('alpha', body), [{ path: 'refs/a.md', content: '' }]), ctx);
    expect(issues.filter((i) => i.code === 'LINK_FILE_BROKEN')).toHaveLength(1);
    expect(issues.filter((i) => i.code === 'LINK_SKILL_BROKEN')).toHaveLength(1);
    expect(issues.find((i) => i.code === 'LINK_SKILL_BROKEN')!.message).toContain('gamma');
  });

  it('notes unreferenced attached files', () => {
    expect(codes(validateSkill(skill('1', valid('alpha'), [{ path: 'notes.txt', content: '' }]), ctx))).toContain('FILE_UNREFERENCED');
  });
});

describe('graph', () => {
  it('finds dependency cycles', () => {
    const cycles = findCycles(['a', 'b', 'c', 'd'], [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
      { source: 'c', target: 'd' },
    ]);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0])).toEqual(new Set(['a', 'b', 'c']));
  });

  it('lays out prerequisites before dependents', () => {
    const nodes = ['a', 'b'].map((id) => ({ id, skillId: id, role: '', position: { x: 0, y: 0 } }));
    const laid = autoLayout(nodes, [{ id: 'e', source: 'a', target: 'b', kind: 'depends', label: '', notes: '', detail: '' }]);
    expect(laid.find((n) => n.id === 'b')!.position.x).toBeLessThan(laid.find((n) => n.id === 'a')!.position.x);
  });
});

describe('validateStack', () => {
  const a = skill('sa', valid('alpha'));
  const b = skill('sb', valid('beta'));
  const ctx = { skillNames: new Set(['alpha', 'beta']), skillsById: new Map([[a.id, a], [b.id, b]]) };
  const base = (): Stack => ({
    id: 'st',
    name: 'S',
    description: '',
    nodes: [
      { id: 'n1', skillId: 'sa', role: '', position: { x: 0, y: 0 } },
      { id: 'n2', skillId: 'sb', role: '', position: { x: 0, y: 0 } },
    ],
    edges: [],
    contract: { ...emptyContract(), goals: [{ id: 'g', text: 'Goal' }] },
    createdAt: 0,
    updatedAt: 0,
    publishedVersion: null,
    publishedHash: null,
  });

  it('flags unresolved conflicts and cycles', () => {
    const s = base();
    s.edges = [
      { id: 'e1', source: 'n1', target: 'n2', kind: 'depends', label: '', notes: '', detail: '' },
      { id: 'e2', source: 'n2', target: 'n1', kind: 'depends', label: '', notes: '', detail: '' },
      { id: 'e3', source: 'n1', target: 'n2', kind: 'conflict', label: '', notes: '', detail: '' },
    ];
    const c = codes(validateStack(s, ctx));
    expect(c).toContain('DEP_CYCLE');
    expect(c).toContain('CONFLICT_UNRESOLVED');
  });

  it('accepts a resolved conflict', () => {
    const s = base();
    s.edges = [{ id: 'e3', source: 'n1', target: 'n2', kind: 'conflict', label: '', notes: '', detail: 'Beta wins in production code' }];
    expect(codes(validateStack(s, ctx))).not.toContain('CONFLICT_UNRESOLVED');
  });

  it('requires every output to have a producer in the stack', () => {
    const s = base();
    s.contract.outputs = [
      { id: 'o1', name: 'Report', description: '', producedBy: null },
      { id: 'o2', name: 'Other', description: '', producedBy: 'gone' },
    ];
    const c = codes(validateStack(s, ctx));
    expect(c).toContain('OUTPUT_NO_PRODUCER');
    expect(c).toContain('OUTPUT_PRODUCER_MISSING');
  });

  it('reports nodes whose skill was deleted', () => {
    const s = base();
    s.nodes.push({ id: 'n3', skillId: 'missing', role: '', position: { x: 0, y: 0 } });
    expect(codes(validateStack(s, ctx))).toContain('NODE_MISSING_SKILL');
  });
});
