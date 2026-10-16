import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, History, Lock, Minus, Pencil, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StatusBadge } from '@/components/common';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRepository } from '@/data/hooks';
import { diffStacks, stackStatus, type StackChange, type StackShape } from '@/domain/versioning';
import type { Skill, Stack, StackVersion } from '@/domain/types';
import { formatDate, relativeTime } from '@/lib/format';
import { DiffView } from '@/features/versions/DiffView';
import { VersionSelect } from '@/features/versions/VersionSelect';
import { cn } from '@/lib/utils';

const DRAFT = 'draft';

interface Side extends StackShape {
  label: string;
  skillContent: Map<string, { name: string; content: string }>;
}

export function StackVersionsTab({ stack, versions, skillsById }: { stack: Stack; versions: StackVersion[]; skillsById: Map<string, Skill> }) {
  const repo = useRepository();
  const sorted = useMemo(() => [...versions].sort((a, b) => b.version - a.version), [versions]);
  const [base, setBase] = useState<string>(sorted[0]?.id ?? DRAFT);
  const [target, setTarget] = useState<string>(DRAFT);
  const [confirm, confirmNode] = useConfirm();

  const resolve = (id: string): Side => {
    const v = sorted.find((x) => x.id === id);
    if (v) return { label: `v${v.version}`, nodes: v.nodes, edges: v.edges, contract: v.contract, skillContent: new Map(v.skills.map((s) => [s.skillId, { name: s.name, content: s.content }])) };
    const skillContent = new Map<string, { name: string; content: string }>();
    stack.nodes.forEach((n) => {
      const s = skillsById.get(n.skillId);
      if (s) skillContent.set(s.id, { name: s.name, content: s.content });
    });
    return { label: 'Working draft', nodes: stack.nodes, edges: stack.edges, contract: stack.contract, skillContent };
  };

  if (!sorted.length)
    return (
      <EmptyState icon={History} title="Not published yet">
        Publishing captures the graph, the contract and the exact contents of every skill in it as an immutable snapshot you can compare and restore later.
      </EmptyState>
    );

  const a = resolve(base);
  const b = resolve(target);
  const nameOf = (id: string) => skillsById.get(id)?.name || a.skillContent.get(id)?.name || b.skillContent.get(id)?.name || 'deleted skill';
  const changes = diffStacks(a, b, nameOf);
  const contentChanges = [...b.skillContent.entries()].filter(([id, s]) => a.skillContent.has(id) && a.skillContent.get(id)!.content !== s.content);

  const restore = (v: StackVersion) =>
    confirm({
      title: `Restore v${v.version} into the draft?`,
      description: 'The graph and contract are replaced with this snapshot. Skills that were deleted since are recreated from the snapshot; existing skills keep their current drafts.',
      confirmLabel: 'Restore',
      onConfirm: async () => {
        await repo.restoreStackVersion(v.id);
        toast.success(`Draft restored from v${v.version}`);
        setBase(v.id);
        setTarget(DRAFT);
      },
    });

  const options = [{ id: DRAFT, label: 'Working draft' }, ...sorted.map((v) => ({ id: v.id, label: `v${v.version} · ${formatDate(v.publishedAt)}` }))];

  return (
    <div className="flex h-full min-h-0">
      <aside className="scrollbar-thin hidden w-72 shrink-0 overflow-y-auto border-r md:block">
        <div className="px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">History</div>
        <ol className="relative px-4 pb-4">
          <span className="absolute bottom-6 left-[22px] top-3 w-px bg-border" aria-hidden />
          <li className="relative flex gap-3 pb-4">
            <span className="relative z-10 mt-1 size-3 shrink-0 rounded-full border-2 border-warn bg-background" />
            <div>
              <div className="flex items-center gap-2 text-[13px] font-medium">
                Working draft <StatusBadge status={stackStatus(stack)} version={stack.publishedVersion} />
              </div>
              <p className="text-xs text-muted-foreground">Edited {relativeTime(stack.updatedAt)}</p>
            </div>
          </li>
          {sorted.map((v) => (
            <li key={v.id} className="relative flex gap-3 pb-4">
              <span className="relative z-10 mt-1 grid size-3 shrink-0 place-items-center rounded-full bg-ok">
                <Lock className="size-[7px] text-background" />
              </span>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => {
                    setBase(v.id);
                    setTarget(DRAFT);
                  }}
                  className={cn('text-[13px] font-medium hover:text-primary', base === v.id && 'text-primary')}
                >
                  v{v.version}
                </button>
                <p className="text-xs text-muted-foreground">
                  {formatDate(v.publishedAt)} · {v.nodes.length} skills · {v.edges.length} connections
                </p>
                {v.note && <p className="mt-1 text-xs leading-relaxed text-foreground/80">{v.note}</p>}
                <Button variant="ghost" size="sm" className="-ml-2 mt-1 h-6 text-[11.5px]" onClick={() => restore(v)}>
                  <RotateCcw /> Restore to draft
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </aside>

      <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/90 px-5 py-2.5 backdrop-blur">
          <span className="text-xs text-muted-foreground">Compare</span>
          <VersionSelect value={base} onChange={setBase} options={options} />
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <VersionSelect value={target} onChange={setTarget} options={options} />
        </div>
        <div className="space-y-6 p-5">
          <ChangeList changes={changes} />
          {contentChanges.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Skill instructions changed</h3>
              {contentChanges.map(([id, s]) => (
                <DiffView key={id} before={a.skillContent.get(id)!.content} after={s.content} title={`${s.name}/SKILL.md`} />
              ))}
            </section>
          )}
        </div>
      </div>
      {confirmNode}
    </div>
  );
}

const AREA_LABEL: Record<StackChange['area'], string> = { skill: 'Skills', connection: 'Connections', contract: 'Contract' };

function ChangeList({ changes }: { changes: StackChange[] }) {
  if (!changes.length) return <p className="rounded-lg border bg-surface px-4 py-6 text-center text-xs text-muted-foreground">No structural differences between these revisions.</p>;
  const areas = (['skill', 'connection', 'contract'] as const).filter((a) => changes.some((c) => c.area === a));
  return (
    <div className="space-y-4">
      {areas.map((area) => (
        <section key={area}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{AREA_LABEL[area]}</h3>
          <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
            {changes
              .filter((c) => c.area === area)
              .map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 px-3 py-2 text-[13px]">
                  {c.type === 'added' ? <Plus className="mt-0.5 size-3.5 text-ok" /> : c.type === 'removed' ? <Minus className="mt-0.5 size-3.5 text-err" /> : <Pencil className="mt-0.5 size-3.5 text-warn" />}
                  <span className={cn(c.type === 'removed' && 'text-muted-foreground line-through decoration-err/40')}>{c.text}</span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
