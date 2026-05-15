import type { Json } from "@/lib/patternHelpers";

export function createEmptyGrid(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => false));
}

export function cloneGrid(grid: boolean[][]): boolean[][] {
  return grid.map((row) => [...row]);
}

/** Copy overlapping region into a new WxH grid; new cells default to false. */
export function resizeGridPreserve(
  old: boolean[][],
  newWidth: number,
  newHeight: number,
): boolean[][] {
  const next = createEmptyGrid(newWidth, newHeight);
  const oldH = old.length;
  const oldW = oldH > 0 ? (old[0]?.length ?? 0) : 0;
  for (let r = 0; r < Math.min(newHeight, oldH); r++) {
    for (let c = 0; c < Math.min(newWidth, oldW); c++) {
      next[r][c] = Boolean(old[r]?.[c]);
    }
  }
  return next;
}

export function serializeGridCells(cells: boolean[][]): Json {
  return { cells: cells.map((row) => [...row]) } as Json;
}

function isBooleanMatrix(value: unknown): value is boolean[][] {
  if (!Array.isArray(value)) return false;
  return value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "boolean"));
}

/** Build a WxH grid from pattern JSON; pads/truncates to match dimensions. */
export function parseGridData(data: Json | undefined, width: number, height: number): boolean[][] {
  const empty = createEmptyGrid(width, height);
  if (data == null) return empty;

  let matrix: unknown = data;
  if (typeof data === "object" && data !== null && !Array.isArray(data) && "cells" in data) {
    matrix = (data as { cells: unknown }).cells;
  }

  if (!isBooleanMatrix(matrix)) return empty;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      empty[r][c] = Boolean(matrix[r]?.[c]);
    }
  }
  return empty;
}
