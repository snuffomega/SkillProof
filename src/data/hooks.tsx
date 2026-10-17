import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { buildLandscape } from '@/domain/landscape';
import type { EvalTargetType, ID } from '@/domain/types';
import type { SkillProofRepository } from './repository';

const RepositoryContext = createContext<SkillProofRepository | null>(null);

export function RepositoryProvider({ repository, children }: { repository: SkillProofRepository; children: ReactNode }) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): SkillProofRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useRepository must be used inside RepositoryProvider');
  return repo;
}

export function useSkills() {
  const repo = useRepository();
  return useLiveQuery(() => repo.listSkills(), [repo]);
}

export function useSkill(id: ID | undefined) {
  const repo = useRepository();
  return useLiveQuery(() => (id ? repo.getSkill(id) : undefined), [repo, id]);
}

export function useSkillVersions(skillId: ID | undefined) {
  const repo = useRepository();
  return useLiveQuery(() => (skillId ? repo.listSkillVersions(skillId) : []), [repo, skillId]);
}

export function useStacks() {
  const repo = useRepository();
  return useLiveQuery(() => repo.listStacks(), [repo]);
}

export function useStack(id: ID | undefined) {
  const repo = useRepository();
  return useLiveQuery(() => (id ? repo.getStack(id) : undefined), [repo, id]);
}

export function useStackVersions(stackId: ID | undefined) {
  const repo = useRepository();
  return useLiveQuery(() => (stackId ? repo.listStackVersions(stackId) : []), [repo, stackId]);
}

export function useScenarios(target?: { type: EvalTargetType; id: ID }) {
  const repo = useRepository();
  return useLiveQuery(() => repo.listScenarios(target), [repo, target?.type, target?.id]);
}

export function useRuns(scenarioId?: ID) {
  const repo = useRepository();
  return useLiveQuery(() => repo.listRuns(scenarioId), [repo, scenarioId]);
}

export function useSetting(key: 'githubToken' | 'seededAt') {
  const repo = useRepository();
  return useLiveQuery(() => repo.getSetting(key).then((v) => v ?? ''), [repo, key]);
}

export function useLandscape() {
  const skills = useSkills();
  const stacks = useStacks();
  return useMemo(() => {
    if (!skills) return undefined;
    const manualEdges = (stacks ?? []).flatMap((st) => {
      const nodeToSkill = new Map(st.nodes.map((n) => [n.id, n.skillId]));
      return st.edges.map((e) => ({
        source: nodeToSkill.get(e.source) ?? e.source,
        target: nodeToSkill.get(e.target) ?? e.target,
        kind: e.kind,
        label: e.label,
      }));
    });
    return buildLandscape(skills, manualEdges);
  }, [skills, stacks]);
}
