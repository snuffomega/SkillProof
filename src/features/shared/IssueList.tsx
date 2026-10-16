import { ChevronRight } from 'lucide-react';
import { SeverityIcon } from '@/components/common';
import type { Issue } from '@/domain/types';
import { cn } from '@/lib/utils';

const ORDER = { error: 0, warning: 1, info: 2 } as const;

export function IssueList({ issues, onSelect, compact, className }: { issues: Issue[]; onSelect?: (issue: Issue) => void; compact?: boolean; className?: string }) {
  const sorted = [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <ul className={cn('divide-y divide-border/60', className)}>
      {sorted.map((issue) => {
        const content = (
          <>
            <SeverityIcon severity={issue.severity} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-foreground/90', compact ? 'text-xs' : 'text-[13px]')}>{issue.message}</span>
              {!compact && <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground">{issue.code}</span>}
            </span>
            {onSelect && <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
          </>
        );
        return (
          <li key={issue.id}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(issue)} className={cn('group flex w-full items-start gap-2.5 text-left transition-colors hover:bg-accent/60', compact ? 'px-3 py-2' : 'px-4 py-2.5')}>
                {content}
              </button>
            ) : (
              <div className={cn('flex items-start gap-2.5', compact ? 'px-3 py-2' : 'px-4 py-2.5')}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
