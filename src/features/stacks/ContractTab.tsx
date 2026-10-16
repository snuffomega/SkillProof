import { Goal, ListChecks, PackageCheck, Plus, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SeverityIcon } from '@/components/common';
import { useRepository } from '@/data/hooks';
import type { Contract, ContractItem, Issue, Skill, Stack } from '@/domain/types';
import { uid } from '@/lib/id';
import { CommitInput, CommitTextarea } from '@/features/shared/fields';
import { cn } from '@/lib/utils';

const NONE = '__none';

type ListKey = 'goals' | 'expectations' | 'standards';

const LIST_SECTIONS: { key: ListKey; title: string; hint: string; placeholder: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'goals', title: 'Goals', hint: 'The outcomes this stack exists to achieve.', placeholder: 'e.g. Ship features users can trust on day one', icon: Goal },
  { key: 'expectations', title: 'Expectations', hint: 'What stakeholders can count on, regardless of how agents get there.', placeholder: 'e.g. Every change ships with a rollback plan', icon: ListChecks },
  { key: 'standards', title: 'Quality standards', hint: 'The bar reviewers hold the final result to.', placeholder: 'e.g. No high-severity findings left open', icon: ShieldCheck },
];

export function ContractTab({ stack, issues, skillsById }: { stack: Stack; issues: Issue[]; skillsById: Map<string, Skill> }) {
  const repo = useRepository();
  const c = stack.contract;
  const save = (contract: Contract) => repo.updateStack(stack.id, { contract });
  const contractIssues = issues.filter((i) => i.target.type === 'contract');
  const issuesFor = (section: keyof Contract, itemId?: string) =>
    contractIssues.filter((i) => i.target.type === 'contract' && i.target.section === section && (itemId === undefined ? !i.target.itemId : i.target.itemId === itemId));

  const nodeOptions = stack.nodes.map((n) => ({ id: n.id, label: skillsById.get(n.skillId)?.name || 'missing skill', role: n.role }));

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Workflow contract</p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">What “done” means for {stack.name}</h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Contracts set the destination and the bar, and where a human signs off. They deliberately say nothing about the steps agents take to get there.
          </p>
        </header>

        <div className="space-y-6">
          {LIST_SECTIONS.map((s) => (
            <ItemListSection
              key={s.key}
              {...s}
              items={c[s.key]}
              sectionIssues={issuesFor(s.key)}
              onChange={(items) => save({ ...c, [s.key]: items })}
            />
          ))}

          <Card icon={UserCheck} title="Approval checkpoints" hint="Moments where a named person reviews before work continues." issues={issuesFor('checkpoints')}>
            {c.checkpoints.length > 0 && (
              <ul className="divide-y">
                {c.checkpoints.map((cp) => {
                  const itemIssues = issuesFor('checkpoints', cp.id);
                  return (
                    <li key={cp.id} className={cn('grid gap-2 px-4 py-3 sm:grid-cols-[1fr_180px_150px_auto] sm:items-center', itemIssues.length && 'bg-warn/5')}>
                      <CommitInput value={cp.title} aria-label="Checkpoint" placeholder="e.g. Spec sign-off" onCommit={(title) => save({ ...c, checkpoints: c.checkpoints.map((x) => (x.id === cp.id ? { ...x, title } : x)) })} />
                      <NodeSelect
                        value={cp.afterNodeId}
                        options={nodeOptions}
                        placeholder="After skill…"
                        onChange={(afterNodeId) => save({ ...c, checkpoints: c.checkpoints.map((x) => (x.id === cp.id ? { ...x, afterNodeId } : x)) })}
                      />
                      <CommitInput value={cp.approver} aria-label="Approver" placeholder="Approver" onCommit={(approver) => save({ ...c, checkpoints: c.checkpoints.map((x) => (x.id === cp.id ? { ...x, approver } : x)) })} />
                      <RemoveButton onClick={() => save({ ...c, checkpoints: c.checkpoints.filter((x) => x.id !== cp.id) })} />
                      <ItemIssues issues={itemIssues} className="sm:col-span-4" />
                    </li>
                  );
                })}
              </ul>
            )}
            <AddRow label="Add checkpoint" onClick={() => save({ ...c, checkpoints: [...c.checkpoints, { id: uid('cp'), title: '', afterNodeId: null, approver: '' }] })} />
          </Card>

          <Card icon={PackageCheck} title="Required outputs" hint="Artifacts the stack must hand back, and which skill is accountable for each." issues={issuesFor('outputs')}>
            {c.outputs.length > 0 && (
              <ul className="divide-y">
                {c.outputs.map((o) => {
                  const itemIssues = issuesFor('outputs', o.id);
                  return (
                    <li key={o.id} className={cn('grid gap-2 px-4 py-3 sm:grid-cols-[1fr_200px_auto]', itemIssues.length && 'bg-warn/5')}>
                      <div className="space-y-2">
                        <CommitInput value={o.name} aria-label="Output name" placeholder="e.g. Release notes" className="font-medium" onCommit={(name) => save({ ...c, outputs: c.outputs.map((x) => (x.id === o.id ? { ...x, name } : x)) })} />
                        <CommitTextarea
                          value={o.description}
                          rows={2}
                          aria-label="Output description"
                          placeholder="What a complete version of this artifact contains"
                          onCommit={(description) => save({ ...c, outputs: c.outputs.map((x) => (x.id === o.id ? { ...x, description } : x)) })}
                        />
                      </div>
                      <NodeSelect value={o.producedBy} options={nodeOptions} placeholder="Produced by…" onChange={(producedBy) => save({ ...c, outputs: c.outputs.map((x) => (x.id === o.id ? { ...x, producedBy } : x)) })} />
                      <RemoveButton onClick={() => save({ ...c, outputs: c.outputs.filter((x) => x.id !== o.id) })} />
                      <ItemIssues issues={itemIssues} className="sm:col-span-3" />
                    </li>
                  );
                })}
              </ul>
            )}
            <AddRow label="Add required output" onClick={() => save({ ...c, outputs: [...c.outputs, { id: uid('out'), name: '', description: '', producedBy: null }] })} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, hint, issues, children }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; issues: Issue[]; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-surface">
      <header className="flex items-start gap-3 border-b px-4 py-3">
        <Icon className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </header>
      {issues.length > 0 && <ItemIssues issues={issues} className="border-b px-4 py-2" />}
      {children}
    </section>
  );
}

