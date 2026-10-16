import { useMemo, useState } from 'react';
import { GitCompareArrows, Search } from 'lucide-react';
import { EmptyState } from '@/components/common';
import type { Landscape, LandscapeKind, TrustLevel } from '@/domain/landscape';
import { LANDSCAPE_KIND_META, TRUST_META } from '@/domain/landscape';
import type { Skill } from '@/domain/types';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/ui';

const KIND_FILTERS: { id: LandscapeKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'complement', label: 'Complements' },
  { id: 'overlap', label: 'Overlaps' },
  { id: 'conflict', label: 'Conflicts' },
  { id: 'handoff', label: 'Handoffs' },
  { id: 'depends', label: 'Depends' },
  { id: 'shared-policy', label: 'Shared policy' },
];

const TRUST_FILTERS: { id: TrustLevel | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'verified', label: 'Verified' },
  { id: 'inferred', label: 'Inferred' },
  { id: 'manual', label: 'Manual' },
];

export function RelationshipList({ landscape, skills }: { landscape: Landscape; skills: Skill[] }) {
  const navigate = useUI((s) => s.navigate);
  const skillsById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const [kindFilter, setKindFilter] = useState<LandscapeKind | 'all'>('all');
  const [trustFilter, setTrustFilter] = useState<TrustLevel | 'all'>('all');
  const [query, setQuery] = useState('');

  if (landscape.relationships.length === 0) {
    return (
      <EmptyState icon={GitCompareArrows} title="No relationships detected">
        Import more skills with richer content so their connections can be verified or inferred.
      </EmptyState>
    );
  }

  const q = query.trim().toLowerCase();
  const rels = landscape.relationships
    .filter((r) => kindFilter === 'all' || r.kind === kindFilter)
    .filter((r) => trustFilter === 'all' || r.trust === trustFilter)
    .filter((r) => {
      if (!q) return true;
      const a = skillsById.get(r.source)?.name ?? '';
      const b = skillsById.get(r.target)?.name ?? '';
      return a.includes(q) || b.includes(q) || r.reason.toLowerCase().includes(q);
    });

  const nameOf = (id: string) => skillsById.get(id)?.name ?? 'Deleted skill';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills or reasons"
            aria-label="Search relationships"
            className="h-8 w-full rounded-md bg-surface-2 pl-8 pr-3 text-[13px] outline-none ring-ring/50 focus:ring-2"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setKindFilter(f.id)}
              className={cn(
                'rounded-md px-2 py-1 text-[11.5px] transition-colors',
                kindFilter === f.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {TRUST_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTrustFilter(f.id)}
              className={cn(
                'rounded-md px-2 py-1 text-[11.5px] transition-colors',
                trustFilter === f.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        <ul className="mx-auto max-w-3xl space-y-2">
          {rels.map((r) => {
            const meta = LANDSCAPE_KIND_META[r.kind];
            const trust = TRUST_META[r.trust];
            return (
              <li key={r.id} className="rounded-xl border bg-surface p-3.5">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                  <span className="text-[12px] font-medium" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className={cn('rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide', trust.cls)}>{trust.label}</span>
                  {r.trust === 'inferred' && <span className="text-[10.5px] tabular-nums text-muted-foreground">{Math.round(r.confidence * 100)}%</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => navigate({ view: 'library', skillId: r.source, tab: 'edit' })}
                    className="truncate font-mono text-[12.5px] font-medium hover:text-primary"
                  >
                    {nameOf(r.source)}
                  </button>
                  <span className="shrink-0 text-muted-foreground" style={{ color: meta.color }}>
                    {meta.verb}
                  </span>
                  <button
                    onClick={() => navigate({ view: 'library', skillId: r.target, tab: 'edit' })}
                    className="truncate font-mono text-[12.5px] font-medium hover:text-primary"
                  >
                    {nameOf(r.target)}
                  </button>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{r.reason}</p>
              </li>
            );
          })}
          {rels.length === 0 && <li className="py-8 text-center text-xs text-muted-foreground">No relationships match your filters.</li>}
        </ul>
      </div>
    </div>
  );
}
