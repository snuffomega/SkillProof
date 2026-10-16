import { useMemo } from 'react';
import { collapseDiff, diffStats, diffText } from '@/domain/versioning';
import { cn } from '@/lib/utils';

export function DiffView({ before, after, title }: { before: string; after: string; title?: string }) {
  const rows = useMemo(() => diffText(before, after), [before, after]);
  const stats = diffStats(rows);
  const collapsed = useMemo(() => collapseDiff(rows, 3), [rows]);

  return (
    <div className="overflow-hidden rounded-lg border bg-surface">
      <div className="flex items-center gap-3 border-b bg-surface-2/60 px-3 py-2 text-xs">
        {title && <span className="font-mono text-foreground/90">{title}</span>}
        <span className="ml-auto font-mono tabular-nums">
          <span className="text-ok">+{stats.added}</span> <span className="text-err">−{stats.removed}</span>
        </span>
      </div>
      {stats.added + stats.removed === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">No differences.</p>
      ) : (
        <div className="scrollbar-thin overflow-x-auto font-mono text-[12px] leading-5">
          <table className="w-full border-collapse">
            <tbody>
              {collapsed.map((row, i) =>
                row.type === 'gap' ? (
                  <tr key={i} className="bg-muted/40 text-muted-foreground">
                    <td colSpan={4} className="px-3 py-0.5 text-[11px]">
                      ⋯ {row.count} unchanged line{row.count === 1 ? '' : 's'}
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className={cn(row.type === 'add' && 'bg-ok/10', row.type === 'remove' && 'bg-err/10')}>
                    <td className="w-10 select-none px-2 text-right text-muted-foreground/60 tabular-nums">{row.oldLine ?? ''}</td>
                    <td className="w-10 select-none px-2 text-right text-muted-foreground/60 tabular-nums">{row.newLine ?? ''}</td>
                    <td className={cn('w-4 select-none text-center', row.type === 'add' ? 'text-ok' : row.type === 'remove' ? 'text-err' : 'text-transparent')}>
                      {row.type === 'add' ? '+' : row.type === 'remove' ? '−' : ' '}
                    </td>
                    <td className="whitespace-pre pr-4">{row.text || ' '}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
