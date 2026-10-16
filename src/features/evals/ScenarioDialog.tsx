import { useEffect, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRepository, useSkills, useStacks } from '@/data/hooks';
import type { ContractItem, EvalTargetType, Scenario } from '@/domain/types';
import { uid } from '@/lib/id';

const scenarioSchema = z.object({
  title: z.string().trim().min(3, 'Give the scenario a title of at least 3 characters'),
  target: z.string().regex(/^(skill|stack):.+/, 'Choose the skill or stack under test'),
  input: z.string().trim().min(1, 'Describe the task the agent is given'),
  expected: z.string(),
  criteria: z.array(z.object({ id: z.string(), text: z.string().trim().min(1) })).min(1, 'Add at least one success criterion'),
});

interface ScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: Scenario;
  defaultTarget?: { type: EvalTargetType; id: string };
  onSaved?: (s: Scenario) => void;
}

export function ScenarioDialog({ open, onOpenChange, scenario, defaultTarget, onSaved }: ScenarioDialogProps) {
  const repo = useRepository();
  const skills = useSkills() ?? [];
  const stacks = useStacks() ?? [];
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [input, setInput] = useState('');
  const [expected, setExpected] = useState('');
  const [criteria, setCriteria] = useState<ContractItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(scenario?.title ?? '');
    const t = scenario ? { type: scenario.targetType, id: scenario.targetId } : defaultTarget;
    setTarget(t ? `${t.type}:${t.id}` : '');
    setInput(scenario?.input ?? '');
    setExpected(scenario?.expected ?? '');
    setCriteria(scenario?.criteria.length ? scenario.criteria : [{ id: uid('c'), text: '' }]);
    setError(null);
  }, [open, scenario, defaultTarget?.type, defaultTarget?.id]);

  const submit = async () => {
    const parsed = scenarioSchema.safeParse({ title, target, input, expected, criteria: criteria.filter((c) => c.text.trim()) });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const [type, ...rest] = parsed.data.target.split(':');
    const saved = await repo.saveScenario({
      id: scenario?.id,
      title: parsed.data.title,
      targetType: type as EvalTargetType,
      targetId: rest.join(':'),
      input: parsed.data.input,
      expected: parsed.data.expected.trim(),
      criteria: parsed.data.criteria.map((c) => ({ id: c.id, text: c.text.trim() })),
    });
    toast.success(scenario ? 'Scenario updated' : 'Scenario created');
    onOpenChange(false);
    onSaved?.(saved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{scenario ? 'Edit scenario' : 'New evaluation scenario'}</DialogTitle>
          <DialogDescription>Describe a realistic task and what a good result looks like. Criteria judge the outcome, not the steps the agent takes.</DialogDescription>
        </DialogHeader>
        <form
          className="scrollbar-thin -mx-1 max-h-[60vh] space-y-4 overflow-y-auto px-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sc-title">Title</Label>
              <Input id="sc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reviews a risky migration" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Under test</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger aria-label="Skill or stack under test">
                  <SelectValue placeholder="Choose skill or stack" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Stacks</SelectLabel>
                    {stacks.map((s) => (
                      <SelectItem key={s.id} value={`stack:${s.id}`}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Skills</SelectLabel>
                    {skills.map((s) => (
                      <SelectItem key={s.id} value={`skill:${s.id}`} className="font-mono text-xs">
                        {s.name || 'unnamed-skill'}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-input">Task given to the agent</Label>
            <Textarea id="sc-input" rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Review PR #418, which adds a nullable column and backfills 2M rows…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-expected">Expected outcome</Label>
            <Textarea id="sc-expected" rows={2} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Flags the locking backfill as blocking and proposes batching." />
          </div>
          <div className="space-y-1.5">
            <Label>Success criteria</Label>
            <ul className="space-y-1.5">
              {criteria.map((c, i) => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                  <Input
                    value={c.text}
                    onChange={(e) => setCriteria(criteria.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
                    placeholder="Observable property of a good result"
                    aria-label={`Criterion ${i + 1}`}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCriteria(criteria.filter((x) => x.id !== c.id))} aria-label="Remove criterion">
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCriteria([...criteria, { id: uid('c'), text: '' }])}>
              <Plus /> Add criterion
            </Button>
          </div>
          {error && <p className="text-xs text-err">{error}</p>}
          <button type="submit" hidden />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{scenario ? 'Save changes' : 'Create scenario'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
