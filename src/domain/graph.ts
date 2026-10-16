import type { StackEdge, StackNode } from './types';

/** Strongly connected components with more than one node, i.e. dependency cycles (Tarjan). */
export function findCycles(nodeIds: string[], edges: { source: string; target: string }[]): string[][] {
  const adj = new Map<string, string[]>();
  nodeIds.forEach((id) => adj.set(id, []));
  edges.forEach((e) => adj.get(e.source)?.push(e.target));

  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];

  const visit = (v: string) => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        if (!adj.has(w)) continue;
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) result.push(comp.reverse());
    }
  };

  nodeIds.forEach((id) => {
    if (!idx.has(id)) visit(id);
  });
  return result;
}

/** Edges oriented in execution order: prerequisites and upstream work point to what comes after. */
function flowEdges(edges: StackEdge[]) {
  return edges
    .filter((e) => e.kind === 'depends' || e.kind === 'handoff')
    .map((e) => (e.kind === 'depends' ? { from: e.target, to: e.source } : { from: e.source, to: e.target }));
}

export function computeRanks(nodes: StackNode[], edges: StackEdge[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const flows = flowEdges(edges).filter((f) => ids.has(f.from) && ids.has(f.to) && f.from !== f.to);
  const incoming = new Map<string, string[]>();
  nodes.forEach((n) => incoming.set(n.id, []));
  flows.forEach((f) => incoming.get(f.to)!.push(f.from));

  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    if (rank.has(id)) return rank.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const preds = incoming.get(id)!;
    const r = preds.length ? Math.max(...preds.map((p) => resolve(p) + 1)) : 0;
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  nodes.forEach((n) => resolve(n.id));
  return rank;
}

export const NODE_WIDTH = 248;
export const NODE_HEIGHT = 96;

export function autoLayout(nodes: StackNode[], edges: StackEdge[]): StackNode[] {
  const ranks = computeRanks(nodes, edges);
  const columns = new Map<number, StackNode[]>();
  nodes.forEach((n) => {
    const r = ranks.get(n.id) ?? 0;
    if (!columns.has(r)) columns.set(r, []);
    columns.get(r)!.push(n);
  });
  const gapX = NODE_WIDTH + 110;
  const gapY = NODE_HEIGHT + 56;
  const tallest = Math.max(1, ...[...columns.values()].map((c) => c.length));
  const positions = new Map<string, { x: number; y: number }>();
  [...columns.entries()].forEach(([r, col]) => {
    col.sort((a, b) => a.position.y - b.position.y);
    const offset = ((tallest - col.length) * gapY) / 2;
    col.forEach((n, i) => positions.set(n.id, { x: r * gapX, y: offset + i * gapY }));
  });
  return nodes.map((n) => ({ ...n, position: positions.get(n.id)! }));
}
