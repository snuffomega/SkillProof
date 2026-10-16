import { describe, expect, it } from 'vitest';
import { exportStackBundle, parseStackBundle, readZip } from './bundle';
import { groupFilesIntoSkills, parseGitHubUrl } from './importers';
import { collapseDiff, diffStacks, diffText, stackHash } from './versioning';
import { outcomeFor, simulateCriteria } from './evaluation';
import { emptyContract, type Skill, type Stack } from './types';

describe('groupFilesIntoSkills', () => {
  it('assigns resources to the nearest skill folder', () => {
    const c = groupFilesIntoSkills([
      { path: 'repo/skills/a/SKILL.md', content: '---\nname: a\ndescription: d\n---\n' },
      { path: 'repo/skills/a/references/x.md', content: 'x' },
      { path: 'repo/skills/a/nested/SKILL.md', content: '---\nname: nested\ndescription: d\n---\n' },
      { path: 'repo/skills/a/nested/y.md', content: 'y' },
      { path: 'repo/.git/config', content: '' },
    ]);
    expect(c.map((s) => s.name).sort()).toEqual(['a', 'nested']);
    expect(c.find((s) => s.name === 'a')!.files.map((f) => f.path)).toEqual(['references/x.md']);
    expect(c.find((s) => s.name === 'nested')!.files.map((f) => f.path)).toEqual(['y.md']);
  });

  it('treats loose markdown as skills when no SKILL.md exists', () => {
    const c = groupFilesIntoSkills([{ path: 'review.md', content: '# Review' }]);
    expect(c[0].name).toBe('review');
  });
});

describe('parseGitHubUrl', () => {
  it('handles repo, tree and shorthand forms', () => {
    expect(parseGitHubUrl('https://github.com/acme/skills')).toEqual({ owner: 'acme', repo: 'skills', ref: null, path: '' });
    expect(parseGitHubUrl('https://github.com/acme/skills/tree/main/pdf')).toEqual({ owner: 'acme', repo: 'skills', ref: 'main', path: 'pdf' });
    expect(parseGitHubUrl('acme/skills')?.repo).toBe('skills');
    expect(parseGitHubUrl('https://gitlab.com/a/b')).toBeNull();
  });
});

const mkSkill = (id: string, name: string): Skill => ({
  id,
  name,
  description: 'desc',
  content: `---\nname: ${name}\ndescription: desc\n---\n\n# ${name}\n`,
  files: [{ path: 'references/info.md', content: `about ${name}` }],
  tags: ['t'],
  folder: 'F',
  source: { kind: 'manual' },
  createdAt: 0,
  updatedAt: 0,
  publishedVersion: null,
  publishedHash: null,
});

describe('stack bundle', () => {
  it('round-trips skills, files, relationships and contract', async () => {
    const skills = [mkSkill('s1', 'alpha'), mkSkill('s2', 'beta')];
    const stack: Stack = {
      id: 'st',
      name: 'Demo',
      description: 'd',
      nodes: [
        { id: 'n1', skillId: 's1', role: 'Lead', position: { x: 1, y: 2 } },
        { id: 'n2', skillId: 's2', role: '', position: { x: 3, y: 4 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', kind: 'handoff', label: 'Brief', notes: 'n', detail: 'brief.md' }],
      contract: { ...emptyContract(), goals: [{ id: 'g', text: 'Win' }], outputs: [{ id: 'o', name: 'Out', description: '', producedBy: 'n2' }] },
      createdAt: 0,
      updatedAt: 0,
      publishedVersion: null,
      publishedHash: null,
    };
    const bytes = await exportStackBundle(stack, skills);
    const { files } = await readZip(bytes);
    const parsed = parseStackBundle(files)!;
    expect(parsed.manifest.stack.name).toBe('Demo');
    expect(parsed.manifest.stack.edges).toEqual(stack.edges);
    expect(parsed.manifest.stack.contract).toEqual(stack.contract);
    expect(parsed.skills.map((s) => s.content)).toEqual(skills.map((s) => s.content));
    expect(parsed.skills[0].files).toEqual(skills[0].files);
    expect(parsed.skills[0].folder).toBe('F');
  });

  it('rejects a malformed manifest with a clear message', () => {
    expect(() => parseStackBundle([{ path: 'skillproof.json', content: '{"format":"skillproof.stack"}' }])).toThrow(/invalid/);
  });

  it('returns null for non-bundles', () => {
    expect(parseStackBundle([{ path: 'a/SKILL.md', content: '' }])).toBeNull();
  });
});

describe('versioning', () => {
  it('produces line diffs and collapses context', () => {
    const rows = diffText('a\nb\nc\nd\ne\nf\ng\nh\n', 'a\nb\nc\nd\nE\nf\ng\nh\n');
    expect(rows.filter((r) => r.type === 'add').map((r) => r.text)).toEqual(['E']);
    expect(collapseDiff(rows, 1).some((r) => r.type === 'gap')).toBe(true);
  });

  it('ignores layout in the stack hash', () => {
    const s = { name: 'x', description: '', nodes: [{ id: 'n', skillId: 's', role: '', position: { x: 0, y: 0 } }], edges: [], contract: emptyContract() };
    expect(stackHash(s)).toBe(stackHash({ ...s, nodes: [{ ...s.nodes[0], position: { x: 99, y: 9 } }] }));
  });

  it('describes structural stack changes', () => {
    const before = { nodes: [{ id: 'n1', skillId: 'a', role: '', position: { x: 0, y: 0 } }], edges: [], contract: emptyContract() };
    const after = {
      nodes: [...before.nodes, { id: 'n2', skillId: 'b', role: '', position: { x: 0, y: 0 } }],
      edges: [{ id: 'e', source: 'n1', target: 'n2', kind: 'depends' as const, label: '', notes: '', detail: '' }],
      contract: { ...emptyContract(), goals: [{ id: 'g', text: 'New goal' }] },
    };
    const changes = diffStacks(before, after, (id) => id.toUpperCase());
    expect(changes).toContainEqual({ type: 'added', area: 'skill', text: 'B' });
    expect(changes).toContainEqual({ type: 'added', area: 'connection', text: 'A depends on B' });
    expect(changes).toContainEqual({ type: 'added', area: 'contract', text: 'Goal: New goal' });
  });
});

describe('evaluation', () => {
  it('derives outcomes from criterion results', () => {
    expect(outcomeFor([{ passed: true }, { passed: true }])).toBe('pass');
    expect(outcomeFor([{ passed: true }, { passed: false }])).toBe('partial');
    expect(outcomeFor([{ passed: false }])).toBe('fail');
  });

  it('simulates coverage from instruction keywords', () => {
    const r = simulateCriteria(
      [
        { id: '1', text: 'Flags injection as blocking' },
        { id: '2', text: 'Mentions accessibility contrast' },
      ],
      'Security issues like injection are always blocking.',
    );
    expect(r.map((x) => x.passed)).toEqual([true, false]);
  });
});
