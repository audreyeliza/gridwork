import type { Json } from "@/lib/patternHelpers";

/** Palette index into `palette`, or `null` for empty (open mesh). */
export type CellValue = number | null;
export type CellGrid = CellValue[][];

export const DEFAULT_HOLE_INK = "#2C2C2C";
export const DEFAULT_PALETTE: string[] = [DEFAULT_HOLE_INK];
export const MAX_INK_WELLS = 12;

export type ParsedGridData = {
  cells: CellGrid;
  palette: string[];
};

export function isCellFilled(cell: CellValue | undefined): boolean {
  return typeof cell === "number" && Number.isInteger(cell) && cell >= 0;
}

export function createEmptyGrid(width: number, height: number): CellGrid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}

export function cloneGrid(grid: CellGrid): CellGrid {
  return grid.map((row) => [...row]);
}

/** Copy overlapping region into a new WxH grid; new cells default to null. */
export function resizeGridPreserve(
  old: CellGrid,
  newWidth: number,
  newHeight: number,
): CellGrid {
  const next = createEmptyGrid(newWidth, newHeight);
  const oldH = old.length;
  const oldW = oldH > 0 ? (old[0]?.length ?? 0) : 0;
  for (let r = 0; r < Math.min(newHeight, oldH); r++) {
    for (let c = 0; c < Math.min(newWidth, oldW); c++) {
      const v = old[r]?.[c];
      next[r]![c] = isCellFilled(v) ? v! : null;
    }
  }
  return next;
}

export function normalizeHexColor(raw: string, fallback = DEFAULT_HOLE_INK): string {
  const s = raw.trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
  if (m) return `#${m[1]!.toUpperCase()}`;
  const m3 = /^#?([0-9a-fA-F]{3})$/.exec(s);
  if (m3) {
    const [a, b, c] = m3[1]!.split("");
    return `#${a}${a}${b}${b}${c}${c}`.toUpperCase();
  }
  return fallback;
}

export function normalizePalette(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_PALETTE];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    out.push(normalizeHexColor(item));
    if (out.length >= MAX_INK_WELLS) break;
  }
  return out.length > 0 ? out : [...DEFAULT_PALETTE];
}

export function serializeGridCells(cells: CellGrid, palette: string[] = DEFAULT_PALETTE): Json {
  return {
    cells: cells.map((row) => row.map((cell) => (isCellFilled(cell) ? cell : null))),
    palette: normalizePalette(palette),
  } as Json;
}

function isBooleanMatrix(value: unknown): value is boolean[][] {
  if (!Array.isArray(value)) return false;
  return value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "boolean"));
}

function isCellMatrix(value: unknown): value is unknown[][] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.every(
        (cell) =>
          cell === null ||
          (typeof cell === "number" && Number.isInteger(cell) && cell >= 0) ||
          typeof cell === "boolean",
      ),
  );
}

/** Map a boolean threshold grid onto palette indices (`fillIndex` for filled). */
export function booleanGridToCells(grid: boolean[][], fillIndex = 0): CellGrid {
  const idx = Math.max(0, Math.floor(fillIndex));
  return grid.map((row) => row.map((filled) => (filled ? idx : null)));
}

/**
 * Remove a palette well and remap cell indices.
 * Cells that used the removed index become empty; higher indices shift down.
 */
export function removePaletteColor(
  cells: CellGrid,
  palette: string[],
  index: number,
): { cells: CellGrid; palette: string[] } {
  if (index < 0 || index >= palette.length || palette.length <= 1) {
    return { cells: cloneGrid(cells), palette: [...palette] };
  }
  const nextPalette = palette.filter((_, i) => i !== index);
  const nextCells = cells.map((row) =>
    row.map((cell) => {
      if (!isCellFilled(cell)) return null;
      if (cell === index) return null;
      if (cell! > index) return cell! - 1;
      return cell;
    }),
  );
  return { cells: nextCells, palette: nextPalette };
}

/** Build a WxH grid + palette from pattern JSON; pads/truncates to match dimensions. */
export function parseGridData(data: Json | undefined, width: number, height: number): ParsedGridData {
  const empty = createEmptyGrid(width, height);
  if (data == null) return { cells: empty, palette: [...DEFAULT_PALETTE] };

  let matrix: unknown = data;
  let paletteRaw: unknown = undefined;
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    if ("cells" in data) matrix = (data as { cells: unknown }).cells;
    if ("palette" in data) paletteRaw = (data as { palette: unknown }).palette;
  }

  const palette = normalizePalette(paletteRaw);

  if (isBooleanMatrix(matrix)) {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        empty[r]![c] = matrix[r]?.[c] ? 0 : null;
      }
    }
    return { cells: empty, palette };
  }

  if (!isCellMatrix(matrix)) return { cells: empty, palette };

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const raw = matrix[r]?.[c];
      if (typeof raw === "boolean") {
        empty[r]![c] = raw ? 0 : null;
      } else if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) {
        empty[r]![c] = raw < palette.length ? raw : null;
      } else {
        empty[r]![c] = null;
      }
    }
  }
  return { cells: empty, palette };
}
