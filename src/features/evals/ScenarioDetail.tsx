import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, BarChart3, ClipboardCheck, Gauge, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SourceLabel } from '@/components/common';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRepository } from '@/data/hooks';
import { passRate } from '@/domain/evaluation';
import type { EvalRun, Scenario } from '@/domain/types';
import { formatDate, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/ui';
import { ScenarioDialog } from './ScenarioDialog';
import { RecordRunDialog, SimulateDialog } from './RunDialogs';
import { OutcomeBadge, useTargetRevisions, versionLabel } from './eval-utils';

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-surface p-4', className)}>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function RateBar({ value, simulated }: { value: number | null; simulated?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground/60">No runs</span>;
  const pct = Math.round(value * 100);
  const tone = pct >= 80 ? 'bg-ok' : pct >= 50 ? 'bg-warn' : 'bg-err';
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full transition-all duration-500', tone, simulated && 'opacity-60')} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums">{pct}%</span>
    </div>
  );
}

export function ScenarioDetail({ scenario, runs }: { scenario: Scenario; runs: EvalRun[] }) {
  const repo = useRepository();
  const navigate = useUI((s) => s.navigate);
  const { name, revisions, exists } = useTargetRevisions(scenario);
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [confirm, confirmNode] = useConfirm();

  const sortedRuns = useMemo(() => [...runs].sort((a, b) => b.recordedAt - a.recordedAt), [runs]);

  const comparison = useMemo(
    () =>
      revisions.map((r) => {
        const forRev = runs.filter((x) => x.version === r.version);
        const manual = forRev.filter((x) => x.mode === 'manual');
        const sim = forRev.filter((x) => x.mode === 'simulated');
        return { ...r, manualCount: manual.length, manual: manual.length ? passRate(manual) : null, simulated: sim.length ? passRate(sim) : null };
      }),
    [revisions, runs],
  );

  const criterionText = (id: string) => scenario.criteria.find((c) => c.id === id)?.text ?? 'Removed criterion';

  const openTarget = () =>
    scenario.targetType === 'skill'
      ? navigate({ view: 'library', skillId: scenario.targetId, tab: 'evals' })
      : navigate({ view: 'stacks', stackId: scenario.targetId, tab: 'graph' });

  const remove = () =>
    confirm({
      title: `Delete "${scenario.title}"?`,
      description: `The scenario and its ${runs.length} recorded run${runs.length === 1 ? '' : 's'} will be deleted.`,
      confirmLabel: 'Delete scenario',
      destructive: true,
      onConfirm: async () => {
        await repo.deleteScenario(scenario.id);
        toast.success('Scenario deleted');
        navigate({ view: 'evals' });
      },
    });

  const removeRun = (run: EvalRun) =>
    confirm({
      title: 'Delete this run?',
      description: `${versionLabel(run.version)} · ${formatDate(run.recordedAt)}`,
      confirmLabel: 'Delete run',
      destructive: true,
      onConfirm: () => repo.deleteRun(run.id),
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => navigate({ view: 'evals' })} aria-label="All scenarios">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{scenario.title}</h2>
          <button onClick={openTarget} disabled={!exists} className="group mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none">
            <span className="capitalize">{scenario.targetType}</span>
            <span className="font-mono">{name}</span>
            {exists && <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />}
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setSimulating(true)} disabled={!exists || !scenario.criteria.length}>
          <Gauge /> <span className="hidden sm:inline">Simulated check</span>
        </Button>
        <Button size="sm" onClick={() => setRecording(true)} disabled={!exists || !scenario.criteria.length}>
          <ClipboardCheck /> <span className="hidden sm:inline">Record outcome</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil /> Edit scenario
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={remove} className="text-err focus:text-err">
              <Trash2 /> Delete scenario
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-4 p-5 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Section title="Task">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{scenario.input || <span className="text-muted-foreground">No task described.</span>}</p>
            </Section>
            <Section title="Expected outcome">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{scenario.expected || <span className="text-muted-foreground">Not specified.</span>}</p>
            </Section>
            <Section title={`Criteria · ${scenario.criteria.length}`}>
              <ol className="space-y-1.5">
                {scenario.criteria.map((c, i) => (
                  <li key={c.id} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <span className="mt-px font-mono text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    {c.text}
                  </li>
                ))}
                {scenario.criteria.length === 0 && <li className="text-xs text-muted-foreground">Add criteria to start recording outcomes.</li>}
              </ol>
            </Section>
          </div>

          <Section title="Revision comparison" className="lg:col-span-2 lg:self-start">
            {!exists ? (
              <p className="text-xs text-muted-foreground">The {scenario.targetType} this scenario targets was deleted.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground">
                    <th className="pb-2 font-normal">Revision</th>
                    <th className="pb-2 font-normal">Recorded</th>
                    <th className="pb-2 pl-3 font-normal">Simulated</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((r) => (
                    <tr key={r.label} className="border-t">
                      <td className="py-2 pr-2 font-mono">
                        {r.label}
                        {r.manualCount > 0 && <span className="ml-1 text-muted-foreground">×{r.manualCount}</span>}
                      </td>
                      <td className="w-2/5 py-2">
                        <RateBar value={r.manual} />
                      </td>
                      <td className="w-2/5 py-2 pl-3">
                        <RateBar value={r.simulated} simulated />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <BarChart3 className="size-3" /> Share of criteria met across runs per revision.
            </p>
          </Section>

          <Section title={`Run history · ${runs.length}`} className="lg:col-span-5">
            {sortedRuns.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No runs yet. Record an outcome after trying the scenario with your agent.</p>
            ) : (
              <ul className="divide-y">
                {sortedRuns.map((run) => (
                  <li key={run.id} className="group py-3 first:pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <OutcomeBadge outcome={run.outcome} />
                      <SourceLabel kind={run.mode === 'manual' ? 'manual' : 'simulated'} />
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{versionLabel(run.version)}</span>
                      <span className="text-xs tabular-nums text-muted-foreground" title={formatDate(run.recordedAt)}>
                        {run.results.filter((r) => r.passed).length}/{run.results.length} criteria · {relativeTime(run.recordedAt)}
                      </span>
                      <Button variant="ghost" size="icon-sm" className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" onClick={() => removeRun(run)} aria-label="Delete run">
                        <X />
                      </Button>
                    </div>
                    {run.notes && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{run.notes}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {run.results.map((r) => (
                        <span
                          key={r.criterionId}
                          title={criterionText(r.criterionId)}
                          className={cn('max-w-64 truncate rounded border px-1.5 py-0.5 text-[11px]', r.passed ? 'border-ok/25 text-ok' : 'border-err/25 text-err')}
                        >
                          {r.passed ? 'Met' : 'Missed'}: {criterionText(r.criterionId)}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <ScenarioDialog open={editing} onOpenChange={setEditing} scenario={scenario} />
      <RecordRunDialog open={recording} onOpenChange={setRecording} scenario={scenario} revisions={revisions} />
      <SimulateDialog open={simulating} onOpenChange={setSimulating} scenario={scenario} revisions={revisions} />
      {confirmNode}
    </div>
  );
}
