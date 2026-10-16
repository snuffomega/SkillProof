import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { LandscapeKind, TrustLevel } from '@/domain/landscape';
import { LANDSCAPE_KIND_META } from '@/domain/landscape';
import { cn } from '@/lib/utils';

export interface LandscapeEdgeData extends Record<string, unknown> {
  kind: LandscapeKind;
  trust: TrustLevel;
  reason: string;
  dimmed: boolean;
  highlight: boolean;
}

export type LandscapeFlowEdge = Edge<LandscapeEdgeData, 'landscape-rel'>;

const TRUST_DASH: Record<TrustLevel, string | undefined> = {
  verified: undefined,
  inferred: '5 5',
  manual: '2 4',
};

const TRUST_WIDTH: Record<TrustLevel, number> = {
  verified: 2,
  inferred: 1.5,
  manual: 1.5,
};

const TRUST_OPACITY: Record<TrustLevel, number> = {
  verified: 0.9,
  inferred: 0.5,
  manual: 0.7,
};

function LandscapeEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<LandscapeFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.3 });
  if (!data) return null;
  const meta = LANDSCAPE_KIND_META[data.kind];
  const color = meta.color;
  const dash = TRUST_DASH[data.trust];
  const width = selected ? TRUST_WIDTH[data.trust] + 1 : TRUST_WIDTH[data.trust];
  const opacity = data.dimmed ? 0.15 : data.highlight ? 1 : TRUST_OPACITY[data.trust];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: color, strokeWidth: width, strokeDasharray: dash, opacity, transition: 'opacity 150ms' }}
        interactionWidth={16}
      />
      {(selected || data.highlight) && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, borderColor: color }}
            className={cn(
              'nodrag nopan pointer-events-none absolute max-w-[200px] rounded-full border bg-surface px-2 py-0.5 text-[10px] font-medium shadow-sm',
              data.trust === 'inferred' && 'border-dashed',
            )}
          >
            <span style={{ color }}>{meta.label}</span>
            <span className="ml-1 text-muted-foreground">{data.trust}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LandscapeEdge = memo(LandscapeEdgeView);
