import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepository } from '@/data/hooks';
import type { Contract, Stack, StackEdge, StackNode } from '@/domain/types';

export interface GraphShape {
  nodes: StackNode[];
  edges: StackEdge[];
  contract: Contract;
}

const LIMIT = 60;

/**
 * Graph mutations with undo/redo. `current` is updated optimistically so
 * consecutive edits never build on a stale snapshot while the write is in flight.
 */
export function useStackHistory(stack: Stack) {
  const repo = useRepository();
  const current = useRef<GraphShape>({ nodes: stack.nodes, edges: stack.edges, contract: stack.contract });
  const past = useRef<GraphShape[]>([]);
  const future = useRef<GraphShape[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    current.current = { nodes: stack.nodes, edges: stack.edges, contract: stack.contract };
  }, [stack.nodes, stack.edges, stack.contract]);

  useEffect(() => {
    past.current = [];
    future.current = [];
    bump((n) => n + 1);
  }, [stack.id]);

  const write = useCallback(
    (next: GraphShape) => {
      current.current = next;
      bump((n) => n + 1);
      return repo.updateStack(stack.id, next);
    },
    [repo, stack.id],
  );

  /** Apply an edit. `trackHistory: false` for layout-only moves that shouldn't crowd the undo stack. */
  const commit = useCallback(
    (fn: (s: GraphShape) => GraphShape, trackHistory = true) => {
      const prev = current.current;
      const next = fn(prev);
      if (trackHistory) {
        past.current = [...past.current.slice(-LIMIT + 1), prev];
        future.current = [];
      }
      return write(next);
    },
    [write],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(current.current);
    void write(prev);
  }, [write]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    void write(next);
  }, [write]);

  return { commit, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, current };
}
