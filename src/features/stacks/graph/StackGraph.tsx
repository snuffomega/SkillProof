import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type NodeChange,
} from '@xyflow/react';
import { toast } from 'sonner';
import { LayoutGrid, Maximize, Plus, Redo2, Undo2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RELATION_COLOR } from '@/components/common';
import { autoLayout, NODE_HEIGHT, NODE_WIDTH } from '@/domain/graph';
import { RELATION_KINDS, RELATION_META, type Issue, type RelationKind, type Skill, type Stack } from '@/domain/types';
import { skillStatus } from '@/domain/versioning';
import { uid } from '@/lib/id';
import { useUI } from '@/store/ui';
import { useStackHistory } from '../useStackHistory';
import { SkillNode, type SkillFlowNode } from './SkillNode';
import { RelationEdge, RelationMarkers, RELATION_ICON, type RelationFlowEdge } from './RelationEdge';
import { Inspector, type Selection } from './Inspector';
import { SkillPalette, SKILL_DRAG_TYPE } from './SkillPalette';
import { cn } from '@/lib/utils';

const nodeTypes = { skill: SkillNode };
const edgeTypes = { relation: RelationEdge };
const SYMMETRIC: Record<RelationKind, boolean> = { depends: false, handoff: false, policy: true, conflict: true };

interface StackGraphProps {
  stack: Stack;
  skills: Skill[];
  issues: Issue[];
}

