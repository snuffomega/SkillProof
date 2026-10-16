import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SourceLabel } from '@/components/common';
import { useRepository } from '@/data/hooks';
import { outcomeFor, simulateCriteria } from '@/domain/evaluation';
import type { Scenario } from '@/domain/types';
import { cn } from '@/lib/utils';
import { VersionSelect } from '@/features/versions/VersionSelect';
import { OutcomeBadge, type TargetRevision } from './eval-utils';

interface RunDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scenario: Scenario;
  revisions: TargetRevision[];
}

const keyOf = (v: number | null) => (v === null ? 'draft' : String(v));
const fromKey = (k: string) => (k === 'draft' ? null : Number(k));

function useRevisionPicker(open: boolean, revisions: TargetRevision[]) {
  const [key, setKey] = useState('draft');
  useEffect(() => {
    if (open) setKey('draft');
  }, [open]);
  const revision = revisions.find((r) => keyOf(r.version) === key) ?? revisions[0];
  const options = revisions.map((r) => ({ id: keyOf(r.version), label: r.label }));
  return { key, setKey, revision, options };
}

export function RecordRunDialog({ open, onOpenChange, scenario, revisions }: RunDialogProps) {
  const repo = useRepository();
  const { key, setKey, options } = useRevisionPicker(open, revisions);
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setPassed(new Set());
      setNotes('');
    }
  }, [open]);

  const results = scenario.criteria.map((c) => ({ criterionId: c.id, passed: passed.has(c.id) }));
  const outcome = outcomeFor(results);

  const save = async () => {
    await repo.addRun({ scenarioId: scenario.id, version: fromKey(key), mode: 'manual', outcome, results, notes: notes.trim() });
    toast.success('Outcome recorded');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Record outcome <SourceLabel kind="manual" />
          </DialogTitle>
          <DialogDescription>Run the scenario with your agent, then mark which criteria the result met.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="w-20 shrink-0">Revision</Label>
            <VersionSelect value={key} onChange={setKey} options={options} />
          </div>
          <div className="space-y-1.5">
            <Label>Criteria</Label>
            <ul className="divide-y rounded-lg border">
              {scenario.criteria.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-[13px] hover:bg-accent/40">
                    <Checkbox
                      className="mt-0.5"
                      checked={passed.has(c.id)}
                      onCheckedChange={(v) =>
                        setPassed((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                    <span className="leading-relaxed">{c.text}</span>
                  </label>
                </li>
              ))}
              {scenario.criteria.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">This scenario has no criteria. Edit it to add some.</li>}
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="run-notes">Notes</Label>
            <Textarea id="run-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened? Which model or agent did you use?" />
          </div>
        </div>
        <DialogFooter className="items-center">
          <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
            Result <OutcomeBadge outcome={outcome} />
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!scenario.criteria.length}>
            Save outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SimulateDialog({ open, onOpenChange, scenario, revisions }: RunDialogProps) {
  const repo = useRepository();
  const { key, setKey, revision, options } = useRevisionPicker(open, revisions);
  const results = useMemo(() => (revision ? simulateCriteria(scenario.criteria, revision.instructions) : []), [revision, scenario.criteria]);
  const outcome = outcomeFor(results);

  const save = async () => {
    await repo.addRun({
      scenarioId: scenario.id,
      version: fromKey(key),
      mode: 'simulated',
      outcome,
      results: results.map(({ criterionId, passed }) => ({ criterionId, passed })),
      notes: 'Keyword coverage heuristic. No agent was executed.',
    });
    toast.success('Simulated result saved', { description: 'It is labeled as simulated in the history.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Simulated check <SourceLabel kind="simulated" />
          </DialogTitle>
          <DialogDescription>A quick static estimate of whether the instructions cover each criterion.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2.5 rounded-lg border border-dashed border-warn/40 bg-warn/5 p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-warn" />
          <p>
            <span className="font-medium text-foreground">This does not run an agent.</span> It checks whether the instructions at the chosen revision mention at least half of each
            criterion's key terms. Use it as a coverage hint, and record real outcomes manually.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="w-20 shrink-0">Revision</Label>
          <VersionSelect value={key} onChange={setKey} options={options} />
        </div>
        <ul className="divide-y rounded-lg border">
          {scenario.criteria.map((c) => {
            const r = results.find((x) => x.criterionId === c.id);
            const pct = Math.round((r?.coverage ?? 0) * 100);
            return (
              <li key={c.id} className="space-y-1.5 px-3 py-2.5">
                <div className="flex items-start gap-3 text-[13px]">
                  <span className="min-w-0 flex-1 leading-relaxed">{c.text}</span>
                  <span className={cn('shrink-0 font-mono text-xs tabular-nums', r?.passed ? 'text-ok' : 'text-err')}>{pct}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className={cn('h-full rounded-full transition-all duration-500', r?.passed ? 'bg-ok' : 'bg-err/70')} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <DialogFooter className="items-center">
          <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
            Estimate <OutcomeBadge outcome={outcome} />
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={save} disabled={!scenario.criteria.length || !revision}>
            Save to history
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
