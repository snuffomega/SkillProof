import { useState } from 'react';
import { ChevronRight, FlaskConical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { useRuns } from '@/data/hooks';
import { passRate } from '@/domain/evaluation';
import type { Scenario, Skill } from '@/domain/types';
import { relativeTime } from '@/lib/format';
import { useUI } from '@/store/ui';
import { ScenarioDialog } from '@/features/evals/ScenarioDialog';
import { latestRun, OutcomeBadge, versionLabel } from '@/features/evals/eval-utils';

export function SkillEvalsTab({ skill, scenarios }: { skill: Skill; scenarios: Scenario[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useUI((s) => s.navigate);
  const runs = useRuns() ?? [];

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      {scenarios.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No scenarios for this skill"
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus /> New scenario
            </Button>
          }
        >
          A scenario is a realistic task plus the criteria a good result must meet. Record outcomes against each version to see whether revisions improve.
        </EmptyState>
      ) : (
        <div className="mx-auto max-w-3xl p-6">
          <div className="mb-3 flex items-center">
            <h3 className="flex-1 text-[13px] font-medium">Scenarios testing {skill.name}</h3>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus /> New scenario
            </Button>
          </div>
          <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
            {scenarios.map((sc) => {
              const scRuns = runs.filter((r) => r.scenarioId === sc.id);
              const last = latestRun(scRuns);
              return (
                <li key={sc.id}>
                  <button onClick={() => navigate({ view: 'evals', scenarioId: sc.id })} className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{sc.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {sc.criteria.length} criteria · {scRuns.length} run{scRuns.length === 1 ? '' : 's'}
                        {last && ` · last ${versionLabel(last.version)} ${relativeTime(last.recordedAt)}`}
                      </span>
                    </span>
                    {scRuns.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{Math.round(passRate(scRuns) * 100)}%</span>}
                    {last ? <OutcomeBadge outcome={last.outcome} /> : <span className="text-xs text-muted-foreground">No runs</span>}
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <ScenarioDialog open={open} onOpenChange={setOpen} defaultTarget={{ type: 'skill', id: skill.id }} onSaved={(s) => navigate({ view: 'evals', scenarioId: s.id })} />
    </div>
  );
}
