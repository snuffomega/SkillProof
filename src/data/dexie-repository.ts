import { uid } from '@/lib/id';
import { readMeta } from '@/domain/skill-markdown';
import { skillHash, stackHash } from '@/domain/versioning';
import { summarize, validateSkill, validateStack } from '@/domain/validation';
import { emptyContract, type Scenario, type Skill, type SkillVersion, type Stack, type StackVersion } from '@/domain/types';
import type { SkillProofDB } from './db';
import { PublishBlockedError, type SkillProofRepository } from './repository';

const byVersionDesc = (a: { version: number }, b: { version: number }) => b.version - a.version;

export function createDexieRepository(db: SkillProofDB): SkillProofRepository {
  const now = () => Date.now();

  async function requireSkill(id: string) {
    const s = await db.skills.get(id);
    if (!s) throw new Error('Skill not found.');
    return s;
  }
  async function requireStack(id: string) {
    const s = await db.stacks.get(id);
    if (!s) throw new Error('Stack not found.');
    return s;
  }
  async function validationContext() {
    const skills = await db.skills.toArray();
    return { skillNames: new Set(skills.map((s) => s.name)), skillsById: new Map(skills.map((s) => [s.id, s])) };
  }
  async function deleteScenariosFor(targetType: 'skill' | 'stack', targetId: string) {
    const scenarios = await db.scenarios.where('[targetType+targetId]').equals([targetType, targetId]).toArray();
    const ids = scenarios.map((s) => s.id);
    await db.runs.where('scenarioId').anyOf(ids).delete();
    await db.scenarios.bulkDelete(ids);
  }

  const repo: SkillProofRepository = {
    listSkills: () => db.skills.orderBy('name').toArray(),
    getSkill: (id) => db.skills.get(id),

    async createSkill(input) {
      const meta = readMeta(input.content);
      const t = now();
      const skill: Skill = {
        id: uid('sk'),
        name: meta.name,
        description: meta.description,
        content: input.content,
        files: input.files ?? [],
        tags: input.tags ?? [],
        folder: input.folder ?? '',
        source: input.source ?? { kind: 'manual' },
        createdAt: t,
        updatedAt: t,
        publishedVersion: null,
        publishedHash: null,
      };
      await db.skills.add(skill);
      return skill;
    },

    async updateSkill(id, patch) {
      const current = await requireSkill(id);
      const next: Skill = { ...current, ...patch, updatedAt: now() };
      if (patch.content !== undefined) Object.assign(next, readMeta(patch.content));
      await db.skills.put(next);
      return next;
    },

    async deleteSkill(id) {
      await db.transaction('rw', [db.skills, db.skillVersions, db.stacks, db.scenarios, db.runs], async () => {
        await db.skills.delete(id);
        await db.skillVersions.where('skillId').equals(id).delete();
        await deleteScenariosFor('skill', id);
        const stacks = await db.stacks.toArray();
        for (const st of stacks) {
          const removed = new Set(st.nodes.filter((n) => n.skillId === id).map((n) => n.id));
          if (!removed.size) continue;
          await db.stacks.put({
            ...st,
            nodes: st.nodes.filter((n) => !removed.has(n.id)),
            edges: st.edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)),
            contract: {
              ...st.contract,
              outputs: st.contract.outputs.map((o) => (o.producedBy && removed.has(o.producedBy) ? { ...o, producedBy: null } : o)),
              checkpoints: st.contract.checkpoints.map((c) => (c.afterNodeId && removed.has(c.afterNodeId) ? { ...c, afterNodeId: null } : c)),
            },
            updatedAt: now(),
          });
        }
      });
    },

    async listSkillVersions(skillId) {
      return (await db.skillVersions.where('skillId').equals(skillId).toArray()).sort(byVersionDesc);
    },

    async publishSkill(id, note) {
      return db.transaction('rw', [db.skills, db.skillVersions], async () => {
        const skill = await requireSkill(id);
        const ctx = await validationContext();
        const { errors } = summarize(validateSkill(skill, ctx));
        if (errors) throw new PublishBlockedError(errors);
        const existing = await db.skillVersions.where('skillId').equals(id).toArray();
        const version = Math.max(0, ...existing.map((v) => v.version)) + 1;
        const snapshot: SkillVersion = {
          id: uid('sv'),
          skillId: id,
          version,
          name: skill.name,
          description: skill.description,
          content: skill.content,
          files: structuredClone(skill.files),
          note: note.trim(),
          publishedAt: now(),
        };
        await db.skillVersions.add(snapshot);
        await db.skills.update(id, { publishedVersion: version, publishedHash: skillHash(skill.content, skill.files) });
        return snapshot;
      });
    },

    async restoreSkillVersion(versionId) {
      const v = await db.skillVersions.get(versionId);
      if (!v) throw new Error('Version not found.');
      return repo.updateSkill(v.skillId, { content: v.content, files: structuredClone(v.files) });
    },

    listStacks: () => db.stacks.orderBy('name').toArray(),
    getStack: (id) => db.stacks.get(id),

    async createStack(input) {
      const t = now();
      const stack: Stack = {
        id: uid('st'),
        name: input.name.trim() || 'Untitled stack',
        description: input.description ?? '',
        nodes: input.nodes ?? [],
        edges: input.edges ?? [],
        contract: input.contract ?? emptyContract(),
        createdAt: t,
        updatedAt: t,
        publishedVersion: null,
        publishedHash: null,
      };
      await db.stacks.add(stack);
      return stack;
    },

    async updateStack(id, patch) {
      const current = await requireStack(id);
      const next: Stack = { ...current, ...patch, updatedAt: now() };
      await db.stacks.put(next);
      return next;
    },

    async duplicateStack(id) {
      const s = await requireStack(id);
      return repo.createStack({
        name: `${s.name} (copy)`,
        description: s.description,
        nodes: structuredClone(s.nodes),
        edges: structuredClone(s.edges),
        contract: structuredClone(s.contract),
      });
    },

    async deleteStack(id) {
      await db.transaction('rw', [db.stacks, db.stackVersions, db.scenarios, db.runs], async () => {
        await db.stacks.delete(id);
        await db.stackVersions.where('stackId').equals(id).delete();
        await deleteScenariosFor('stack', id);
      });
    },

    async listStackVersions(stackId) {
      return (await db.stackVersions.where('stackId').equals(stackId).toArray()).sort(byVersionDesc);
    },

    async publishStack(id, note) {
      return db.transaction('rw', [db.stacks, db.stackVersions, db.skills], async () => {
        const stack = await requireStack(id);
        const ctx = await validationContext();
        const { errors } = summarize(validateStack(stack, ctx));
        if (errors) throw new PublishBlockedError(errors);
        const existing = await db.stackVersions.where('stackId').equals(id).toArray();
        const version = Math.max(0, ...existing.map((v) => v.version)) + 1;
        const skillIds = [...new Set(stack.nodes.map((n) => n.skillId))];
        const snapshot: StackVersion = {
          id: uid('tv'),
          stackId: id,
          version,
          name: stack.name,
          description: stack.description,
          nodes: structuredClone(stack.nodes),
          edges: structuredClone(stack.edges),
          contract: structuredClone(stack.contract),
          skills: skillIds.map((sid) => {
            const s = ctx.skillsById.get(sid)!;
            return { skillId: sid, name: s.name, content: s.content, files: structuredClone(s.files) };
          }),
          note: note.trim(),
          publishedAt: now(),
        };
        await db.stackVersions.add(snapshot);
        await db.stacks.update(id, { publishedVersion: version, publishedHash: stackHash(stack) });
        return snapshot;
      });
    },

    async restoreStackVersion(versionId) {
      const v = await db.stackVersions.get(versionId);
      if (!v) throw new Error('Version not found.');
      const nodes = structuredClone(v.nodes);
      for (const snap of v.skills) {
        if (await db.skills.get(snap.skillId)) continue;
        const recreated = await repo.createSkill({ content: snap.content, files: snap.files, source: { kind: 'bundle', ref: `${v.name} v${v.version}` } });
        nodes.forEach((n) => n.skillId === snap.skillId && (n.skillId = recreated.id));
      }
      return repo.updateStack(v.stackId, { name: v.name, description: v.description, nodes, edges: structuredClone(v.edges), contract: structuredClone(v.contract) });
    },

    async listScenarios(target) {
      const rows = target
        ? await db.scenarios.where('[targetType+targetId]').equals([target.type, target.id]).toArray()
        : await db.scenarios.toArray();
      return rows.sort((a, b) => a.createdAt - b.createdAt);
    },

    async saveScenario(input) {
      const t = now();
      const existing = input.id ? await db.scenarios.get(input.id) : undefined;
      const scenario: Scenario = { ...input, id: existing?.id ?? uid('sc'), createdAt: existing?.createdAt ?? t, updatedAt: t };
      await db.scenarios.put(scenario);
      return scenario;
    },

    async deleteScenario(id) {
      await db.transaction('rw', [db.scenarios, db.runs], async () => {
        await db.runs.where('scenarioId').equals(id).delete();
        await db.scenarios.delete(id);
      });
    },

    async listRuns(scenarioId) {
      const rows = scenarioId ? await db.runs.where('scenarioId').equals(scenarioId).toArray() : await db.runs.toArray();
      return rows.sort((a, b) => b.recordedAt - a.recordedAt);
    },

    async addRun(input) {
      const run = { ...input, id: uid('run'), recordedAt: now() };
      await db.runs.add(run);
      return run;
    },

    deleteRun: (id) => db.runs.delete(id),

    async getSetting(key) {
      return (await db.settings.get(key))?.value;
    },
    async setSetting(key, value) {
      await db.settings.put({ key, value });
    },

    async clearAll() {
      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
      });
    },
  };
  return repo;
}
