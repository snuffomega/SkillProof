import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { Maximize, Network, Upload, Layers, AlertCircle, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { useLandscape, useSkills } from '@/data/hooks';
import type { Skill } from '@/domain/types';
import { LANDSCAPE_KIND_META, TRUST_META, type Landscape, type LandscapeKind, type TrustLevel } from '@/domain/landscape';
import { areaColors, layoutLandscape } from '@/domain/landscape-layout';
import { useUI, type LandscapeTab } from '@/store/ui';
import { TabBar } from '@/features/shared/TabBar';
import { AreaNode, type AreaFlowNode } from './AreaNode';
import { LandscapeSkillNode, type LandscapeSkillFlowNode } from './LandscapeSkillNode';
import { LandscapeEdge, type LandscapeFlowEdge } from './LandscapeEdge';
import { AreaDetail } from './AreaDetail';
import { RelationshipList } from './RelationshipList';
import { GapList } from './GapList';
import { SkillPanel } from './SkillPanel';

const nodeTypes = { area: AreaNode, 'landscape-skill': LandscapeSkillNode };
const edgeTypes = { 'landscape-rel': LandscapeEdge };

interface Props {
  tab: LandscapeTab;
  areaId?: string;
  skillId?: string;
}

export function LandscapeView({ tab, areaId, skillId }: Props) {
  const landscape = useLandscape();
  const skills = useSkills() ?? [];
  const [panelSkillId, setPanelSkillId] = useState<string | null>(skillId ?? null);

  if (skills.length === 0) {
    return <EmptyLandscape />;
  }
  if (!landscape) return null;

  return (
    <ReactFlowProvider>
      <LandscapeContent tab={tab} areaId={areaId} landscape={landscape} skills={skills} panelSkillId={panelSkillId} setPanelSkillId={setPanelSkillId} />
    </ReactFlowProvider>
  );
}

function EmptyLandscape() {
  const openDialog = useUI((s) => s.openDialog);
  return (
    <EmptyState
      icon={Network}
      title="No skills to explore yet"
      action={
        <Button onClick={() => openDialog('import')}>
          <Upload /> Import a skill repository
        </Button>
      }
    >
      Import skills from a folder, ZIP, or GitHub repository to see how they organize into work areas, where they overlap, and what needs attention.
    </EmptyState>
  );
}

function LandscapeContent({ tab, areaId, landscape, skills, panelSkillId, setPanelSkillId }: { tab: LandscapeTab; areaId?: string; landscape: Landscape; skills: Skill[]; panelSkillId: string | null; setPanelSkillId: (id: string | null) => void }) {
  const navigate = useUI((s) => s.navigate);
  const go = (t: LandscapeTab) => navigate({ view: 'landscape', tab: t });

  const relCount = landscape.relationships.length;
  const gapCount = landscape.gaps.length;
  const colors = useMemo(() => areaColors(landscape.areas), [landscape.areas]);
  const panelSkill = panelSkillId ? skills.find((s) => s.id === panelSkillId) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b px-5 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 text-[15px] font-semibold">
            <Network className="size-4 text-primary" /> Skill Landscape
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {landscape.areas.length} work areas · {skills.length} skills · {relCount} relationships{gapCount > 0 && ` · ${gapCount} gaps`}
          </div>
        </div>
      </header>

      <TabBar
        active={tab}
        onChange={go}
        tabs={[
          { id: 'map', label: 'Map', icon: Network },
          { id: 'areas', label: 'Areas', icon: Layers, count: landscape.areas.length },
          { id: 'relationships', label: 'Relationships', icon: GitCompareArrows, count: relCount },
          { id: 'gaps', label: 'Gaps', icon: AlertCircle, count: gapCount, tone: gapCount ? 'warn' : undefined },
        ]}
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          {tab === 'map' && (
            <ReactFlowProvider>
              <LandscapeMap landscape={landscape} skills={skills} onSkillClick={(id) => setPanelSkillId(id)} />
            </ReactFlowProvider>
          )}
          {tab === 'areas' && <AreaDetail landscape={landscape} skills={skills} areaId={areaId} />}
          {tab === 'relationships' && <RelationshipList landscape={landscape} skills={skills} />}
          {tab === 'gaps' && <GapList landscape={landscape} skills={skills} />}
        </div>
        {panelSkill && (
          <SkillPanel skill={panelSkill} landscape={landscape} areaColors={colors} skills={skills} onClose={() => setPanelSkillId(null)} />
        )}
      </div>
    </div>
  );
}

