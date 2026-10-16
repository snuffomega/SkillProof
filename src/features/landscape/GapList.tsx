import { AlertCircle, Info, TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/common';
import type { Landscape } from '@/domain/landscape';
import type { Skill } from '@/domain/types';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/ui';

export function GapList({ landscape, skills }: { landscape: Landscape; skills: Skill[] }) {
  const navigate = useUI((s) => s.navigate);
  const skillsById = new Map(skills.map((s) => [s.id, s]));
  const { gaps } = landscape;

  if (gaps.length === 0) {
    return (
      <EmptyState icon={AlertCircle} title="No gaps detected">
        Every skill maps to a work area, and no areas have weak coverage or excessive overlap.
      </EmptyState>
    );
  }

  return (
    <div className="scrollbar-thin h-full min-h-0 overflow-y-auto p-4">
      <ul className="mx-auto max-w-3xl space-y-2">
        {gaps.map((gap) => {
          const Icon = gap.severity === 'warning' ? TriangleAlert : Info;
          const tone = gap.severity === 'warning' ? 'text-warn' : 'text-info';
          return (
            <li key={gap.id} className="rounded-xl border bg-surface p-3.5">
              <div className="flex items-start gap-2.5">
                <Icon className={cn('mt-0.5 size-4 shrink-0', tone)} />
                <div className="min-w-0 flex-1">
                  {gap.areaId !== 'none' && (
                    <button
                      onClick={() => navigate({ view: 'landscape', tab: 'areas', areaId: gap.areaId })}
                      className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      {gap.areaLabel}
                    </button>
                  )}
                  <p className="text-[13px] leading-relaxed">{gap.description}</p>
                  {gap.relatedSkills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {gap.relatedSkills.slice(0, 6).map((id) => (
                        <button
                          key={id}
                          onClick={() => navigate({ view: 'library', skillId: id, tab: 'edit' })}
                          className="rounded border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] hover:border-foreground/25"
                        >
                          {skillsById.get(id)?.name ?? 'deleted'}
                        </button>
                      ))}
                      {gap.relatedSkills.length > 6 && <span className="text-[11px] text-muted-foreground">+{gap.relatedSkills.length - 6} more</span>}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
