import { useMemo, useState } from 'react';
import { Columns2, Eye, ListTree, PenLine, ShieldCheck, Workflow } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HealthPill, SourceLabel } from '@/components/common';
import { CodeEditor } from '@/components/CodeEditor';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { useRepository, useSkills } from '@/data/hooks';
import { extractHeadings, parseSkillMarkdown, readMeta, setFrontmatterField } from '@/domain/skill-markdown';
import { summarize } from '@/domain/validation';
import type { Issue, Skill, Stack } from '@/domain/types';
import { useUI } from '@/store/ui';
import { IssueList } from '@/features/shared/IssueList';
import { MetaField, TagInput } from '@/features/shared/fields';
import { cn } from '@/lib/utils';

type Mode = 'write' | 'split' | 'preview';

interface SkillEditorProps {
  skill: Skill;
  content: string;
  onChange: (content: string) => void;
  issues: Issue[];
  usedIn: Stack[];
}

export function SkillEditor({ skill, content, onChange, issues, usedIn }: SkillEditorProps) {
  const repo = useRepository();
  const skills = useSkills() ?? [];
  const [mode, setMode] = useState<Mode>('write');
  const meta = readMeta(content);
  const { frontmatterError } = parseSkillMarkdown(content);
  const folders = useMemo(() => [...new Set(skills.map((s) => s.folder).filter(Boolean))].sort(), [skills]);
  const allTags = useMemo(() => [...new Set(skills.flatMap((s) => s.tags))].sort(), [skills]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-1 gap-x-4 gap-y-3 border-b px-5 py-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <MetaField
              id="skill-name"
              value={meta.name}
              disabled={!!frontmatterError}
              onCommit={(v) => onChange(setFrontmatterField(content, 'name', v))}
              className="font-mono"
              placeholder="kebab-case-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-desc" className="text-xs text-muted-foreground">
              Description <span className="text-muted-foreground/60">— tells agents when to use this skill</span>
            </Label>
            <MetaField
              id="skill-desc"
              value={meta.description}
              disabled={!!frontmatterError}
              onCommit={(v) => onChange(setFrontmatterField(content, 'description', v))}
              placeholder="What it achieves and when it applies"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-folder" className="text-xs text-muted-foreground">
              Folder
            </Label>
            <MetaField id="skill-folder" list="skill-folders" value={skill.folder} onCommit={(v) => repo.updateSkill(skill.id, { folder: v.trim() })} placeholder="Unsorted" />
            <datalist id="skill-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <TagInput tags={skill.tags} suggestions={allTags} onChange={(tags) => repo.updateSkill(skill.id, { tags })} />
          </div>
          {frontmatterError && <p className="text-xs text-err md:col-span-2">Frontmatter can't be parsed ({frontmatterError}). Fix it in the source below to edit these fields.</p>}
        </div>

        <div className="flex h-10 shrink-0 items-center gap-3 border-b px-3">
          <ToggleGroup type="single" size="sm" value={mode} onValueChange={(v) => v && setMode(v as Mode)} aria-label="Editor mode">
            <ToggleGroupItem value="write" className="h-7 gap-1.5 px-2 text-xs">
              <PenLine className="size-3.5" /> Write
            </ToggleGroupItem>
            <ToggleGroupItem value="split" className="h-7 gap-1.5 px-2 text-xs">
              <Columns2 className="size-3.5" /> Split
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" className="h-7 gap-1.5 px-2 text-xs">
              <Eye className="size-3.5" /> Preview
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">SKILL.md · {content.split('\n').length} lines</span>
          <Popover>
            <PopoverTrigger className="rounded-md px-1.5 py-1 hover:bg-accent xl:hidden">
              <HealthPill {...summarize(issues)} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <ChecksPanel issues={issues} />
            </PopoverContent>
          </Popover>
        </div>

        <div className={cn('grid min-h-0 flex-1', mode === 'split' && 'grid-cols-2 divide-x')}>
          {mode !== 'preview' && <CodeEditor value={content} onChange={onChange} ariaLabel="SKILL.md source" className="h-full" />}
          {mode !== 'write' && (
            <div className="scrollbar-thin min-h-0 overflow-y-auto px-8 py-6">
              <MarkdownPreview content={content} className="mx-auto max-w-[68ch]" />
            </div>
          )}
        </div>
      </div>

      <aside className="scrollbar-thin hidden w-72 shrink-0 overflow-y-auto border-l bg-surface/40 xl:block">
        <ChecksPanel issues={issues} />
        <Outline content={content} />
        <UsedIn stacks={usedIn} />
      </aside>
    </div>
  );
}

function PanelTitle({ icon: Icon, children, extra }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3.5" />
      <span className="flex-1">{children}</span>
      {extra}
    </div>
  );
}

function ChecksPanel({ issues }: { issues: Issue[] }) {
  return (
    <section className="pb-2">
      <PanelTitle icon={ShieldCheck} extra={<SourceLabel kind="real" />}>
        Checks
      </PanelTitle>
      {issues.length === 0 ? (
        <p className="px-4 pb-2 text-xs text-ok">Structure, frontmatter and references all pass.</p>
      ) : (
        <IssueList issues={issues} compact className="border-y" />
      )}
    </section>
  );
}

function Outline({ content }: { content: string }) {
  const headings = extractHeadings(parseSkillMarkdown(content).body);
  if (!headings.length) return null;
  return (
    <section className="pb-2">
      <PanelTitle icon={ListTree}>Outline</PanelTitle>
      <ul className="space-y-0.5 px-4 text-xs text-foreground/80">
        {headings.map((h, i) => (
          <li key={i} className="truncate">
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
}

function UsedIn({ stacks }: { stacks: Stack[] }) {
  const navigate = useUI((s) => s.navigate);
  return (
    <section className="pb-4">
      <PanelTitle icon={Workflow}>Used in</PanelTitle>
      {stacks.length === 0 ? (
        <p className="px-4 text-xs text-muted-foreground">Not part of any stack yet.</p>
      ) : (
        <ul className="px-2">
          {stacks.map((s) => (
            <li key={s.id}>
              <button onClick={() => navigate({ view: 'stacks', stackId: s.id, tab: 'graph' })} className="w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
