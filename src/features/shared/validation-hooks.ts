import { useMemo } from 'react';
import { useSkills } from '@/data/hooks';
import { summarize, validateSkill, validateStack, type StackValidationContext } from '@/domain/validation';
import type { Issue, Skill, Stack } from '@/domain/types';

export function buildContext(skills: Skill[]): StackValidationContext {
  return { skillNames: new Set(skills.map((s) => s.name).filter(Boolean)), skillsById: new Map(skills.map((s) => [s.id, s])) };
}

export function useValidationContext(): StackValidationContext | undefined {
  const skills = useSkills();
  return useMemo(() => (skills ? buildContext(skills) : undefined), [skills]);
}

export function useSkillIssueMap(): Map<string, { issues: Issue[]; errors: number; warnings: number }> {
  const skills = useSkills();
  return useMemo(() => {
    const map = new Map<string, { issues: Issue[]; errors: number; warnings: number }>();
    if (!skills) return map;
    const ctx = buildContext(skills);
    for (const s of skills) {
      const issues = validateSkill(s, ctx);
      map.set(s.id, { issues, ...summarize(issues) });
    }
    return map;
  }, [skills]);
}

export function useStackIssues(stack: Stack | undefined): Issue[] {
  const ctx = useValidationContext();
  return useMemo(() => (stack && ctx ? validateStack(stack, ctx) : []), [stack, ctx]);
}
