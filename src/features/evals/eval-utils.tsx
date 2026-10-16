import { useMemo } from 'react';
import { useSkillVersions, useSkills, useStack, useStackVersions } from '@/data/hooks';
import type { EvalRun, RunOutcome, Scenario, Skill, Stack, StackSnapshotSkill } from '@/domain/types';
import { cn } from '@/lib/utils';

export const OUTCOME_META: Record<RunOutcome, { label: string; cls: string; dot: string }> = {
  pass: { label: 'Pass', cls: 'text-ok bg-ok/10 border-ok/25', dot: 'bg-ok' },
  partial: { label: 'Partial', cls: 'text-warn bg-warn/10 border-warn/25', dot: 'bg-warn' },
  fail: { label: 'Fail', cls: 'text-err bg-err/10 border-err/25', dot: 'bg-err' },
};

export function OutcomeBadge({ outcome, className }: { outcome: RunOutcome; className?: string }) {
  const m = OUTCOME_META[outcome];
  return <span className={cn('inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-medium', m.cls, className)}>{m.label}</span>;
}

export function versionLabel(v: number | null) {
  return v === null ? 'Draft' : `v${v}`;
}

export interface TargetRevision {
  version: number | null;
  label: string;
  /** Text the simulated check scans: the instructions as they were at this revision. */
  instructions: string;
}

function stackInstructions(stack: Pick<Stack, 'name' | 'description' | 'contract'>, skills: Pick<StackSnapshotSkill, 'content'>[]) {
  const c = stack.contract;
  return [
    stack.name,
    stack.description,
    ...c.goals.map((g) => g.text),
    ...c.expectations.map((g) => g.text),
    ...c.standards.map((g) => g.text),
    ...c.outputs.map((o) => `${o.name} ${o.description}`),
    ...c.checkpoints.map((o) => o.title),
    ...skills.map((s) => s.content),
  ].join('\n');
}

/** All revisions (working draft + published versions) of a scenario's target, newest first. */
export function useTargetRevisions(scenario: Scenario | undefined): { name: string; revisions: TargetRevision[]; exists: boolean } {
  const isSkill = scenario?.targetType === 'skill';
  const skills = useSkills();
  const skillVersions = useSkillVersions(isSkill ? scenario?.targetId : undefined);
  const stack = useStack(!isSkill ? scenario?.targetId : undefined);
  const stackVersions = useStackVersions(!isSkill ? scenario?.targetId : undefined);

  return useMemo(() => {
    if (!scenario || !skills) return { name: '', revisions: [], exists: false };
    const byId = new Map<string, Skill>(skills.map((s) => [s.id, s]));
    if (isSkill) {
      const skill = byId.get(scenario.targetId);
      if (!skill) return { name: 'Deleted skill', revisions: [], exists: false };
      const versions = [...(skillVersions ?? [])].sort((a, b) => b.version - a.version);
      return {
        name: skill.name,
        exists: true,
        revisions: [{ version: null, label: 'Draft', instructions: skill.content }, ...versions.map((v) => ({ version: v.version, label: `v${v.version}`, instructions: v.content }))],
      };
    }
    if (!stack) return { name: 'Deleted stack', revisions: [], exists: false };
    const draftSkills = stack.nodes.map((n) => byId.get(n.skillId)).filter((s): s is Skill => !!s);
    const versions = [...(stackVersions ?? [])].sort((a, b) => b.version - a.version);
    return {
      name: stack.name,
      exists: true,
      revisions: [
        { version: null, label: 'Draft', instructions: stackInstructions(stack, draftSkills) },
        ...versions.map((v) => ({ version: v.version, label: `v${v.version}`, instructions: stackInstructions(v, v.skills) })),
      ],
    };
  }, [scenario, skills, skillVersions, stack, stackVersions, isSkill]);
}

export function latestRun(runs: EvalRun[]): EvalRun | undefined {
  return runs.reduce<EvalRun | undefined>((acc, r) => (!acc || r.recordedAt > acc.recordedAt ? r : acc), undefined);
}
