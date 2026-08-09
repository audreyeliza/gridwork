import { cloneGrid, createEmptyGrid, type CellGrid } from "@/lib/gridFormat";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_HISTORY = 30;

export type UsePatternHistoryReturn = {
  cells: CellGrid;
  commit: (next: CellGrid) => void;
  replace: (next: CellGrid) => void;
  reset: (next: CellGrid) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * Undo/redo (30 steps) over a 2D cell grid (palette indices or null).
 * Use `commit` after discrete edits; `replace` for resizes; `reset` when loading a pattern.
 */
export function usePatternHistory(
  width: number,
  height: number,
  initialCells?: CellGrid,
): UsePatternHistoryReturn {
  const [cells, setCells] = useState<CellGrid>(() => initialCells ?? createEmptyGrid(width, height));
  const [past, setPast] = useState<CellGrid[]>([]);
  const [future, setFuture] = useState<CellGrid[]>([]);

  const cellsRef = useRef(cells);
  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  const commit = useCallback((next: CellGrid) => {
    setPast((p) => [...p, cloneGrid(cellsRef.current)].slice(-MAX_HISTORY));
    setFuture([]);
    const copy = cloneGrid(next);
    cellsRef.current = copy;
    setCells(copy);
  }, []);

  const replace = useCallback((next: CellGrid) => {
    const copy = cloneGrid(next);
    cellsRef.current = copy;
    setCells(copy);
  }, []);

  const reset = useCallback((next: CellGrid) => {
    setPast([]);
    setFuture([]);
    const copy = cloneGrid(next);
    cellsRef.current = copy;
    setCells(copy);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1]!;
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
      const nxt = f[0]!;
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
