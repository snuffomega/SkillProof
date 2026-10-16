import { useMemo, useState } from 'react';
import { ChevronDown, FolderClosed, Plus, Search, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HealthPill, StatusBadge } from '@/components/common';
import { skillStatus } from '@/domain/versioning';
import type { PublishStatus, Skill } from '@/domain/types';
import { useUI } from '@/store/ui';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | PublishStatus | 'issues';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'modified', label: 'Edited' },
  { id: 'published', label: 'Published' },
  { id: 'issues', label: 'Errors' },
];

interface SkillListProps {
  skills: Skill[];
  selectedId?: string;
  issueMap: Map<string, { errors: number; warnings: number }>;
  className?: string;
}

export function SkillList({ skills, selectedId, issueMap, className }: SkillListProps) {
  const navigate = useUI((s) => s.navigate);
  const openDialog = useUI((s) => s.openDialog);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => [...new Set(skills.flatMap((s) => s.tags))].sort(), [skills]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = skills.filter((s) => {
      if (tag && !s.tags.includes(tag)) return false;
      if (status === 'issues' && !issueMap.get(s.id)?.errors) return false;
      if (status !== 'all' && status !== 'issues' && skillStatus(s) !== status) return false;
      if (!q) return true;
      return [s.name, s.description, s.folder, ...s.tags].some((v) => v.toLowerCase().includes(q)) || s.content.toLowerCase().includes(q);
    });
    const map = new Map<string, Skill[]>();
    for (const s of filtered.sort((a, b) => (a.name || '~').localeCompare(b.name || '~'))) {
      const key = s.folder || 'Unsorted';
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === 'Unsorted' ? 1 : b === 'Unsorted' ? -1 : a.localeCompare(b)));
  }, [skills, query, status, tag, issueMap]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  const toggle = (folder: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });

  return (
    <aside className={cn('flex min-h-0 w-full shrink-0 flex-col border-r bg-surface/40 lg:w-[320px]', className)}>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <h1 className="flex-1 text-[15px] font-semibold">Skill Library</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => openDialog('import')} aria-label="Import skills">
              <Upload />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import skills</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={() => openDialog('new-skill')}>
          <Plus /> New
        </Button>
      </div>

      <div className="space-y-2.5 border-b px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, tags, instructions…" className="pl-8 pr-8" aria-label="Search skills" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatus(f.id)}
              className={cn(
                'h-6 rounded-md px-2 text-[11.5px] transition-colors',
                status === f.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 pb-0.5">
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? null : t)}
                className={cn(
                  'h-5 shrink-0 rounded border px-1.5 font-mono text-[10.5px] transition-colors',
                  tag === t ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-1.5">
        {total === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">{skills.length ? 'No skills match these filters.' : 'No skills yet.'}</p>}
        {groups.map(([folder, list]) => (
          <section key={folder} className="mb-1">
            <button onClick={() => toggle(folder)} className="flex w-full items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ChevronDown className={cn('size-3 transition-transform', collapsed.has(folder) && '-rotate-90')} />
              <FolderClosed className="size-3" />
              <span className="flex-1 text-left">{folder}</span>
              <span className="tabular-nums">{list.length}</span>
            </button>
            {!collapsed.has(folder) && (
              <ul className="px-1.5">
                {list.map((s) => {
                  const health = issueMap.get(s.id);
                  const active = s.id === selectedId;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => navigate({ view: 'library', skillId: s.id, tab: 'edit' })}
                        className={cn(
                          'group w-full rounded-md px-2.5 py-2 text-left transition-colors',
                          active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn('min-w-0 flex-1 truncate font-mono text-[12.5px]', !s.name && 'italic text-muted-foreground')}>{s.name || 'unnamed-skill'}</span>
                          <HealthPill errors={health?.errors ?? 0} warnings={health?.warnings ?? 0} className={cn(!health?.errors && !health?.warnings && 'hidden')} />
                          <StatusBadge status={skillStatus(s)} version={s.publishedVersion} className="h-[18px] px-1.5 text-[10px]" />
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.description || 'No description'}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}
