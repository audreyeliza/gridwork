import { cloneGrid, createEmptyGrid } from "@/lib/gridFormat";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_HISTORY = 30;

export type UsePatternHistoryReturn = {
  cells: boolean[][];
  commit: (next: boolean[][]) => void;
  replace: (next: boolean[][]) => void;
  reset: (next: boolean[][]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * Undo/redo (30 steps) over a 2D boolean grid. Use `commit` after discrete edits;
 * use `replace` for resizes; use `reset` when loading a new pattern (clears stacks).
 */
export function usePatternHistory(
  width: number,
  height: number,
  initialCells?: boolean[][],
): UsePatternHistoryReturn {
  const [cells, setCells] = useState<boolean[][]>(() => initialCells ?? createEmptyGrid(width, height));
  const [past, setPast] = useState<boolean[][][]>([]);
  const [future, setFuture] = useState<boolean[][][]>([]);

  const cellsRef = useRef(cells);
  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  const commit = useCallback((next: boolean[][]) => {
    setPast((p) => [...p, cloneGrid(cellsRef.current)].slice(-MAX_HISTORY));
    setFuture([]);
    const copy = cloneGrid(next);
    cellsRef.current = copy;
    setCells(copy);
  }, []);

  const replace = useCallback((next: boolean[][]) => {
    const copy = cloneGrid(next);
    cellsRef.current = copy;
    setCells(copy);
  }, []);

  const reset = useCallback((next: boolean[][]) => {
    setPast([]);
    setFuture([]);
    const copy = cloneGrid(next);
    cellsRef.current = copy;
    setCells(copy);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [cloneGrid(cellsRef.current), ...f]);
      const copy = cloneGrid(prev);
      cellsRef.current = copy;
      setCells(copy);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nxt = f[0];
      setPast((p) => [...p, cloneGrid(cellsRef.current)].slice(-MAX_HISTORY));
      const copy = cloneGrid(nxt);
      cellsRef.current = copy;
      setCells(copy);
      return f.slice(1);
    });
  }, []);

  return {
    cells,
    commit,
    replace,
    reset,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
