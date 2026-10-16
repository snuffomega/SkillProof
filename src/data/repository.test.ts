import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SkillProofDB } from './db';
import { createDexieRepository } from './dexie-repository';
import { PublishBlockedError, type SkillProofRepository } from './repository';
import { seedDemo } from './seed';
import { importBundle } from '@/services/import-service';
import { exportStackBundle, parseStackBundle, readZip } from '@/domain/bundle';
import { validateSkill, validateStack } from '@/domain/validation';
import { skillTemplate } from '@/domain/skill-markdown';

let db: SkillProofDB;
let repo: SkillProofRepository;

beforeEach(async () => {
  db = new SkillProofDB(`test-${Math.random()}`);
  repo = createDexieRepository(db);
});

describe('skills and versions', () => {
  it('publishes immutable snapshots and tracks drafts', async () => {
    const s = await repo.createSkill({ content: skillTemplate('alpha', 'Explains exactly when and why to use alpha in a workflow.') });
    expect(s.name).toBe('alpha');
    const v1 = await repo.publishSkill(s.id, 'first');
    expect(v1.version).toBe(1);
    await repo.updateSkill(s.id, { content: s.content + '\nMore.' });
    const v2 = await repo.publishSkill(s.id, 'second');
    expect(v2.version).toBe(2);
    await expect(db.skillVersions.update(v1.id, { content: 'tampered' })).rejects.toThrow(/immutable/);
    expect((await db.skillVersions.get(v1.id))!.content).toBe(s.content);
    const restored = await repo.restoreSkillVersion(v1.id);
    expect(restored.content).toBe(s.content);
    expect(restored.publishedVersion).toBe(2);
  });

  it('refuses to publish a skill with validation errors', async () => {
    const s = await repo.createSkill({ content: '# no frontmatter' });
    await expect(repo.publishSkill(s.id, '')).rejects.toBeInstanceOf(PublishBlockedError);
  });

  it('removes deleted skills from stacks and clears contract references', async () => {
    const s = await repo.createSkill({ content: skillTemplate('alpha', '') });
    const st = await repo.createStack({
      name: 'S',
      nodes: [{ id: 'n1', skillId: s.id, role: '', position: { x: 0, y: 0 } }],
      contract: { goals: [], expectations: [], standards: [], checkpoints: [], outputs: [{ id: 'o', name: 'x', description: '', producedBy: 'n1' }] },
    });
    await repo.deleteSkill(s.id);
    const after = (await repo.getStack(st.id))!;
    expect(after.nodes).toEqual([]);
    expect(after.contract.outputs[0].producedBy).toBeNull();
  });
});

describe('demo seed', () => {
  it('creates connected stacks with deliberate, real issues', async () => {
    await seedDemo(repo);
    const skills = await repo.listSkills();
    const stacks = await repo.listStacks();
    expect(skills.length).toBeGreaterThanOrEqual(14);
    expect(stacks.map((s) => s.name).sort()).toEqual(['Content Pipeline', 'Ship a Feature', 'Weekly Metrics Report']);
    const ctx = { skillNames: new Set(skills.map((s) => s.name)), skillsById: new Map(skills.map((s) => [s.id, s])) };
    const ship = stacks.find((s) => s.name === 'Ship a Feature')!;
    const codes = validateStack(ship, ctx).map((i) => i.code);
    expect(codes).toContain('CONFLICT_UNRESOLVED');
    expect(codes).toContain('LINK_FILE_BROKEN');
    const content = stacks.find((s) => s.name === 'Content Pipeline')!;
    expect(validateStack(content, ctx).filter((i) => i.severity === 'error')).toEqual([]);
    expect(content.publishedVersion).toBe(1);
    const review = skills.find((s) => s.name === 'code-review')!;
    expect(await repo.listSkillVersions(review.id)).toHaveLength(2);
    expect(validateSkill(review, ctx).filter((i) => i.severity === 'error')).toEqual([]);
    expect((await repo.listRuns()).some((r) => r.mode === 'simulated')).toBe(true);
  });
});

describe('bundle import', () => {
  it('rebuilds an exported stack in an empty workspace', async () => {
    await seedDemo(repo);
    const stack = (await repo.listStacks()).find((s) => s.name === 'Content Pipeline')!;
    const all = await repo.listSkills();
    const skills = all.filter((s) => stack.nodes.some((n) => n.skillId === s.id));
    const bytes = await exportStackBundle(stack, skills);

    const fresh = createDexieRepository(new SkillProofDB(`fresh-${Math.random()}`));
    const bundle = parseStackBundle((await readZip(bytes)).files)!;
    const result = await importBundle(fresh, bundle, 'skip');
    const rebuilt = (await fresh.getStack(result.stackId))!;
    const freshSkills = await fresh.listSkills();
    expect(rebuilt.nodes).toHaveLength(stack.nodes.length);
    expect(rebuilt.edges.map((e) => [e.kind, e.label, e.detail])).toEqual(stack.edges.map((e) => [e.kind, e.label, e.detail]));
    expect(rebuilt.contract.outputs.every((o) => rebuilt.nodes.some((n) => n.id === o.producedBy))).toBe(true);
    expect(freshSkills.map((s) => s.content).sort()).toEqual(skills.map((s) => s.content).sort());

    const again = await importBundle(fresh, bundle, 'skip');
    expect(again.skillsCreated).toBe(0);
    expect((await fresh.listSkills()).length).toBe(freshSkills.length);
  });
});
