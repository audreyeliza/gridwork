import type { Json } from "@/lib/patternHelpers";

export type TrackMode = "row" | "diag";

export type PatternProgressState = {
  trackMode: TrackMode;
  /** Length = gridHeight (row) or gridWidth+gridHeight-1 (diag). */
  rowComplete: boolean[];
  /** Active track index, 0-based (row or diagonal). */
  currentRow: number;
};

export function diagonalCount(gridWidth: number, gridHeight: number): number {
  if (gridWidth <= 0 || gridHeight <= 0) return 0;
  return gridWidth + gridHeight - 1;
}

export function trackLength(
  mode: TrackMode,
  gridWidth: number,
  gridHeight: number,
): number {
  return mode === "diag" ? diagonalCount(gridWidth, gridHeight) : Math.max(0, gridHeight);
}

export function defaultProgressState(
  gridHeight: number,
  gridWidth = 10,
  trackMode: TrackMode = "row",
): PatternProgressState {
  const len = trackLength(trackMode, gridWidth, gridHeight);
  return {
    trackMode,
    rowComplete: Array.from({ length: len }, () => false),
    currentRow: 0,
  };
}

export function clampCurrentRow(row: number, trackLen: number): number {
  if (trackLen <= 0) return 0;
  return Math.min(trackLen - 1, Math.max(0, Math.floor(row)));
}

export function resizeRowComplete(prev: boolean[], newLength: number): boolean[] {
  return Array.from({ length: newLength }, (_, i) => Boolean(prev[i]));
}

/** Resize progress when grid size or track mode changes. */
export function resizeProgressForGrid(
  prev: PatternProgressState,
  gridWidth: number,
  gridHeight: number,
  trackMode: TrackMode = prev.trackMode,
): PatternProgressState {
  const len = trackLength(trackMode, gridWidth, gridHeight);
  return {
    trackMode,
    rowComplete: resizeRowComplete(prev.rowComplete, len),
    currentRow: clampCurrentRow(prev.currentRow, len),
  };
}

export function parseProgressData(
  data: Json | undefined,
  gridHeight: number,
  gridWidth = 10,
): PatternProgressState {
  const base = defaultProgressState(gridHeight, gridWidth, "row");
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return base;
  }
  const o = data as Record<string, unknown>;
  const trackMode: TrackMode = o.trackMode === "diag" ? "diag" : "row";
  const len = trackLength(trackMode, gridWidth, gridHeight);

  let rowComplete = Array.from({ length: len }, () => false);
  if (Array.isArray(o.rowComplete)) {
    const rc = o.rowComplete as unknown[];
    rowComplete = Array.from({ length: len }, (_, i) => Boolean(rc[i]));
  }

  let currentRow = 0;
  if (typeof o.currentRow === "number" && Number.isFinite(o.currentRow)) {
    currentRow = clampCurrentRow(o.currentRow, len);
  }

  return { trackMode, rowComplete, currentRow };
}

export function serializeProgressData(p: PatternProgressState): Json {
  return {
    trackMode: p.trackMode,
    rowComplete: p.rowComplete,
    currentRow: p.currentRow,
  } as Json;
}
