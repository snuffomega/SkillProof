import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, History, Lock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, StatusBadge } from '@/components/common';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRepository } from '@/data/hooks';
import { skillStatus } from '@/domain/versioning';
import type { Skill, SkillFile, SkillVersion } from '@/domain/types';
import { formatDate, relativeTime } from '@/lib/format';
import { DiffView } from '@/features/versions/DiffView';
import { VersionSelect } from '@/features/versions/VersionSelect';
import { cn } from '@/lib/utils';

const DRAFT = 'draft';

interface Snapshot {
  label: string;
  content: string;
  files: SkillFile[];
}

export function SkillVersionsTab({ skill, versions, draft }: { skill: Skill; versions: SkillVersion[]; draft: string }) {
  const repo = useRepository();
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const [base, setBase] = useState<string>(sorted[0]?.id ?? DRAFT);
  const [target, setTarget] = useState<string>(DRAFT);
  const [confirm, confirmNode] = useConfirm();

  if (!sorted.length)
    return (
      <EmptyState icon={History} title="Not published yet">
        Publishing freezes the current SKILL.md and its files as an immutable v1. Later edits stay in the draft until you publish again.
      </EmptyState>
    );

  const resolve = (id: string): Snapshot => {
    const v = sorted.find((x) => x.id === id);
    return v ? { label: `v${v.version}`, content: v.content, files: v.files } : { label: 'Working draft', content: draft, files: skill.files };
  };
  const a = resolve(base);
  const b = resolve(target);
  const fileChanges = diffFiles(a.files, b.files);

  const restore = (v: SkillVersion) =>
    confirm({
      title: `Restore v${v.version} into the draft?`,
      description: 'The working draft is replaced with this snapshot. Published versions are never changed, and you can publish again afterwards.',
      confirmLabel: 'Restore',
      onConfirm: async () => {
        await repo.restoreSkillVersion(v.id);
        toast.success(`Draft restored from v${v.version}`);
        setBase(v.id);
        setTarget(DRAFT);
      },
    });

  const options = [{ id: DRAFT, label: 'Working draft' }, ...sorted.map((v) => ({ id: v.id, label: `v${v.version} · ${formatDate(v.publishedAt)}` }))];

  return (
    <div className="flex h-full min-h-0">
      <aside className="scrollbar-thin w-72 shrink-0 overflow-y-auto border-r">
        <div className="px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">History</div>
        <ol className="relative px-4 pb-4">
          <span className="absolute bottom-6 left-[22px] top-3 w-px bg-border" aria-hidden />
          <li className="relative flex gap-3 pb-4">
            <span className="relative z-10 mt-1 size-3 shrink-0 rounded-full border-2 border-warn bg-background" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                Working draft <StatusBadge status={skillStatus(skill)} version={skill.publishedVersion} />
              </div>
              <p className="text-xs text-muted-foreground">Edited {relativeTime(skill.updatedAt)}</p>
            </div>
          </li>
          {sorted.map((v) => (
            <li key={v.id} className="group relative flex gap-3 pb-4">
              <span className="relative z-10 mt-1 grid size-3 shrink-0 place-items-center rounded-full bg-ok">
                <Lock className="size-[7px] text-background" />
              </span>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => {
                    setBase(v.id);
                    setTarget(DRAFT);
                  }}
                  className={cn('text-left text-[13px] font-medium hover:text-primary', base === v.id && 'text-primary')}
                >
                  v{v.version}
                </button>
                <p className="text-xs text-muted-foreground">{formatDate(v.publishedAt)}</p>
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
        <div className="space-y-4 p-5">
          <DiffView before={a.content} after={b.content} title={`SKILL.md  ${a.label} → ${b.label}`} />
          {fileChanges.map((c) =>
            c.type === 'changed' ? (
              <DiffView key={c.path} before={c.before} after={c.after} title={c.path} />
            ) : (
              <div key={c.path} className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 font-mono text-xs">
                <span className={c.type === 'added' ? 'text-ok' : 'text-err'}>{c.type === 'added' ? '+ added' : '− removed'}</span>
                {c.path}
              </div>
            ),
          )}
        </div>
      </div>
      {confirmNode}
    </div>
  );
}

type FileChange = { type: 'added' | 'removed'; path: string } | { type: 'changed'; path: string; before: string; after: string };

function diffFiles(before: SkillFile[], after: SkillFile[]): FileChange[] {
  const b = new Map(before.map((f) => [f.path, f.content]));
  const a = new Map(after.map((f) => [f.path, f.content]));
  const out: FileChange[] = [];
  a.forEach((content, path) => {
    if (!b.has(path)) out.push({ type: 'added', path });
    else if (b.get(path) !== content) out.push({ type: 'changed', path, before: b.get(path)!, after: content });
  });
  b.forEach((_, path) => !a.has(path) && out.push({ type: 'removed', path }));
  return out;
}