export function StackGraph(props: StackGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function GraphCanvas({ stack, skills, issues }: StackGraphProps) {
  const theme = useUI((s) => s.theme);
  const graphFocus = useUI((s) => s.graphFocus);
  const rf = useReactFlow<SkillFlowNode, RelationFlowEdge>();
  const wrapper = useRef<HTMLDivElement>(null);
  const { commit, undo, redo, canUndo, canRedo, current } = useStackHistory(stack);
  const [selection, setSelection] = useState<Selection>(null);
  const [newKind, setNewKind] = useState<RelationKind>('handoff');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const skillsById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  useEffect(() => {
    const shape = current.current;
    if (selection?.type === 'node' && !shape.nodes.some((n) => n.id === selection.id)) setSelection(null);
    if (selection?.type === 'edge' && !shape.edges.some((e) => e.id === selection.id)) setSelection(null);
  }, [selection, stack.nodes, stack.edges, current]);

  const counts = useMemo(() => {
    const nodes = new Map<string, { errors: number; warnings: number }>();
    const edgeErrors = new Set<string>();
    for (const i of issues) {
      if (i.target.type === 'node') {
        const c = nodes.get(i.target.nodeId) ?? { errors: 0, warnings: 0 };
        if (i.severity === 'error') c.errors++;
        if (i.severity === 'warning') c.warnings++;
        nodes.set(i.target.nodeId, c);
      }
      if (i.target.type === 'edge' && i.severity === 'error') edgeErrors.add(i.target.edgeId);
    }
    return { nodes, edgeErrors };
  }, [issues]);

  const focusNodeIds = useMemo(() => {
    if (selection?.type === 'node' && stack.nodes.some((n) => n.id === selection.id)) {
      const ids = new Set([selection.id]);
      stack.edges.forEach((e) => {
        if (e.source === selection.id) ids.add(e.target);
        if (e.target === selection.id) ids.add(e.source);
      });
      return ids;
    }
    if (selection?.type === 'edge') {
      const e = stack.edges.find((x) => x.id === selection.id);
      return e ? new Set([e.source, e.target]) : null;
    }
    return null;
  }, [selection, stack.edges]);

  const buildNodes = useCallback(
    (): SkillFlowNode[] =>
      stack.nodes.map((n) => {
        const skill = skillsById.get(n.skillId);
        const c = counts.nodes.get(n.id);
        return {
          id: n.id,
          type: 'skill',
          position: n.position,
          selected: selection?.type === 'node' && selection.id === n.id,
          data: {
            name: skill?.name ?? '',
            description: skill?.description ?? '',
            role: n.role,
            status: skill ? skillStatus(skill) : null,
            version: skill?.publishedVersion ?? null,
            errors: c?.errors ?? 0,
            warnings: c?.warnings ?? 0,
            missing: !skill,
            dimmed: !!focusNodeIds && !focusNodeIds.has(n.id),
          },
        };
      }),
    [stack.nodes, skillsById, counts, selection, focusNodeIds],
  );

  const [nodes, setNodes] = useState<SkillFlowNode[]>(buildNodes);
  useEffect(() => setNodes(buildNodes()), [buildNodes]);

  const edges = useMemo<RelationFlowEdge[]>(
    () =>
      stack.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'relation',
        selected: selection?.type === 'edge' && selection.id === e.id,
        zIndex: selection?.type === 'edge' && selection.id === e.id ? 10 : 0,
        data: {
          kind: e.kind,
          label: e.label,
          hasError: counts.edgeErrors.has(e.id),
          dimmed: !!focusNodeIds && !(focusNodeIds.has(e.source) && focusNodeIds.has(e.target) && (selection?.type !== 'edge' || selection.id === e.id)),
        },
      })),
    [stack.edges, selection, counts, focusNodeIds],
  );

  const onNodesChange = useCallback((changes: NodeChange<SkillFlowNode>[]) => {
    const local = changes.filter((c) => c.type === 'position' || c.type === 'dimensions');
    if (local.length) setNodes((nds) => applyNodeChanges(local, nds));
  }, []);

  const addNode = useCallback(
    (skillId: string, at?: { x: number; y: number }) => {
      let position = at;
      if (!position) {
        const rect = wrapper.current?.getBoundingClientRect();
        const center = rf.screenToFlowPosition({ x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 });
        const jitter = (stack.nodes.length % 5) * 24;
        position = { x: center.x - NODE_WIDTH / 2 + jitter, y: center.y - NODE_HEIGHT / 2 + jitter };
      }
      const id = uid('n');
      void commit((s) => ({ ...s, nodes: [...s.nodes, { id, skillId, position: position!, role: '' }] }));
      setSelection({ type: 'node', id });
    },
    [commit, rf, stack.nodes.length],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      const exists = stack.edges.some(
        (e) => e.kind === newKind && ((e.source === c.source && e.target === c.target) || (SYMMETRIC[newKind] && e.source === c.target && e.target === c.source)),
      );
      if (exists) return toast.info(`These skills are already connected with “${RELATION_META[newKind].label}”`);
      const id = uid('e');
      void commit((s) => ({ ...s, edges: [...s.edges, { id, source: c.source, target: c.target, kind: newKind, label: '', notes: '', detail: '' }] }));
      setSelection({ type: 'edge', id });
    },
    [commit, newKind, stack.edges],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.type === 'edge') void commit((s) => ({ ...s, edges: s.edges.filter((e) => e.id !== selection.id) }));
    else
      void commit((s) => ({
        nodes: s.nodes.filter((n) => n.id !== selection.id),
        edges: s.edges.filter((e) => e.source !== selection.id && e.target !== selection.id),
        contract: {
          ...s.contract,
          checkpoints: s.contract.checkpoints.map((c) => (c.afterNodeId === selection.id ? { ...c, afterNodeId: null } : c)),
          outputs: s.contract.outputs.map((o) => (o.producedBy === selection.id ? { ...o, producedBy: null } : o)),
        },
      }));
    setSelection(null);
  }, [commit, selection]);

  const layout = () => {
    void commit((s) => ({ ...s, nodes: autoLayout(s.nodes, s.edges) }));
    setTimeout(() => rf.fitView({ duration: 450, padding: 0.2, maxZoom: 1.1 }), 80);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection) {
          e.preventDefault();
          deleteSelection();
        }
      } else if (e.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, deleteSelection, selection]);

  useEffect(() => {
    if (!graphFocus) return;
    const t = setTimeout(() => {
      if (graphFocus.nodeId) {
        const n = stack.nodes.find((x) => x.id === graphFocus.nodeId);
        if (n) {
          setSelection({ type: 'node', id: n.id });
          rf.setCenter(n.position.x + NODE_WIDTH / 2, n.position.y + NODE_HEIGHT / 2, { zoom: Math.max(rf.getZoom(), 1), duration: 500 });
        }
      } else if (graphFocus.edgeId) {
        const e = stack.edges.find((x) => x.id === graphFocus.edgeId);
        const a = e && stack.nodes.find((n) => n.id === e.source);
        const b = e && stack.nodes.find((n) => n.id === e.target);
        if (e && a && b) {
          setSelection({ type: 'edge', id: e.id });
          rf.setCenter((a.position.x + b.position.x) / 2 + NODE_WIDTH / 2, (a.position.y + b.position.y) / 2 + NODE_HEIGHT / 2, { zoom: Math.max(rf.getZoom(), 1), duration: 500 });
        }
      }
      useUI.setState({ graphFocus: null });
    }, 120);
    return () => clearTimeout(t);
  }, [graphFocus?.nonce]);

  const usedIds = useMemo(() => new Set(stack.nodes.map((n) => n.skillId)), [stack.nodes]);

  return (
    <div className="relative flex h-full min-h-0">
      <div ref={wrapper} className="relative min-w-0 flex-1">
        <RelationMarkers />
        <ReactFlow<SkillFlowNode, RelationFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={theme}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          isValidConnection={(c) => c.source !== c.target}
          onNodeClick={(_, n) => setSelection({ type: 'node', id: n.id })}
          onNodeDragStart={(_, n) => setSelection({ type: 'node', id: n.id })}
          onNodeDragStop={(_, n) => {
            const prev = stack.nodes.find((x) => x.id === n.id)?.position;
            if (prev && prev.x === n.position.x && prev.y === n.position.y) return;
            void commit((s) => ({ ...s, nodes: s.nodes.map((x) => (x.id === n.id ? { ...x, position: n.position } : x)) }));
          }}
          onEdgeClick={(_, e) => setSelection({ type: 'edge', id: e.id })}
          onPaneClick={() => {
            setSelection(null);
            setPaletteOpen(false);
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(SKILL_DRAG_TYPE)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(e) => {
            const skillId = e.dataTransfer.getData(SKILL_DRAG_TYPE);
            if (!skillId) return;
            e.preventDefault();
            const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
            addNode(skillId, { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 });
          }}
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
          selectionKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.22, maxZoom: 1.05 }}
          minZoom={0.25}
          maxZoom={2}
          snapToGrid
          snapGrid={[8, 8]}
          connectionRadius={28}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--canvas-dot)" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap position="bottom-right" pannable zoomable nodeColor={() => 'var(--muted-foreground)'} nodeStrokeWidth={0} className="!hidden md:!block" />

          <Panel position="top-left" className="!m-3">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-popover/95 p-1 shadow-lg backdrop-blur">
              <Button size="sm" variant={paletteOpen ? 'secondary' : 'ghost'} onClick={() => setPaletteOpen((o) => !o)}>
                <Plus /> Add skill
              </Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <span className="hidden pl-1 pr-0.5 text-[11px] text-muted-foreground sm:inline">Connect as</span>
              {RELATION_KINDS.map((k) => {
                const Icon = RELATION_ICON[k];
                const active = newKind === k;
                return (
                  <Tooltip key={k}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setNewKind(k)}
                        aria-pressed={active}
                        aria-label={`New connections: ${RELATION_META[k].label}`}
                        className={cn('flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors', active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60')}
                      >
                        <span style={{ color: RELATION_COLOR[k] }}>
                          <Icon className="size-3.5" />
                        </span>
                        {active && <span>{RELATION_META[k].label}</span>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56">{RELATION_META[k].description}</TooltipContent>
                  </Tooltip>
                );
              })}
              <span className="mx-1 h-5 w-px bg-border" />
              <ToolButton label="Auto layout" onClick={layout} disabled={!stack.nodes.length}>
                <LayoutGrid />
              </ToolButton>
              <ToolButton label="Fit to view" onClick={() => rf.fitView({ duration: 400, padding: 0.22, maxZoom: 1.05 })}>
                <Maximize />
              </ToolButton>
              <ToolButton label="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
                <Undo2 />
              </ToolButton>
              <ToolButton label="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
                <Redo2 />
              </ToolButton>
            </div>
            {paletteOpen && (
              <div className="mt-2">
                <SkillPalette skills={skills} usedIds={usedIds} onAdd={(id) => addNode(id)} onClose={() => setPaletteOpen(false)} />
              </div>
            )}
          </Panel>
        </ReactFlow>

        {stack.nodes.length === 0 && !paletteOpen && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="pointer-events-auto max-w-sm rounded-2xl border bg-popover/95 p-6 text-center shadow-xl backdrop-blur fade-up">
              <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl border bg-surface">
                <Workflow className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-[14px] font-medium">Start composing this stack</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Add skills from your library, then drag between them to describe how they depend on, hand off to, or constrain each other.</p>
              <Button className="mt-4" size="sm" onClick={() => setPaletteOpen(true)}>
                <Plus /> Add skills
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={cn('absolute inset-y-0 right-0 z-20 flex shadow-2xl lg:static lg:shadow-none', !selection && 'hidden lg:flex')}>
        <Inspector stack={stack} selection={selection} onSelect={setSelection} commit={commit} issues={issues} skillsById={skillsById} />
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