function ItemListSection({ title, hint, placeholder, icon, items, sectionIssues, onChange }: (typeof LIST_SECTIONS)[number] & { items: ContractItem[]; sectionIssues: Issue[]; onChange: (items: ContractItem[]) => void }) {
  return (
    <Card icon={icon} title={title} hint={hint} issues={sectionIssues}>
      {items.length > 0 && (
        <ol className="divide-y">
          {items.map((item, i) => (
            <li key={item.id} className="group flex items-center gap-2 px-4 py-2">
              <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <CommitInput
                value={item.text}
                aria-label={`${title} ${i + 1}`}
                placeholder={placeholder}
                className="border-transparent bg-transparent shadow-none hover:border-border focus-visible:border-input"
                onCommit={(text) => onChange(items.map((x) => (x.id === item.id ? { ...x, text } : x)))}
              />
              <RemoveButton onClick={() => onChange(items.filter((x) => x.id !== item.id))} />
            </li>
          ))}
        </ol>
      )}
      <AddRow label={`Add ${title.toLowerCase().replace(/s$/, '')}`} onClick={() => onChange([...items, { id: uid('ci'), text: '' }])} />
    </Card>
  );
}

function NodeSelect({ value, options, placeholder, onChange }: { value: string | null; options: { id: string; label: string; role: string }[]; placeholder: string; onChange: (v: string | null) => void }) {
  const exists = value && options.some((o) => o.id === value);
  return (
    <Select value={exists ? value! : NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="text-xs" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} className="text-xs text-muted-foreground">
          {placeholder.replace('…', '')}: none
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id} className="text-xs">
            <span className="font-mono">{o.label}</span>
            {o.role && <span className="ml-1.5 text-muted-foreground">{o.role}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label="Remove" className="shrink-0 text-muted-foreground hover:text-err sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 [li:hover_&]:opacity-100">
      <Trash2 />
    </Button>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 border-t border-dashed px-4 py-2.5 text-xs text-muted-foreground transition-colors first:border-t-0 hover:bg-accent/40 hover:text-foreground">
      <Plus className="size-3.5" /> {label}
    </button>
  );
}

function ItemIssues({ issues, className }: { issues: Issue[]; className?: string }) {
  if (!issues.length) return null;
  return (
    <ul className={cn('space-y-1', className)}>
      {issues.map((i) => (
        <li key={i.id} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <SeverityIcon severity={i.severity} className="size-3" />
          {i.message}
        </li>
      ))}
    </ul>
  );
}