function LandscapeMap({ landscape, skills, onSkillClick }: { landscape: Landscape; skills: Skill[]; onSkillClick: (id: string) => void }) {
  const theme = useUI((s) => s.theme);
  const rf = useReactFlow<LandscapeSkillFlowNode, LandscapeFlowEdge>();
  const [highlightSkill, setHighlightSkill] = useState<string | null>(null);

  const { skillPositions, areaPositions } = useMemo(() => layoutLandscape(landscape), [landscape]);
  const colors = useMemo(() => areaColors(landscape.areas), [landscape.areas]);

  const nodes = useMemo(() => {
    const areaNodes: AreaFlowNode[] = landscape.areas.map((area) => {
      const pos = areaPositions.get(area.id)!;
      const color = colors.get(area.id)!;
      return {
        id: `area-${area.id}`,
        type: 'area',
        position: { x: pos.x, y: pos.y },
        data: { label: area.label, skillCount: area.members.length, color, dimmed: false },
        selectable: false,
        draggable: false,
      };
    });

    const skillNodes: LandscapeSkillFlowNode[] = skills.map((skill) => {
      const pos = skillPositions.get(skill.id) ?? { x: 0, y: 0 };
      const areas = landscape.memberships.get(skill.id) ?? [];
      return {
        id: skill.id,
        type: 'landscape-skill',
        position: pos,
        data: {
          name: skill.name,
          description: skill.description,
          areas: areas.slice(0, 3).map((a) => ({ label: a.areaLabel, color: colors.get(a.areaId) ?? 'var(--muted-foreground)' })),
          fileCount: skill.files.length,
          dimmed: !!highlightSkill && highlightSkill !== skill.id,
          highlight: highlightSkill === skill.id,
        },
      };
    });

    return [...areaNodes, ...skillNodes] as (AreaFlowNode | LandscapeSkillFlowNode)[];
  }, [landscape, skills, skillPositions, areaPositions, colors, highlightSkill]);

  const edges = useMemo<LandscapeFlowEdge[]>(() => {
    return landscape.relationships.map((r) => {
      return {
        id: r.id,
        source: r.source,
        target: r.target,
        type: 'landscape-rel',
        data: {
          kind: r.kind,
          trust: r.trust,
          reason: r.reason,
          dimmed: !!highlightSkill && highlightSkill !== r.source && highlightSkill !== r.target,
          highlight: !!highlightSkill && (highlightSkill === r.source || highlightSkill === r.target),
        },
      };
    });
  }, [landscape.relationships, skillPositions, highlightSkill]);

  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ duration: 500, padding: 0.15, maxZoom: 0.85 }), 100);
    return () => clearTimeout(t);
  }, [rf, landscape]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: LandscapeSkillFlowNode | AreaFlowNode) => {
      if (node.type === 'landscape-skill') {
        onSkillClick(node.id);
      }
    },
    [onSkillClick],
  );

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: LandscapeSkillFlowNode | AreaFlowNode) => {
    if (node.type === 'landscape-skill') setHighlightSkill(node.id);
  }, []);
  const onNodeMouseLeave = useCallback(() => setHighlightSkill(null), []);

  return (
    <div className="relative h-full min-h-0">
      <ReactFlow<AreaFlowNode | LandscapeSkillFlowNode, LandscapeFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={theme}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 0.85 }}
        minZoom={0.15}
        maxZoom={1.5}
        panOnScroll
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--canvas-dot)" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap position="bottom-right" pannable zoomable className="!hidden md:!block" />

        <Panel position="top-right" className="!m-3">
          <div className="rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Legend</p>
            <div className="space-y-1.5">
              {(['verified', 'inferred', 'manual'] as TrustLevel[]).map((t) => (
                <div key={t} className="flex items-center gap-2 text-[11px]">
                  <svg width="24" height="6" className="shrink-0">
                    <line
                      x1="1"
                      y1="3"
                      x2="23"
                      y2="3"
                      stroke="var(--muted-foreground)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={t === 'inferred' ? '5 5' : t === 'manual' ? '2 4' : undefined}
                      opacity={t === 'verified' ? 0.9 : t === 'inferred' ? 0.5 : 0.7}
                    />
                  </svg>
                  <span className="font-medium">{TRUST_META[t].label}</span>
                  <span className="truncate text-muted-foreground">{TRUST_META[t].description}</span>
                </div>
              ))}
              <div className="my-1 h-px bg-border" />
              {(['complement', 'overlap', 'conflict', 'handoff'] as LandscapeKind[]).map((k) => (
                <div key={k} className="flex items-center gap-2 text-[11px]">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: LANDSCAPE_KIND_META[k].color }} />
                  <span className="font-medium">{LANDSCAPE_KIND_META[k].label}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel position="top-left" className="!m-3">
          <Button size="sm" variant="outline" onClick={() => rf.fitView({ duration: 400, padding: 0.15, maxZoom: 0.85 })}>
            <Maximize /> Fit view
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

