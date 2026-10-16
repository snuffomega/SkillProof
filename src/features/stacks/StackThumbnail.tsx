import { useMemo } from 'react';
import { NODE_HEIGHT, NODE_WIDTH } from '@/domain/graph';
import type { Stack } from '@/domain/types';
import { RELATION_COLOR } from '@/components/common';

/** Static thumbnail of a stack graph for overview cards. */
export function StackThumbnail({ stack }: { stack: Stack }) {
  const view = useMemo(() => {
    if (!stack.nodes.length) return null;
    const xs = stack.nodes.map((n) => n.position.x);
    const ys = stack.nodes.map((n) => n.position.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    const w = Math.max(...xs) + NODE_WIDTH + 40 - minX;
    const h = Math.max(...ys) + NODE_HEIGHT + 40 - minY;
    return { minX, minY, w, h };
  }, [stack.nodes]);

  if (!view) return <div className="grid h-full place-items-center text-xs text-muted-foreground">Empty stack</div>;
  const pos = new Map(stack.nodes.map((n) => [n.id, n.position]));

  return (
    <svg viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" className="size-full" aria-hidden>
      {stack.edges.map((e) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return null;
        const x1 = a.x + NODE_WIDTH;
        const y1 = a.y + NODE_HEIGHT / 2;
        const x2 = b.x;
        const y2 = b.y + NODE_HEIGHT / 2;
        const dx = Math.max(60, Math.abs(x2 - x1) * 0.4);
        return (
          <path
            key={e.id}
            d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
            fill="none"
            style={{ stroke: RELATION_COLOR[e.kind] }}
            strokeWidth={6}
            strokeDasharray={e.kind === 'policy' ? '18 12' : e.kind === 'conflict' ? '6 12' : undefined}
            strokeLinecap="round"
          />
        );
      })}
      {stack.nodes.map((n) => (
        <rect key={n.id} x={n.position.x} y={n.position.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx={18} style={{ fill: 'var(--surface)', stroke: 'var(--border)' }} strokeWidth={4} />
      ))}
    </svg>
  );
}
