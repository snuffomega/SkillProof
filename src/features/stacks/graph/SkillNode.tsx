import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CircleAlert, TriangleAlert, Unlink } from 'lucide-react';
import { NODE_HEIGHT, NODE_WIDTH } from '@/domain/graph';
import type { PublishStatus } from '@/domain/types';
import { cn } from '@/lib/utils';

export interface SkillNodeData extends Record<string, unknown> {
  name: string;
  description: string;
  role: string;
  status: PublishStatus | null;
  version: number | null;
  errors: number;
  warnings: number;
  missing: boolean;
  dimmed: boolean;
}

export type SkillFlowNode = Node<SkillNodeData, 'skill'>;

const STATUS_DOT: Record<PublishStatus, string> = { draft: 'bg-muted-foreground/50', published: 'bg-ok', modified: 'bg-warn' };

function SkillNodeView({ data, selected }: NodeProps<SkillFlowNode>) {
  return (
    <div
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
      className={cn(
        'group relative flex flex-col rounded-[10px] border bg-surface px-3.5 py-3 shadow-[0_1px_0_0_var(--border),0_8px_24px_-12px_rgb(0_0_0/0.35)] transition-[border-color,box-shadow,opacity]',
        selected ? 'border-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_22%,transparent)]' : 'hover:border-foreground/25',
        data.missing && 'border-dashed border-err/60',
        data.dimmed && 'opacity-40',
      )}
    >
      <Handle type="target" position={Position.Left} className="!-left-[5px]" />
      <div className="flex items-center gap-2">
        {data.missing ? <Unlink className="size-3.5 text-err" /> : <span className={cn('size-2 shrink-0 rounded-full', data.status ? STATUS_DOT[data.status] : 'bg-muted')} />}
        <span className={cn('min-w-0 flex-1 truncate font-mono text-[12.5px] font-medium', data.missing && 'text-err')}>{data.missing ? 'Missing skill' : data.name || 'unnamed-skill'}</span>
        {data.errors > 0 ? (
          <span className="flex items-center gap-0.5 text-[10.5px] tabular-nums text-err">
            <CircleAlert className="size-3" />
            {data.errors}
          </span>
        ) : data.warnings > 0 ? (
          <span className="flex items-center gap-0.5 text-[10.5px] tabular-nums text-warn">
            <TriangleAlert className="size-3" />
            {data.warnings}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-[1.45] text-muted-foreground">
        {data.missing ? 'The skill this node referenced was deleted. Remove the node or restore the skill.' : data.description || 'No description'}
      </p>
      <div className="mt-auto flex items-center gap-1.5 pt-2">
        {data.role ? (
          <span className="truncate rounded bg-accent px-1.5 py-px text-[10.5px] text-accent-foreground">{data.role}</span>
        ) : (
          <span className="text-[10.5px] italic text-muted-foreground/70">No role</span>
        )}
        {data.version !== null && <span className="ml-auto font-mono text-[10px] text-muted-foreground">v{data.version}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!-right-[5px]" />
    </div>
  );
}

export const SkillNode = memo(SkillNodeView);
