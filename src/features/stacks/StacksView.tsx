import { useMemo } from 'react';
import { Plus, SearchX, Upload, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, HealthPill, StatusBadge } from '@/components/common';
import { useSkills, useStacks } from '@/data/hooks';
import { summarize, validateStack } from '@/domain/validation';
import { stackStatus } from '@/domain/versioning';
import { relativeTime } from '@/lib/format';
import { useUI, type StackTab } from '@/store/ui';
import { buildContext } from '@/features/shared/validation-hooks';
import { StackDetail } from './StackDetail';
import { StackThumbnail } from './StackThumbnail';

export function StacksView({ stackId, tab }: { stackId?: string; tab: StackTab }) {
  const stacks = useStacks();
  const skills = useSkills();
  if (!stacks || !skills) return null;

  if (stackId) {
    const stack = stacks.find((s) => s.id === stackId);
    if (!stack)
      return (
        <EmptyState icon={SearchX} title="Stack not found">
          It may have been deleted.
        </EmptyState>
      );
    return <StackDetail key={stack.id} stack={stack} tab={tab} skills={skills} />;
  }
  return <StacksOverview />;
}

function StacksOverview() {
  const stacks = useStacks() ?? [];
  const skills = useSkills() ?? [];
  const navigate = useUI((s) => s.navigate);
  const openDialog = useUI((s) => s.openDialog);

  const health = useMemo(() => {
    const ctx = buildContext(skills);
    return new Map(stacks.map((s) => [s.id, summarize(validateStack(s, ctx))]));
  }, [stacks, skills]);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stacks</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Connected skill systems</h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
              A stack wires skills together with explicit dependencies, handoffs, shared policies and conflicts, and adds a contract describing what the whole system must deliver.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openDialog('import')}>
              <Upload /> Import bundle
            </Button>
            <Button onClick={() => openDialog('new-stack')}>
              <Plus /> New stack
            </Button>
          </div>
        </div>

        {stacks.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed">
            <EmptyState icon={Workflow} title="No stacks yet" action={<Button onClick={() => openDialog('new-stack')}>Create a stack</Button>}>
              Compose skills from your library into a workflow with a contract you can validate, evaluate and ship as a portable bundle.
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...stacks]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((s) => {
                const h = health.get(s.id) ?? { errors: 0, warnings: 0, infos: 0 };
                return (
                  <li key={s.id} className="fade-up">
                    <button
                      onClick={() => navigate({ view: 'stacks', stackId: s.id, tab: 'graph' })}
                      className="group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-surface text-left transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg"
                    >
                      <div className="h-36 border-b bg-canvas p-3 transition-colors">
                        <StackThumbnail stack={s} />
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-center gap-2">
                          <h2 className="min-w-0 flex-1 truncate text-[14px] font-medium">{s.name}</h2>
                          <StatusBadge status={stackStatus(s)} version={s.publishedVersion} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{s.description || 'No description'}</p>
                        <div className="mt-auto flex items-center gap-3 pt-4 text-[11.5px] text-muted-foreground">
                          <span>{s.nodes.length} skills</span>
                          <span>{s.edges.length} connections</span>
                          <HealthPill errors={h.errors} warnings={h.warnings} className="ml-auto" />
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground/80">Edited {relativeTime(s.updatedAt)}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}
