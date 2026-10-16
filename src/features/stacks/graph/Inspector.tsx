import { ArrowLeftRight, BookOpen, ChevronRight, MousePointerClick, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RelationSwatch, StatusBadge } from '@/components/common';
import { RELATION_KINDS, RELATION_META, type Issue, type RelationKind, type Skill, type Stack, type StackEdge } from '@/domain/types';
import { skillStatus } from '@/domain/versioning';
import { useUI } from '@/store/ui';
import { IssueList } from '@/features/shared/IssueList';
import { CommitInput, CommitTextarea } from '@/features/shared/fields';
import { RELATION_ICON } from './RelationEdge';
import type { GraphShape } from '../useStackHistory';
import { cn } from '@/lib/utils';

export type Selection = { type: 'node'; id: string } | { type: 'edge'; id: string } | null;

interface InspectorProps {
  stack: Stack;
  selection: Selection;
  onSelect: (s: Selection) => void;
  commit: (fn: (s: GraphShape) => GraphShape) => unknown;
  issues: Issue[];
  skillsById: Map<string, Skill>;
}

const DETAIL_LABEL: Record<RelationKind, { label: string; placeholder: string }> = {
  depends: { label: 'What is required', placeholder: 'e.g. Security findings must be addressed before approval' },
  handoff: { label: 'Artifact handed off', placeholder: 'e.g. Approved spec with acceptance criteria' },
  policy: { label: 'Shared policy', placeholder: 'e.g. Secrets never appear in logs or output' },
  conflict: { label: 'Resolution rule', placeholder: 'e.g. Test standards win once a prototype is promoted to main' },
};

export function Inspector({ stack, selection, onSelect, commit, issues, skillsById }: InspectorProps) {
  const node = selection?.type === 'node' ? stack.nodes.find((n) => n.id === selection.id) : undefined;
  const edge = selection?.type === 'edge' ? stack.edges.find((e) => e.id === selection.id) : undefined;

  return (
    <aside className="scrollbar-thin flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-surface/60">
      {node ? (
        <NodeInspector key={node.id} stack={stack} nodeId={node.id} onSelect={onSelect} commit={commit} issues={issues} skillsById={skillsById} />
      ) : edge ? (
        <EdgeInspector key={edge.id} stack={stack} edge={edge} onSelect={onSelect} commit={commit} issues={issues} skillsById={skillsById} />
      ) : (
        <StackSummary stack={stack} />
      )}
    </aside>
  );
}

function Section({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border-b px-4 py-4', className)}>
      {title && <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h4>}
      {children}
    </section>
  );
}

function InspectorHeader({ eyebrow, title, onClose }: { eyebrow: string; title: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2 border-b px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
        <div className="mt-1 text-[13px] font-medium">{title}</div>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close inspector">
        <X />
      </Button>
    </div>
  );
}

