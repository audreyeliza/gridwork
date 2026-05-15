import type { Json } from "@/lib/patternHelpers";

export type PatternProgressState = {
  rowComplete: boolean[];
  /** Active row index, 0-based. */
  currentRow: number;
};

export function defaultProgressState(gridHeight: number): PatternProgressState {
  return {
    rowComplete: Array.from({ length: gridHeight }, () => false),
    currentRow: 0,
  };
}

export function clampCurrentRow(row: number, gridHeight: number): number {
  if (gridHeight <= 0) return 0;
  return Math.min(gridHeight - 1, Math.max(0, Math.floor(row)));
}

export function resizeRowComplete(prev: boolean[], newHeight: number): boolean[] {
  return Array.from({ length: newHeight }, (_, i) => Boolean(prev[i]));
}

export function parseProgressData(data: Json | undefined, gridHeight: number): PatternProgressState {
  const base = defaultProgressState(gridHeight);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return base;
  }
  const o = data as Record<string, unknown>;
  let rowComplete = base.rowComplete;
  if (Array.isArray(o.rowComplete)) {
    const rc = o.rowComplete as unknown[];
    rowComplete = Array.from({ length: gridHeight }, (_, i) => Boolean(rc[i]));
  }
  let currentRow = base.currentRow;
  if (typeof o.currentRow === "number" && Number.isFinite(o.currentRow)) {
    currentRow = clampCurrentRow(o.currentRow, gridHeight);
  }
  return { rowComplete, currentRow };
}

export function serializeProgressData(p: PatternProgressState): Json {
  return {
    rowComplete: p.rowComplete,
    currentRow: p.currentRow,
  } as Json;
}
