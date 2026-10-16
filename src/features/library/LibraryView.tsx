import { useMemo } from 'react';
import { BookOpen, CircleAlert, FilePen, Lock, Plus, SearchX, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, HealthPill, StatusBadge } from '@/components/common';
import { useSkills } from '@/data/hooks';
import { skillStatus } from '@/domain/versioning';
import { relativeTime } from '@/lib/format';
import { useUI, type SkillTab } from '@/store/ui';
import { useSkillIssueMap } from '@/features/shared/validation-hooks';
import { SkillList } from './SkillList';
import { SkillDetail } from './SkillDetail';
import { cn } from '@/lib/utils';

export function LibraryView({ skillId, tab }: { skillId?: string; tab: SkillTab }) {
  const skills = useSkills();
  const issueMap = useSkillIssueMap();
  const openDialog = useUI((s) => s.openDialog);

  if (!skills) return null;

  if (skills.length === 0)
    return (
      <EmptyState
        icon={BookOpen}
        title="Your library is empty"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openDialog('import')}>
              <Upload /> Import skills
            </Button>
            <Button onClick={() => openDialog('new-skill')}>
              <Plus /> New skill
            </Button>
          </div>
        }
      >
        Create a SKILL.md from scratch or import existing skills from files, folders, ZIP archives or a public GitHub repository.
      </EmptyState>
    );

  const skill = skillId ? skills.find((s) => s.id === skillId) : undefined;

  return (
    <div className="flex h-full min-h-0">
      <SkillList skills={skills} selectedId={skillId} issueMap={issueMap} className={cn(skillId && 'hidden lg:flex')} />
      <div className={cn('min-w-0 flex-1', !skillId && 'hidden lg:block')}>
        {skill ? (
          <SkillDetail key={skill.id} skill={skill} tab={tab} skills={skills} issues={issueMap.get(skill.id)?.issues ?? []} />
        ) : skillId ? (
          <EmptyState icon={SearchX} title="Skill not found">
            It may have been deleted. Pick another skill from the list.
          </EmptyState>
        ) : (
          <LibraryOverview />
        )}
      </div>
    </div>
  );
}

function LibraryOverview() {
  const skills = useSkills() ?? [];
  const issueMap = useSkillIssueMap();
  const navigate = useUI((s) => s.navigate);

  const stats = useMemo(() => {
    const statuses = skills.map(skillStatus);
    return {
      published: statuses.filter((s) => s === 'published').length,
      edited: statuses.filter((s) => s === 'modified').length,
      drafts: statuses.filter((s) => s === 'draft').length,
      errors: skills.filter((s) => issueMap.get(s.id)?.errors).length,
    };
  }, [skills, issueMap]);

  const recent = [...skills].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const cards = [
    { label: 'Published', value: stats.published, icon: Lock, tone: 'text-ok' },
    { label: 'Edited since publish', value: stats.edited, icon: FilePen, tone: 'text-warn' },
    { label: 'Never published', value: stats.drafts, icon: BookOpen, tone: 'text-muted-foreground' },
    { label: 'With errors', value: stats.errors, icon: CircleAlert, tone: 'text-err' },
  ];

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-12 fade-up">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Library</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{skills.length} skills</h2>
        <p className="mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-muted-foreground">
          Each skill is a portable SKILL.md: what to achieve, the bar to meet, and what to hand back. Select one to edit, publish or evaluate it.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="bg-surface px-4 py-3.5">
              <c.icon className={cn('size-4', c.tone)} />
              <div className="mt-3 text-xl font-semibold tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>

        <h3 className="mb-2 mt-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recently edited</h3>
        <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
          {recent.map((s) => {
            const h = issueMap.get(s.id);
            return (
              <li key={s.id}>
                <button onClick={() => navigate({ view: 'library', skillId: s.id, tab: 'edit' })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px]">{s.name || 'unnamed-skill'}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.description}</span>
                  </span>
                  <HealthPill errors={h?.errors ?? 0} warnings={h?.warnings ?? 0} />
                  <StatusBadge status={skillStatus(s)} version={s.publishedVersion} />
                  <span className="hidden w-16 text-right text-xs text-muted-foreground sm:block">{relativeTime(s.updatedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
