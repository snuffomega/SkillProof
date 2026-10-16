import { CircleCheck } from 'lucide-react';
import { HealthPill, SourceLabel } from '@/components/common';
import { summarize } from '@/domain/validation';
import type { Issue, Stack } from '@/domain/types';
import { useUI } from '@/store/ui';
import { IssueList } from '@/features/shared/IssueList';

const GROUPS: { id: string; title: string; match: (i: Issue) => boolean }[] = [
  { id: 'nodes', title: 'Skills', match: (i) => i.target.type === 'node' || i.target.type === 'skill' },
  { id: 'edges', title: 'Connections', match: (i) => i.target.type === 'edge' },
  { id: 'contract', title: 'Contract', match: (i) => i.target.type === 'contract' },
];

export function StackValidationTab({ stack, issues }: { stack: Stack; issues: Issue[] }) {
  const navigate = useUI((s) => s.navigate);
  const focusGraph = useUI((s) => s.focusGraph);
  const { errors, warnings, infos } = summarize(issues);

  const open = (issue: Issue) => {
    const t = issue.target;
    if (t.type === 'node') {
      focusGraph({ nodeId: t.nodeId });
      navigate({ view: 'stacks', stackId: stack.id, tab: 'graph' });
    } else if (t.type === 'edge') {
      focusGraph({ edgeId: t.edgeId });
      navigate({ view: 'stacks', stackId: stack.id, tab: 'graph' });
    } else if (t.type === 'contract') navigate({ view: 'stacks', stackId: stack.id, tab: 'contract' });
    else navigate({ view: 'library', skillId: t.skillId, tab: 'edit' });
  };

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Validation</h2>
          <SourceLabel kind="real" />
          <HealthPill errors={errors} warnings={warnings} className="ml-auto" />
        </div>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          Deterministic checks run on every edit: SKILL.md structure, broken links and files, missing skills, dependency cycles, unresolved conflicts and contract gaps. Errors block publishing.
        </p>

        {issues.length === 0 ? (
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/5 px-5 py-4 text-[13px]">
            <CircleCheck className="size-5 text-ok" />
            <div>
              <div className="font-medium">All checks pass</div>
              <div className="text-xs text-muted-foreground">This stack is ready to publish.</div>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {GROUPS.map((g) => {
              const list = issues.filter(g.match);
              if (!list.length) return null;
              return (
                <section key={g.id}>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {g.title}
                    <span className="tabular-nums">{list.length}</span>
                  </h3>
                  <div className="overflow-hidden rounded-xl border bg-surface">
                    <IssueList issues={list} onSelect={open} />
                  </div>
                </section>
              );
            })}
            {infos > 0 && <p className="text-xs text-muted-foreground">Blue notes are suggestions and never block publishing.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
