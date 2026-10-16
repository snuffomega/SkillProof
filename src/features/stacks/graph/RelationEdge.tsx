import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import { ArrowRightLeft, CircleAlert, Link2, ShieldHalf, Swords } from 'lucide-react';
import { RELATION_COLOR } from '@/components/common';
import { RELATION_KINDS, RELATION_META, type RelationKind } from '@/domain/types';
import { cn } from '@/lib/utils';

export interface RelationEdgeData extends Record<string, unknown> {
  kind: RelationKind;
  label: string;
  hasError: boolean;
  dimmed: boolean;
}

export type RelationFlowEdge = Edge<RelationEdgeData, 'relation'>;

export const RELATION_ICON: Record<RelationKind, React.ComponentType<{ className?: string }>> = {
  depends: Link2,
  handoff: ArrowRightLeft,
  policy: ShieldHalf,
  conflict: Swords,
};

const DASH: Record<RelationKind, string | undefined> = { depends: undefined, handoff: undefined, policy: '6 4', conflict: '2 4' };
const DIRECTED: Record<RelationKind, boolean> = { depends: true, handoff: true, policy: false, conflict: false };

function RelationEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<RelationFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  if (!data) return null;
  const color = RELATION_COLOR[data.kind];
  const Icon = data.hasError ? CircleAlert : RELATION_ICON[data.kind];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className="rel-path"
        markerEnd={DIRECTED[data.kind] ? `url(#rel-arrow-${data.kind})` : undefined}
        style={{ stroke: color, strokeWidth: selected ? 2.5 : 1.75, strokeDasharray: DASH[data.kind], opacity: data.dimmed ? 0.25 : 1, transition: 'opacity 150ms' }}
        interactionWidth={18}
      />
      {data.kind === 'handoff' && !data.dimmed && <path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray="2 16" strokeLinecap="round" className="rel-animated pointer-events-none" opacity={0.9} />}
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, borderColor: color, opacity: data.dimmed ? 0.3 : 1 }}
          className={cn(
            'nodrag nopan pointer-events-auto absolute flex max-w-[180px] cursor-pointer items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-[10.5px] font-medium shadow-sm transition-transform',
            selected && 'scale-105 ring-2 ring-primary/30',
            data.hasError && 'border-err text-err',
          )}
        >
          <span style={{ color: data.hasError ? undefined : color }}>
            <Icon className="size-3" />
          </span>
          <span className="truncate">{data.label || RELATION_META[data.kind].label}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationEdge = memo(RelationEdgeView);

/** Arrowhead markers shared by every edge; rendered once per canvas. */
export function RelationMarkers() {
  return (
    <svg className="pointer-events-none absolute size-0" aria-hidden>
      <defs>
        {RELATION_KINDS.map((k) => (
          <marker key={k} id={`rel-arrow-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" style={{ fill: RELATION_COLOR[k] }} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
