import { DEFAULT_CRAFT_MODE, parseCraftMode, type CraftMode } from "@/lib/craftMode";
import type { Json } from "@/lib/patternHelpers";

export const TRACK_MODES = ["row", "col", "diag", "diagUp"] as const;
export type TrackMode = (typeof TRACK_MODES)[number];

export function isDiagTrack(mode: TrackMode): boolean {
  return mode === "diag" || mode === "diagUp";
}

export function trackStepLabel(mode: TrackMode): string {
  if (mode === "diag") return "Diag↘";
  if (mode === "diagUp") return "Diag↗";
  if (mode === "col") return "Col";
  return "Row";
}

export type PatternProgressState = {
  trackMode: TrackMode;
  /** Length = trackLength(mode, w, h). Index 0 is first row (top) / left col / first diagonal. */
  rowComplete: boolean[];
  /** Active track index, 0-based (row, column, or diagonal). */
  currentRow: number;
  editLocked: boolean;
  /** View-only horizontal mirror (turned work). */
  mirrorView: boolean;
  craft: CraftMode;
};

export type DiagAnchor = {
  edge: "left" | "bottom" | "right";
  row: number;
  col: number;
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
  if (isDiagTrack(mode)) return diagonalCount(gridWidth, gridHeight);
  if (mode === "col") return Math.max(0, gridWidth);
  return Math.max(0, gridHeight);
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
    editLocked: false,
    mirrorView: false,
    craft: DEFAULT_CRAFT_MODE,
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
    ...prev,
    trackMode,
    rowComplete: resizeRowComplete(prev.rowComplete, len),
    currentRow: clampCurrentRow(prev.currentRow, len),
  };
}

function parseTrackMode(v: unknown): TrackMode {
  if (v === "col" || v === "diag" || v === "diagUp" || v === "row") return v;
  return "row";
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
  const trackMode = parseTrackMode(o.trackMode);
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

  return {
    trackMode,
    rowComplete,
    currentRow,
    editLocked: o.editLocked === true,
    mirrorView: o.mirrorView === true,
    craft: parseCraftMode(o.craft),
  };
}

export function serializeProgressData(p: PatternProgressState): Json {
  return {
    trackMode: p.trackMode,
    rowComplete: p.rowComplete,
    currentRow: p.currentRow,
    editLocked: p.editLocked,
    mirrorView: p.mirrorView,
    craft: p.craft,
  } as Json;
}

/** Data-row index (0 = top of the cell array) for track index 0 = top. */
export function dataRowForTrack(trackIndex: number, _gridHeight?: number): number {
  return trackIndex;
}

/** Row number (1-based, top is 1) for a data-row index. */
export function crochetRowLabel(dataRow: number, _gridHeight?: number): number {
  return dataRow + 1;
}

/**
 * Column on diagonal `d` at row `r`, or null if that cell is off the grid.
 * diag (↘): r + c === d. diagUp (↗): r + (W-1-c) === d.
 */
export function diagColAtRow(
  d: number,
  r: number,
  gridWidth: number,
  mode: TrackMode,
): number | null {
  if (mode === "diag") {
    const c = d - r;
    return c >= 0 && c < gridWidth ? c : null;
  }
  if (mode === "diagUp") {
    const c = r + (gridWidth - 1) - d;
    return c >= 0 && c < gridWidth ? c : null;
  }
  return null;
}

/**
 * Where to park the checkbox for diagonal `d`.
 * ↘: early marks on the left, rest along the bottom.
 * ↗: early marks on the right, rest along the bottom.
 */
export function diagonalAnchor(
  d: number,
  gridWidth: number,
  gridHeight: number,
  mode: TrackMode = "diag",
): DiagAnchor {
  if (mode === "diagUp") {
    if (d < gridHeight) {
      return { edge: "right", row: d, col: Math.max(0, gridWidth - 1) };
    }
    const bottomCol = gridWidth + gridHeight - 2 - d;
    if (bottomCol >= 0 && bottomCol < gridWidth) {
      return { edge: "bottom", row: gridHeight - 1, col: bottomCol };
    }
    return { edge: "left", row: Math.max(0, Math.min(gridHeight - 1, d)), col: 0 };
  }
  if (d < gridHeight) {
    return { edge: "left", row: d, col: 0 };
  }
  const bottomCol = d - (gridHeight - 1);
  if (bottomCol >= 0 && bottomCol < gridWidth) {
    return { edge: "bottom", row: gridHeight - 1, col: bottomCol };
  }
  const rightRow = d - (gridWidth - 1);
  return {
    edge: "right",
    row: Math.max(0, Math.min(gridHeight - 1, rightRow)),
    col: Math.max(0, gridWidth - 1),
  };
}
