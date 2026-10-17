import { FileText, Pencil, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common';
import { LANDSCAPE_KIND_META, TRUST_META, relationshipsForSkill, type Landscape } from '@/domain/landscape';
import { skillStatus } from '@/domain/versioning';
import { extractHeadings } from '@/domain/skill-markdown';
import type { Skill } from '@/domain/types';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/ui';

interface Props {
  skill: Skill;
  landscape: Landscape;
  areaColors: Map<string, string>;
  skills: Skill[];
  onClose: () => void;
}

export function SkillPanel({ skill, landscape, areaColors, skills, onClose }: Props) {
  const navigate = useUI((s) => s.navigate);
  const status = skillStatus(skill);
  const areas = landscape.memberships.get(skill.id) ?? [];
  const rels = relationshipsForSkill(landscape, skill.id);
  const headings = extractHeadings(skill.content);
  const skillsById = new Map(skills.map((s) => [s.id, s]));

  const otherSkillName = (id: string) => skillsById.get(id)?.name ?? 'deleted skill';

  return (
    <div className="pointer-events-auto flex h-full w-[340px] flex-col border-l bg-surface shadow-2xl">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[13px] font-semibold">{skill.name || 'unnamed-skill'}</span>
            <StatusBadge status={status} version={skill.publishedVersion} />
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {skill.description && (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{skill.description}</p>
        )}

        {areas.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Work areas</h3>
            <div className="space-y-1.5">
              {areas.map((a) => {
                const color = areaColors.get(a.areaId) ?? 'var(--muted-foreground)';
                return (
                  <div key={a.areaId} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="flex-1 text-[12px]">{a.areaLabel}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(a.strength * 100)}%</span>
                    <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full" style={{ width: `${Math.round(a.strength * 100)}%`, background: color }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {headings.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sections</h3>
            <ul className="space-y-0.5">
              {headings.map((h, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <span className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  {h}
                </li>
              ))}
            </ul>
          </section>
        )}

        {skill.files.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Source files ({skill.files.length})
            </h3>
            <ul className="space-y-0.5">
              {skill.files.map((f, i) => (
                <li key={i} className="truncate font-mono text-[11.5px] text-muted-foreground">{f.path}</li>
              ))}
            </ul>
          </section>
        )}

        {rels.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Connections ({rels.length})
            </h3>
            <ul className="space-y-2">
              {rels.map((r) => {
                const meta = LANDSCAPE_KIND_META[r.kind];
                const trust = TRUST_META[r.trust];
                const otherId = r.source === skill.id ? r.target : r.source;
                return (
                  <li key={r.id} className="rounded-lg border bg-surface-2/50 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                      <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                      <span className={cn('rounded border px-1 py-px text-[9.5px] font-medium uppercase tracking-wide', trust.cls)}>{trust.label}</span>
                    </div>
                    <button
                      onClick={() => navigate({ view: 'landscape', tab: 'map', skillId: otherId })}
                      className="mt-1.5 flex items-center gap-1 font-mono text-[11.5px] font-medium hover:text-primary"
                    >
                      {otherSkillName(otherId)}
                      <ArrowRight className="size-3" />
                    </button>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{r.reason}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {rels.length === 0 && areas.length === 0 && (
          <p className="text-[12px] italic text-muted-foreground">No work areas or connections detected for this skill.</p>
        )}
      </div>

      <div className="shrink-0 border-t p-3">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => navigate({ view: 'library', skillId: skill.id, tab: 'edit' })}
        >
          <Pencil className="size-3.5" /> Open in editor
        </Button>
      </div>
    </div>
  );
}
