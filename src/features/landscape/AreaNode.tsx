import { memo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

export interface AreaNodeData extends Record<string, unknown> {
  label: string;
  skillCount: number;
  color: string;
  dimmed: boolean;
}

export type AreaFlowNode = Node<AreaNodeData, 'area'>;

function AreaNodeView({ data, selected }: NodeProps<AreaFlowNode>) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-opacity',
        selected ? 'ring-2 ring-primary/30' : '',
        data.dimmed && 'opacity-30',
      )}
      style={{
        borderColor: data.color,
        background: `color-mix(in oklch, ${data.color} 8%, transparent)`,
        width: 320,
        minHeight: 200,
      }}
    >
      <div className="absolute left-3 top-2.5 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: data.color }} />
        <span className="text-[12px] font-semibold tracking-tight" style={{ color: data.color }}>
          {data.label}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{data.skillCount}</span>
      </div>
    </div>
  );
}

export const AreaNode = memo(AreaNodeView);