function NodeInspector({ stack, nodeId, onSelect, commit, issues, skillsById }: Omit<InspectorProps, 'selection'> & { nodeId: string }) {
  const navigate = useUI((s) => s.navigate);
  const node = stack.nodes.find((n) => n.id === nodeId)!;
  const skill = skillsById.get(node.skillId);
  const name = (id: string) => skillsById.get(stack.nodes.find((n) => n.id === id)?.skillId ?? '')?.name ?? 'missing skill';
  const connections = stack.edges.filter((e) => e.source === node.id || e.target === node.id);
  const nodeIssues = issues.filter((i) => i.target.type === 'node' && i.target.nodeId === node.id);

  const remove = () => {
    commit((s) => ({
      nodes: s.nodes.filter((n) => n.id !== node.id),
      edges: s.edges.filter((e) => e.source !== node.id && e.target !== node.id),
      contract: {
        ...s.contract,
        checkpoints: s.contract.checkpoints.map((c) => (c.afterNodeId === node.id ? { ...c, afterNodeId: null } : c)),
        outputs: s.contract.outputs.map((o) => (o.producedBy === node.id ? { ...o, producedBy: null } : o)),
      },
    }));
    onSelect(null);
  };

  return (
    <>
      <InspectorHeader eyebrow="Skill" title={<span className="font-mono">{skill?.name || 'Missing skill'}</span>} onClose={() => onSelect(null)} />
      {skill && (
        <Section>
          <div className="mb-2 flex items-center gap-2">
            <StatusBadge status={skillStatus(skill)} version={skill.publishedVersion} />
            <span className="text-xs text-muted-foreground">{skill.folder || 'Unsorted'}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{skill.description || 'No description'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate({ view: 'library', skillId: skill.id, tab: 'edit' })}>
            <BookOpen /> Open in library
          </Button>
        </Section>
      )}
      <Section title="Role in this stack">
        <CommitInput
          value={node.role}
          aria-label="Role"
          placeholder="e.g. Gatekeeper, Author, Reviewer"
          onCommit={(role) => commit((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, role } : n)) }))}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">Describes responsibility, not procedure.</p>
      </Section>
      <Section title={`Connections · ${connections.length}`}>
        {connections.length === 0 ? (
          <p className="text-xs text-muted-foreground">Drag from the right handle of this node to another skill to connect them.</p>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {connections.map((e) => (
              <li key={e.id}>
                <button onClick={() => onSelect({ type: 'edge', id: e.id })} className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent">
                  <RelationSwatch kind={e.kind} />
                  <span className="min-w-0 flex-1 truncate">
                    {e.source === node.id ? (
                      <>
                        {RELATION_META[e.kind].verb} <span className="font-mono">{name(e.target)}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono">{name(e.source)}</span> {RELATION_META[e.kind].verb} this
                      </>
                    )}
                  </span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {nodeIssues.length > 0 && (
        <Section title="Issues" className="px-0 pb-1">
          <IssueList issues={nodeIssues} compact />
        </Section>
      )}
      <div className="mt-auto p-4">
        <Button variant="outline" className="w-full hover:border-err/40 hover:text-err" onClick={remove}>
          <Trash2 /> Remove from stack
        </Button>
      </div>
    </>
  );
}

function EdgeInspector({ stack, edge, onSelect, commit, issues, skillsById }: Omit<InspectorProps, 'selection'> & { edge: StackEdge }) {
  const name = (id: string) => skillsById.get(stack.nodes.find((n) => n.id === id)?.skillId ?? '')?.name ?? 'missing skill';
  const edgeIssues = issues.filter((i) => i.target.type === 'edge' && i.target.edgeId === edge.id);
  const patch = (p: Partial<StackEdge>) => commit((s) => ({ ...s, edges: s.edges.map((e) => (e.id === edge.id ? { ...e, ...p } : e)) }));
  const detail = DETAIL_LABEL[edge.kind];

  return (
    <>
      <InspectorHeader
        eyebrow="Connection"
        title={
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono">{name(edge.source)}</span>
            <span className="text-muted-foreground">{RELATION_META[edge.kind].verb}</span>
            <span className="font-mono">{name(edge.target)}</span>
          </span>
        }
        onClose={() => onSelect(null)}
      />
      <Section title="Relationship">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Relationship kind">
          {RELATION_KINDS.map((k) => {
            const Icon = RELATION_ICON[k];
            const active = edge.kind === k;
            return (
              <button
                key={k}
                role="radio"
                aria-checked={active}
                onClick={() => !active && patch({ kind: k })}
                className={cn('flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors', active ? 'border-foreground/30 bg-accent' : 'hover:bg-accent/50')}
              >
                <span style={{ color: `var(--rel-${k})` }}>
                  <Icon className="size-3.5" />
                </span>
                {RELATION_META[k].label}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">{RELATION_META[edge.kind].description}</p>
        {(edge.kind === 'depends' || edge.kind === 'handoff') && (
          <Button variant="ghost" size="sm" className="-ml-2 mt-1.5" onClick={() => patch({ source: edge.target, target: edge.source })}>
            <ArrowLeftRight /> Reverse direction
          </Button>
        )}
      </Section>
      <Section>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="edge-label" className="text-xs">
              Label
            </Label>
            <CommitInput id="edge-label" value={edge.label} onCommit={(label) => patch({ label })} placeholder={RELATION_META[edge.kind].label} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edge-detail" className="text-xs">
              {detail.label}
              {(edge.kind === 'conflict' || edge.kind === 'handoff') && <span className={edge.kind === 'conflict' ? 'text-err' : 'text-warn'}> *</span>}
            </Label>
            <CommitTextarea id="edge-detail" rows={3} value={edge.detail} onCommit={(d) => patch({ detail: d })} placeholder={detail.placeholder} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edge-notes" className="text-xs">
              Notes
            </Label>
            <CommitTextarea id="edge-notes" rows={2} value={edge.notes} onCommit={(notes) => patch({ notes })} placeholder="Context for people maintaining this stack" />
          </div>
        </div>
      </Section>
      {edgeIssues.length > 0 && (
        <Section title="Issues" className="px-0 pb-1">
          <IssueList issues={edgeIssues} compact />
        </Section>
      )}
      <div className="mt-auto p-4">
        <Button
          variant="outline"
          className="w-full hover:border-err/40 hover:text-err"
          onClick={() => {
            commit((s) => ({ ...s, edges: s.edges.filter((e) => e.id !== edge.id) }));
            onSelect(null);
          }}
        >
          <Trash2 /> Delete connection
        </Button>
      </div>
    </>
  );
}

function StackSummary({ stack }: { stack: Stack }) {
  const counts = RELATION_KINDS.map((k) => ({ kind: k, count: stack.edges.filter((e) => e.kind === k).length }));
  return (
    <>
      <Section title="Relationships">
        <ul className="space-y-2.5">
          {counts.map(({ kind, count }) => (
            <li key={kind} className="flex items-start gap-2.5">
              <RelationSwatch kind={kind} className="mt-1.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center text-xs font-medium">
                  <span className="flex-1">{RELATION_META[kind].label}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{RELATION_META[kind].description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Editing">
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <MousePointerClick className="mt-0.5 size-3.5 shrink-0" />
            Select a skill or connection to edit it here.
          </li>
          <li>
            Drag from a node's right handle to another node. New connections use the kind chosen in the toolbar.
          </li>
          <li>
            <span className="kbd">Del</span> removes the selection · <span className="kbd">⌘Z</span> undo · <span className="kbd">⇧⌘Z</span> redo
          </li>
        </ul>
      </Section>
    </>
  );
}
