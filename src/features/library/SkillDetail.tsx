import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, Download, FileArchive, FileText, FlaskConical, History, Loader2, Lock, MoreHorizontal, Paperclip, PenLine, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HealthPill, StatusBadge } from '@/components/common';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRepository, useScenarios, useSkillVersions, useStacks } from '@/data/hooks';
import { exportSkillsZip } from '@/domain/bundle';
import { setFrontmatterField } from '@/domain/skill-markdown';
import { summarize } from '@/domain/validation';
import { skillStatus } from '@/domain/versioning';
import type { Issue, Skill } from '@/domain/types';
import { downloadBlob } from '@/lib/download';
import { useUI, type SkillTab } from '@/store/ui';
import { TabBar } from '@/features/shared/TabBar';
import { useDebouncedSave } from '@/features/shared/useDebouncedSave';
import { PublishDialog } from '@/features/versions/PublishDialog';
import { SkillEditor } from './SkillEditor';
import { SkillFilesTab } from './SkillFilesTab';
import { SkillVersionsTab } from './SkillVersionsTab';
import { SkillEvalsTab } from './SkillEvalsTab';

interface SkillDetailProps {
  skill: Skill;
  tab: SkillTab;
  skills: Skill[];
  issues: Issue[];
}

export function SkillDetail({ skill, tab, skills, issues }: SkillDetailProps) {
  const repo = useRepository();
  const navigate = useUI((s) => s.navigate);
  const versions = useSkillVersions(skill.id) ?? [];
  const scenarios = useScenarios({ type: 'skill', id: skill.id }) ?? [];
  const stacks = useStacks() ?? [];
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirm, confirmNode] = useConfirm();

  const editor = useDebouncedSave(skill.content, skill.id, (content: string) => repo.updateSkill(skill.id, { content }));
  const status = skillStatus(skill);
  const { errors, warnings } = summarize(issues);
  const usedIn = stacks.filter((st) => st.nodes.some((n) => n.skillId === skill.id));
  const fileName = skill.name || 'skill';

  const go = (t: SkillTab) => navigate({ view: 'library', skillId: skill.id, tab: t });

  const publish = async (note: string) => {
    await editor.flush();
    await repo.publishSkill(skill.id, note);
  };

  const duplicate = async () => {
    await editor.flush();
    const names = new Set(skills.map((s) => s.name));
    let name = `${skill.name || 'skill'}-copy`;
    for (let i = 2; names.has(name); i++) name = `${skill.name || 'skill'}-copy-${i}`;
    const created = await repo.createSkill({
      content: setFrontmatterField(editor.value, 'name', name),
      files: skill.files,
      tags: skill.tags,
      folder: skill.folder,
      source: { kind: 'manual' },
    });
    toast.success(`Duplicated as ${name}`);
    navigate({ view: 'library', skillId: created.id, tab: 'edit' });
  };

  const remove = () =>
    confirm({
      title: `Delete ${skill.name || 'this skill'}?`,
      description: usedIn.length
        ? `It will also be removed from ${usedIn.map((s) => s.name).join(', ')}, along with its connections, published versions and evaluation scenarios. Published stack snapshots keep their copy.`
        : 'Its published versions and evaluation scenarios are deleted too. This cannot be undone.',
      confirmLabel: 'Delete skill',
      destructive: true,
      onConfirm: async () => {
        await repo.deleteSkill(skill.id);
        toast.success('Skill deleted');
        navigate({ view: 'library' });
      },
    });

  const publishDisabledReason = errors > 0 ? `Fix ${errors} error${errors === 1 ? '' : 's'} first` : status === 'published' ? 'No changes since the last publish' : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => navigate({ view: 'library' })} aria-label="Back to library">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="truncate font-mono text-[15px] font-semibold">{skill.name || 'unnamed-skill'}</h2>
            <StatusBadge status={status} version={skill.publishedVersion} />
            <button onClick={() => go('edit')} className="hidden sm:block">
              <HealthPill errors={errors} warnings={warnings} />
            </button>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {skill.folder || 'Unsorted'}
            {usedIn.length > 0 && ` · used in ${usedIn.length} stack${usedIn.length === 1 ? '' : 's'}`}
            {skill.source.kind !== 'manual' && skill.source.kind !== 'demo' && ` · imported from ${skill.source.ref ?? skill.source.kind}`}
          </p>
        </div>

        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex" aria-live="polite">
          {editor.saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          {editor.saving ? 'Saving' : 'Saved'}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" onClick={() => setPublishOpen(true)} disabled={!!publishDisabledReason}>
                <Lock /> Publish v{(skill.publishedVersion ?? 0) + 1}
              </Button>
            </span>
          </TooltipTrigger>
          {publishDisabledReason && <TooltipContent>{publishDisabledReason}</TooltipContent>}
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Export">
              <Download />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadBlob(editor.value, `${fileName}.SKILL.md`, 'text/markdown')}>
              <FileText /> SKILL.md only
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await editor.flush();
                downloadBlob(await exportSkillsZip([{ ...skill, content: editor.value }]), `${fileName}.zip`, 'application/zip');
              }}
            >
              <FileArchive /> Skill folder (.zip)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={duplicate}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={remove} className="text-err focus:text-err">
              <Trash2 /> Delete skill
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <TabBar
        active={tab}
        onChange={go}
        tabs={[
          { id: 'edit', label: 'Instructions', icon: PenLine, count: errors || warnings, tone: errors ? 'err' : 'warn' },
          { id: 'files', label: 'Files', icon: Paperclip, count: skill.files.length },
          { id: 'versions', label: 'Versions', icon: History, count: versions.length },
          { id: 'evals', label: 'Evaluations', icon: FlaskConical, count: scenarios.length },
        ]}
      />

      <div className="min-h-0 flex-1">
        {tab === 'edit' && <SkillEditor skill={skill} content={editor.value} onChange={editor.update} issues={issues} usedIn={usedIn} />}
        {tab === 'files' && <SkillFilesTab skill={skill} />}
        {tab === 'versions' && <SkillVersionsTab skill={skill} versions={versions} draft={editor.value} />}
        {tab === 'evals' && <SkillEvalsTab skill={skill} scenarios={scenarios} />}
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        subject={skill.name || 'this skill'}
        nextVersion={(skill.publishedVersion ?? 0) + 1}
        errors={errors}
        warnings={warnings}
        onPublish={publish}
      />
      {confirmNode}
    </div>
  );
}
