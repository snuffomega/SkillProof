import { useMemo, useState } from 'react';
import { FlaskConical, Layers, Plus, Search, Sparkle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { useRuns, useScenarios, useSkills, useStacks } from '@/data/hooks';
import type { EvalRun, Scenario } from '@/domain/types';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/ui';
import { ScenarioDialog } from './ScenarioDialog';
import { ScenarioDetail } from './ScenarioDetail';
import { OUTCOME_META, latestRun } from './eval-utils';

export function EvalsView({ scenarioId }: { scenarioId?: string }) {
  const scenarios = useScenarios();
  const runs = useRuns() ?? [];
  const skills = useSkills() ?? [];
  const stacks = useStacks() ?? [];
  const navigate = useUI((s) => s.navigate);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const targetName = useMemo(() => {
    const names = new Map<string, string>();
    skills.forEach((s) => names.set(`skill:${s.id}`, s.name));
    stacks.forEach((s) => names.set(`stack:${s.id}`, s.name));
    return (s: Scenario) => names.get(`${s.targetType}:${s.targetId}`) ?? `Deleted ${s.targetType}`;
  }, [skills, stacks]);

  const runsByScenario = useMemo(() => {
    const m = new Map<string, EvalRun[]>();
    runs.forEach((r) => m.set(r.scenarioId, [...(m.get(r.scenarioId) ?? []), r]));
    return m;
  }, [runs]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(scenarios ?? [])]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || targetName(s).toLowerCase().includes(q) || s.input.toLowerCase().includes(q));
  }, [scenarios, query, targetName]);

  const selected = scenarios?.find((s) => s.id === scenarioId);
  const open = (s: Scenario) => navigate({ view: 'evals', scenarioId: s.id });

  if (scenarios && scenarios.length === 0) {
    return (
      <>
        <EmptyState
          icon={FlaskConical}
          title="No evaluation scenarios yet"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus /> New scenario
            </Button>
          }
        >
          A scenario describes a task, what a good result looks like, and the criteria you'll check. Record outcomes per revision to see whether changes help.
        </EmptyState>
        <ScenarioDialog open={creating} onOpenChange={setCreating} onSaved={open} />
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className={cn('flex w-full shrink-0 flex-col border-r md:w-80', selected && 'hidden md:flex')}>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <h2 className="flex-1 text-[15px] font-semibold">Evaluations</h2>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus /> New
          </Button>
        </div>
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search scenarios"
              aria-label="Search scenarios"
              className="h-8 w-full rounded-md bg-surface-2 pl-8 pr-3 text-[13px] outline-none ring-ring/50 focus:ring-2"
            />
          </div>
        </div>
        <ul className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
          {list.map((s) => {
            const sRuns = runsByScenario.get(s.id) ?? [];
            const last = latestRun(sRuns);
            const TargetIcon = s.targetType === 'stack' ? Layers : Sparkle;
            return (
              <li key={s.id}>
                <button
                  onClick={() => open(s)}
                  className={cn(
                    'group w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
                    s.id === scenarioId && 'bg-accent text-accent-foreground',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('size-1.5 shrink-0 rounded-full', last ? OUTCOME_META[last.outcome].dot : 'bg-muted-foreground/30')} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 pl-3.5 text-[11.5px] text-muted-foreground">
                    <TargetIcon className="size-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{targetName(s)}</span>
                    <span className="shrink-0 tabular-nums">
                      {sRuns.length} run{sRuns.length === 1 ? '' : 's'}
                      {last && ` · ${relativeTime(last.recordedAt)}`}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
          {scenarios && list.length === 0 && <li className="px-3 py-8 text-center text-xs text-muted-foreground">No scenarios match your search.</li>}
        </ul>
      </aside>

      <section className={cn('min-w-0 flex-1', !selected && 'hidden md:block')}>
        {selected ? (
          <ScenarioDetail key={selected.id} scenario={selected} runs={runsByScenario.get(selected.id) ?? []} />
        ) : (
          <EmptyState icon={FlaskConical} title="Select a scenario">
            Pick a scenario to record outcomes, run a simulated check, and compare revisions.
          </EmptyState>
        )}
      </section>

      <ScenarioDialog open={creating} onOpenChange={setCreating} onSaved={open} />
    </div>
  );
}
