import { autoLayout } from '@/domain/graph';
import { outcomeFor, simulateCriteria } from '@/domain/evaluation';
import { uid } from '@/lib/id';
import type { StackEdge, StackNode } from '@/domain/types';
import type { SkillProofRepository } from './repository';
import { SEED_SCENARIOS, SEED_SKILLS, SEED_STACKS } from './seed-content';

export async function seedDemo(repo: SkillProofRepository): Promise<void> {
  const ids = new Map<string, string>();

  for (const s of SEED_SKILLS) {
    const first = s.history?.[0]?.content ?? s.content;
    const created = await repo.createSkill({ content: first, files: s.files, tags: s.tags, folder: s.folder, source: { kind: 'demo' } });
    ids.set(s.key, created.id);
  }

  for (const s of SEED_SKILLS) {
    const id = ids.get(s.key)!;
    const history = s.history ?? [];
    for (let i = 0; i < history.length; i++) {
      if (i > 0) await repo.updateSkill(id, { content: history[i].content });
      await repo.publishSkill(id, history[i].note);
    }
    if (history.length) await repo.updateSkill(id, { content: s.content });
    if (s.publishCurrent) await repo.publishSkill(id, s.publishCurrent);
  }

  const stackIds = new Map<string, string>();
  for (const st of SEED_STACKS) {
    const nodeIds = new Map<string, string>();
    const nodes: StackNode[] = st.skills.map((k) => {
      const id = uid('n');
      nodeIds.set(k.key, id);
      return { id, skillId: ids.get(k.key)!, role: k.role, position: { x: 0, y: 0 } };
    });
    const edges: StackEdge[] = st.edges.map(([from, kind, to, label, detail, notes]) => ({
      id: uid('e'),
      source: nodeIds.get(from)!,
      target: nodeIds.get(to)!,
      kind,
      label,
      detail,
      notes: notes ?? '',
    }));
    const item = (text: string) => ({ id: uid('c'), text });
    const stack = await repo.createStack({
      name: st.name,
      description: st.description,
      nodes: autoLayout(nodes, edges),
      edges,
      contract: {
        goals: st.goals.map(item),
        expectations: st.expectations.map(item),
        standards: st.standards.map(item),
        checkpoints: st.checkpoints.map((c) => ({ id: uid('c'), title: c.title, approver: c.approver, afterNodeId: c.after ? nodeIds.get(c.after)! : null })),
        outputs: st.outputs.map((o) => ({ id: uid('c'), name: o.name, description: o.description, producedBy: o.by ? nodeIds.get(o.by)! : null })),
      },
    });
    stackIds.set(st.name, stack.id);
    if (st.publish) {
      await repo.publishStack(stack.id, st.publish);
      if (st.afterPublishGoal) {
        await repo.updateStack(stack.id, { contract: { ...stack.contract, goals: [...stack.contract.goals, item(st.afterPublishGoal)] } });
      }
    }
  }

  for (const sc of SEED_SCENARIOS) {
    const targetId = sc.target.type === 'skill' ? ids.get(sc.target.key)! : stackIds.get(sc.target.key)!;
    const criteria = sc.criteria.map((text) => ({ id: uid('cr'), text }));
    const scenario = await repo.saveScenario({ targetType: sc.target.type, targetId, title: sc.title, input: sc.input, expected: sc.expected, criteria });
    for (const run of sc.runs) {
      let results: { criterionId: string; passed: boolean }[];
      if ('simulate' in run) {
        const stack = await repo.getStack(targetId);
        const skills = await repo.listSkills();
        const text = skills.filter((s) => stack!.nodes.some((n) => n.skillId === s.id)).map((s) => s.content).join('\n');
        results = simulateCriteria(criteria, text).map(({ criterionId, passed }) => ({ criterionId, passed }));
      } else {
        results = criteria.map((c, i) => ({ criterionId: c.id, passed: run.passed[i] }));
      }
      await repo.addRun({
        scenarioId: scenario.id,
        version: run.version,
        mode: 'simulate' in run ? 'simulated' : 'manual',
        outcome: outcomeFor(results),
        results,
        notes: run.notes,
      });
    }
  }

  await repo.setSetting('seededAt', String(Date.now()));
}
