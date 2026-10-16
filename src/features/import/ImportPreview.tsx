import { useState } from 'react';
import { ChevronRight, Layers, Paperclip } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ParsedBundle } from '@/domain/bundle';
import type { SkillCandidate } from '@/domain/importers';
import type { SkillSourceKind } from '@/domain/types';
import type { DuplicateStrategy } from '@/services/import-service';
import { cn } from '@/lib/utils';

export type PreviewState =
  | { type: 'bundle'; bundle: ParsedBundle; skipped: string[] }
  | { type: 'skills'; candidates: SkillCandidate[]; selected: Set<string>; skipped: string[]; kind: SkillSourceKind; ref?: string };

const STRATEGIES: { id: DuplicateStrategy; label: string; hint: string }[] = [
  { id: 'skip', label: 'Keep existing', hint: 'Use the skill already in your library' },
  { id: 'overwrite', label: 'Overwrite draft', hint: 'Replace the draft; published versions stay' },
  { id: 'copy', label: 'Import as copy', hint: 'Add with a -copy suffix' },
];

interface Props {
  preview: PreviewState;
  onChange: (p: PreviewState) => void;
  existingNames: Set<string>;
  strategy: DuplicateStrategy;
  onStrategy: (s: DuplicateStrategy) => void;
}

export function ImportPreview({ preview, onChange, existingNames, strategy, onStrategy }: Props) {
  const [showSkipped, setShowSkipped] = useState(false);
  const rows: SkillCandidate[] = preview.type === 'bundle' ? preview.bundle.skills : preview.candidates;
  const duplicates = rows.filter((c) => c.name && existingNames.has(c.name)).length;

  const toggle = (key: string) => {
    if (preview.type !== 'skills') return;
    const selected = new Set(preview.selected);
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    onChange({ ...preview, selected });
  };

  const toggleAll = () => {
    if (preview.type !== 'skills') return;
    const all = preview.selected.size === preview.candidates.length;
    onChange({ ...preview, selected: new Set(all ? [] : preview.candidates.map((c) => c.key)) });
  };

  return (
    <div className="space-y-4">
      {preview.type === 'bundle' && (
        <div className="flex items-start gap-3 rounded-xl border bg-surface p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{preview.bundle.manifest.stack.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Stack bundle · {preview.bundle.manifest.stack.nodes.length} nodes · {preview.bundle.manifest.stack.edges.length} connections · contract included
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-2.5 border-b bg-surface px-3 py-2 text-xs text-muted-foreground">
          {preview.type === 'skills' && <Checkbox checked={preview.selected.size === preview.candidates.length} onCheckedChange={toggleAll} aria-label="Select all" />}
          <span className="flex-1">
            {rows.length} skill{rows.length === 1 ? '' : 's'} found
          </span>
          {duplicates > 0 && <span className="text-warn">{duplicates} already in library</span>}
        </div>
        <ul className="scrollbar-thin max-h-56 divide-y overflow-y-auto">
          {rows.map((c) => {
            const dup = !!c.name && existingNames.has(c.name);
            return (
              <li key={c.key}>
                <label className={cn('flex items-start gap-2.5 px-3 py-2', preview.type === 'skills' && 'cursor-pointer hover:bg-accent/40')}>
                  {preview.type === 'skills' && <Checkbox className="mt-0.5" checked={preview.selected.has(c.key)} onCheckedChange={() => toggle(c.key)} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs font-medium">{c.name || c.key || 'unnamed'}</span>
                      {dup && <span className="rounded border border-warn/30 px-1 text-[10.5px] text-warn">duplicate</span>}
                      {c.files.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <Paperclip className="size-3" />
                          {c.files.length}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[11.5px] text-muted-foreground">{c.description || 'No description'}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {duplicates > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-xs font-medium">When a skill with the same name exists</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onStrategy(s.id)}
                aria-pressed={strategy === s.id}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent/40',
                  strategy === s.id && 'border-primary bg-primary/5 ring-1 ring-primary/40',
                )}
              >
                <span className="block text-xs font-medium">{s.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{s.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {preview.skipped.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <button type="button" onClick={() => setShowSkipped((v) => !v)} className="flex items-center gap-1 hover:text-foreground">
            <ChevronRight className={cn('size-3.5 transition-transform', showSkipped && 'rotate-90')} />
            {preview.skipped.length} file{preview.skipped.length === 1 ? '' : 's'} skipped (binary or too large)
          </button>
          {showSkipped && (
            <ul className="scrollbar-thin mt-1.5 max-h-28 overflow-y-auto rounded-md bg-surface-2 p-2 font-mono text-[11px]">
              {preview.skipped.map((p) => (
                <li key={p} className="truncate">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
