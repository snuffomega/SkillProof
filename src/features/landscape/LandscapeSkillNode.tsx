import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LandscapeSkillNodeData extends Record<string, unknown> {
  name: string;
  description: string;
  areas: { label: string; color: string }[];
  fileCount: number;
  dimmed: boolean;
  highlight: boolean;
}

export type LandscapeSkillFlowNode = Node<LandscapeSkillNodeData, 'landscape-skill'>;

function LandscapeSkillNodeView({ data, selected }: NodeProps<LandscapeSkillFlowNode>) {
  return (
    <div
      className={cn(
        'group relative flex w-[200px] cursor-pointer flex-col rounded-lg border bg-surface px-3 py-2.5 shadow-[0_1px_0_0_var(--border),0_6px_18px_-10px_rgb(0_0_0/0.3)] transition-[border-color,box-shadow,opacity]',
        selected ? 'border-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_22%,transparent)]' : 'hover:border-foreground/25',
        data.highlight && 'border-primary',
        data.dimmed && 'opacity-35',
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center gap-1.5">
        <FileText className="size-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] font-medium">{data.name || 'unnamed-skill'}</span>
        {data.fileCount > 0 && <span className="text-[10px] tabular-nums text-muted-foreground">{data.fileCount}</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-[10.5px] leading-[1.4] text-muted-foreground">{data.description || 'No description'}</p>
      {data.areas.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {data.areas.slice(0, 3).map((a, i) => (
            <span key={i} className="rounded px-1 py-px text-[9.5px] font-medium" style={{ background: `color-mix(in oklch, ${a.color} 15%, transparent)`, color: a.color }}>
              {a.label}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle id="left" type="source" position={Position.Left} className="!opacity-0" />
      <Handle id="right" type="target" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

export const LandscapeSkillNode = memo(LandscapeSkillNodeView);
