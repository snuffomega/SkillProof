import { useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, Layers, Search } from 'lucide-react';
import { EmptyState } from '@/components/common';
import { StatusBadge } from '@/components/common';
import type { Landscape } from '@/domain/landscape';
import { skillStatus } from '@/domain/versioning';
import type { Skill } from '@/domain/types';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/ui';

interface Props {
  landscape: Landscape;
  skills: Skill[];
  areaId?: string;
}

export function AreaDetail({ landscape, skills, areaId }: Props) {
  const navigate = useUI((s) => s.navigate);
  const [query, setQuery] = useState('');
  const skillsById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const selectedArea = landscape.areas.find((a) => a.id === areaId);

  if (!selectedArea) {
    if (landscape.areas.length === 0) {
      return (
        <EmptyState icon={Layers} title="No work areas detected">
          Import more skills or improve their descriptions and tags so areas of responsibility can be detected.
        </EmptyState>
      );
    }

    const q = query.trim().toLowerCase();
    const areas = landscape.areas.filter((a) => !q || a.label.toLowerCase().includes(q) || a.members.some((m) => skillsById.get(m.skillId)?.name.includes(q)));

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter areas or skills"
              aria-label="Filter areas"
              className="h-8 w-full rounded-md bg-surface-2 pl-8 pr-3 text-[13px] outline-none ring-ring/50 focus:ring-2"
            />
          </div>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => {
              const memberNames = area.members.map((m) => skillsById.get(m.skillId)?.name).filter(Boolean) as string[];
              return (
                <button
                  key={area.id}
                  onClick={() => navigate({ view: 'landscape', tab: 'areas', areaId: area.id })}
                  className="group rounded-xl border bg-surface p-4 text-left transition-colors hover:border-foreground/25"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <h3 className="flex-1 text-[13px] font-semibold">{area.label}</h3>
                    <span className="text-xs tabular-nums text-muted-foreground">{area.members.length}</span>
                    <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-2 line-clamp-1 text-[11.5px] text-muted-foreground">
                    {memberNames.slice(0, 4).join(', ')}
                    {memberNames.length > 4 && ` +${memberNames.length - 4} more`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {area.keywords.slice(0, 5).map((k) => (
                      <span key={k} className="rounded bg-surface-2 px-1.5 py-px text-[10px] text-muted-foreground">
                        {k}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Area detail view
  const members = selectedArea.members.map((m) => ({ ...m, skill: skillsById.get(m.skillId) })).filter((m) => m.skill);
  const overlaps = selectedArea.overlapsWith
    .map((id) => landscape.areas.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const areaRels = landscape.relationships.filter(
    (r) => members.some((m) => m.skillId === r.source) && members.some((m) => m.skillId === r.target),
  );

  return (
    <div className="scrollbar-thin h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-4xl p-5">
        <button onClick={() => navigate({ view: 'landscape', tab: 'areas' })} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3 rotate-180" /> All areas
        </button>
        <h2 className="text-xl font-semibold tracking-tight">{selectedArea.label}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {members.length} skill{members.length === 1 ? '' : 's'} · {areaRels.length} internal relationship{areaRels.length === 1 ? '' : 's'}
          {overlaps.length > 0 && ` · overlaps with ${overlaps.length} area${overlaps.length === 1 ? '' : 's'}`}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectedArea.keywords.map((k) => (
            <span key={k} className="rounded bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">
              {k}
            </span>
          ))}
        </div>

        {overlaps.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Overlapping areas</h3>
            <div className="flex flex-wrap gap-2">
              {overlaps.map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate({ view: 'landscape', tab: 'areas', areaId: o.id })}
                  className="flex items-center gap-1.5 rounded-lg border bg-surface px-3 py-1.5 text-[12px] hover:border-foreground/25"
                >
                  <Layers className="size-3.5 text-muted-foreground" />
                  {o.label}
                  <span className="text-muted-foreground">{o.members.length}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Skills in this area</h3>
          <ul className="divide-y rounded-lg border">
            {members.map((m) => {
              const status = skillStatus(m.skill!);
              const skillAreas = landscape.memberships.get(m.skillId) ?? [];
              return (
                <li key={m.skillId}>
                  <button
                    onClick={() => navigate({ view: 'library', skillId: m.skillId, tab: 'edit' })}
                    className="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[12.5px] font-medium">{m.skill!.name}</span>
                        <StatusBadge status={status} version={m.skill!.publishedVersion} />
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11.5px] text-muted-foreground">{m.skill!.description || 'No description'}</p>
                      {skillAreas.length > 1 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {skillAreas
                            .filter((a) => a.areaId !== selectedArea.id)
                            .map((a) => (
                              <span key={a.areaId} className="rounded bg-surface-2 px-1 py-px text-[10px] text-muted-foreground">
                                {a.areaLabel}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <span className={cn('inline-block h-1.5 w-12 overflow-hidden rounded-full bg-surface-2')}>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(m.strength * 100)}%` }} />
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
