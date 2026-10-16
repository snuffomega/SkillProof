import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Download, FileSignature, FlaskConical, History, Lock, MoreHorizontal, Pencil, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HealthPill, StatusBadge } from '@/components/common';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRepository, useStackVersions } from '@/data/hooks';
import { exportStackBundle } from '@/domain/bundle';
import { summarize } from '@/domain/validation';
import { stackStatus } from '@/domain/versioning';
import type { Skill, Stack } from '@/domain/types';
import { downloadBlob } from '@/lib/download';
import { slugify } from '@/lib/id';
import { useUI, type StackTab } from '@/store/ui';
import { TabBar } from '@/features/shared/TabBar';
import { useStackIssues } from '@/features/shared/validation-hooks';
import { PublishDialog } from '@/features/versions/PublishDialog';
import { ScenarioDialog } from '@/features/evals/ScenarioDialog';
import { StackGraph } from './graph/StackGraph';
import { ContractTab } from './ContractTab';
import { StackValidationTab } from './StackValidationTab';
import { StackVersionsTab } from './StackVersionsTab';

export function StackDetail({ stack, tab, skills }: { stack: Stack; tab: StackTab; skills: Skill[] }) {
  const repo = useRepository();
  const navigate = useUI((s) => s.navigate);
  const versions = useStackVersions(stack.id) ?? [];
  const issues = useStackIssues(stack);
  const { errors, warnings } = summarize(issues);
  const status = stackStatus(stack);
  const skillsById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, confirmNode] = useConfirm();

  const go = (t: StackTab) => navigate({ view: 'stacks', stackId: stack.id, tab: t });

  const exportBundle = async () => {
    const used = stack.nodes.map((n) => skillsById.get(n.skillId)).filter((s): s is Skill => !!s);
    const data = await exportStackBundle(stack, [...new Map(used.map((s) => [s.id, s])).values()]);
    downloadBlob(data, `${slugify(stack.name) || 'stack'}.skillstack.zip`, 'application/zip');
    toast.success('Bundle exported', { description: 'Includes every SKILL.md, attached files, connections and the contract.' });
  };

  const duplicate = async () => {
    const copy = await repo.duplicateStack(stack.id);
    toast.success(`Created ${copy.name}`);
    navigate({ view: 'stacks', stackId: copy.id, tab: 'graph' });
  };

  const remove = () =>
    confirm({
      title: `Delete ${stack.name}?`,
      description: 'The graph, contract, published snapshots and evaluation scenarios for this stack are deleted. Skills stay in your library.',
      confirmLabel: 'Delete stack',
      destructive: true,
      onConfirm: async () => {
        await repo.deleteStack(stack.id);
        toast.success('Stack deleted');
        navigate({ view: 'stacks' });
      },
    });

  const rename = async (name: string) => {
    setEditing(false);
    const n = name.trim();
    if (n && n !== stack.name) await repo.updateStack(stack.id, { name: n });
  };

  const publishDisabledReason = errors > 0 ? `Fix ${errors} error${errors === 1 ? '' : 's'} first` : status === 'published' ? 'No changes since the last publish' : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate({ view: 'stacks' })} aria-label="All stacks">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            {editing ? (
              <Input
                autoFocus
                defaultValue={stack.name}
                className="h-7 max-w-xs text-[15px] font-semibold"
                aria-label="Stack name"
                onBlur={(e) => rename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
            ) : (
              <button onClick={() => setEditing(true)} className="group flex min-w-0 items-center gap-1.5 text-left" title="Rename stack">
                <h2 className="truncate text-[15px] font-semibold">{stack.name}</h2>
                <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
            <StatusBadge status={status} version={stack.publishedVersion} />
            <button onClick={() => go('validation')} className="hidden sm:block">
              <HealthPill errors={errors} warnings={warnings} />
            </button>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{stack.description || `${stack.nodes.length} skills · ${stack.edges.length} connections`}</p>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" onClick={() => setPublishOpen(true)} disabled={!!publishDisabledReason}>
                <Lock /> Publish v{(stack.publishedVersion ?? 0) + 1}
              </Button>
            </span>
          </TooltipTrigger>
          {publishDisabledReason && <TooltipContent>{publishDisabledReason}</TooltipContent>}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={exportBundle}>
              <Download /> <span className="hidden md:inline">Export</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download a portable .zip bundle</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={duplicate}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setScenarioOpen(true)}>
              <FlaskConical /> New evaluation scenario
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={remove} className="text-err focus:text-err">
              <Trash2 /> Delete stack
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <TabBar
        active={tab}
        onChange={go}
        tabs={[
          { id: 'graph', label: 'Graph', icon: Workflow },
          { id: 'contract', label: 'Contract', icon: FileSignature },
          { id: 'validation', label: 'Validation', icon: ShieldCheck, count: errors || warnings, tone: errors ? 'err' : 'warn' },
          { id: 'versions', label: 'Versions', icon: History, count: versions.length },
        ]}
      />

      <div className="min-h-0 flex-1">
        {tab === 'graph' && <StackGraph stack={stack} skills={skills} issues={issues} />}
        {tab === 'contract' && <ContractTab stack={stack} issues={issues} skillsById={skillsById} />}
        {tab === 'validation' && <StackValidationTab stack={stack} issues={issues} />}
        {tab === 'versions' && <StackVersionsTab stack={stack} versions={versions} skillsById={skillsById} />}
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        subject={stack.name}
        nextVersion={(stack.publishedVersion ?? 0) + 1}
        errors={errors}
        warnings={warnings}
        onPublish={(note) => repo.publishStack(stack.id, note)}
      />
      <ScenarioDialog open={scenarioOpen} onOpenChange={setScenarioOpen} defaultTarget={{ type: 'stack', id: stack.id }} onSaved={(s) => navigate({ view: 'evals', scenarioId: s.id })} />
      {confirmNode}
    </div>
  );
}
