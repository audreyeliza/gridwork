import type { Json, Pattern } from "@/lib/patternHelpers";
import {
  createEmptyGrid,
  DEFAULT_PALETTE,
  parseGridData,
  serializeGridCells,
  type CellGrid,
} from "@/lib/gridFormat";
import {
  parseImageDocument,
  serializeImageDocument,
  type PatternImageDocument,
} from "@/lib/imageSettings";
import {
  DEFAULT_MANILA_STOCK,
  parseManilaStockFromSettings,
  type ManilaStockId,
} from "@/lib/manilaStock";
import {
  defaultProgressState,
  parseProgressData,
  serializeProgressData,
  type PatternProgressState,
} from "@/lib/progressData";
import {
  DEFAULT_PATTERN_YARN_SETTINGS,
  parsePatternYarnSettings,
  serializePatternYarnSettings,
  type PatternYarnSettings,
} from "@/lib/yarnSettings";

export const OWNER_NOTES_MAX = 2000;

export function clampOwnerNotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, OWNER_NOTES_MAX);
}

export type PatternLocalSnapshot = {
  savedAt: number;
  name: string;
  gridWidth: number;
  gridHeight: number;
  gridData: Json;
  progress: Json;
  yarn: Json;
  image: Json;
  notes?: string;
};

/** Live chart document. Load replaces it; edits patch it; save serializes it. */
export type PatternDocument = {
  savedAt: number;
  name: string;
  gridWidth: number;
  gridHeight: number;
  cells: CellGrid;
  palette: string[];
  progress: PatternProgressState;
  yarn: PatternYarnSettings;
  image: PatternImageDocument;
  manilaStock: ManilaStockId;
  notes: string;
};

/** @deprecated Use PatternDocument */
export type AppliedSnapshot = PatternDocument;

const EMPTY_W = 10;
const EMPTY_H = 40;

function clampGridSize(n: number): number {
  if (Number.isNaN(n) || n < 5) return 5;
  if (n > 200) return 200;
  return Math.floor(n);
}

export function snapshotStorageKey(patternId: string | null): string {
  return patternId ? `gridwork:draft:v2:${patternId}` : "gridwork:draft:v2:guest";
}

export function emptyPatternDocument(opts?: {
  name?: string;
  cells?: CellGrid;
  gridWidth?: number;
  gridHeight?: number;
}): PatternDocument {
  const gridWidth = opts?.gridWidth ?? EMPTY_W;
  const gridHeight = opts?.gridHeight ?? EMPTY_H;
  return {
    savedAt: 0,
    name: opts?.name ?? "Untitled",
    gridWidth,
    gridHeight,
    cells: opts?.cells ?? createEmptyGrid(gridWidth, gridHeight),
    palette: [...DEFAULT_PALETTE],
    progress: defaultProgressState(gridHeight, gridWidth),
    yarn: { ...DEFAULT_PATTERN_YARN_SETTINGS },
    image: { images: [], activeImageId: null },
    manilaStock: DEFAULT_MANILA_STOCK,
    notes: "",
  };
}

export function documentFromPattern(row: Pattern): PatternDocument {
  const gridWidth = clampGridSize(row.grid_width);
  const gridHeight = clampGridSize(row.grid_height);
  const parsed = parseGridData(row.grid_data, gridWidth, gridHeight);
  return {
    savedAt: Date.parse(row.updated_at) || 0,
    name: row.name || "Untitled",
    gridWidth,
    gridHeight,
    cells: parsed.cells,
    palette: parsed.palette,
    progress: parseProgressData(row.progress_data, gridHeight, gridWidth),
    yarn: parsePatternYarnSettings(row.yarn_settings),
    image: parseImageDocument(row.image_settings),
    manilaStock: parseManilaStockFromSettings(row.image_settings),
    notes: clampOwnerNotes(row.owner_notes),
  };
}

/** Local draft wins only when it is strictly newer than the DB row. */
export function pickDocumentSource(
  local: PatternDocument | null,
  db: PatternDocument,
): PatternDocument {
  if (local && local.savedAt > db.savedAt) {
    if (!local.notes && db.notes) return { ...local, notes: db.notes };
    return local;
  }
  return db;
}

export function buildPatternSnapshot(input: {
  name: string;
  gridWidth: number;
  gridHeight: number;
  cells: CellGrid;
  palette: string[];
  progress: PatternProgressState;
  yarn: PatternYarnSettings;
  image: PatternImageDocument;
  manilaStock: ManilaStockId;
  notes: string;
}): PatternLocalSnapshot {
  return {
    savedAt: Date.now(),
    name: input.name,
    gridWidth: input.gridWidth,
    gridHeight: input.gridHeight,
    gridData: serializeGridCells(input.cells, input.palette),
    progress: serializeProgressData(input.progress),
    yarn: serializePatternYarnSettings(input.yarn),
    image: serializeImageDocument(input.image, { manila_stock: input.manilaStock }),
    notes: clampOwnerNotes(input.notes),
  };
}

export function writePatternSnapshot(
  patternId: string | null,
  snapshot: PatternLocalSnapshot,
): void {
  try {
    localStorage.setItem(snapshotStorageKey(patternId), JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export function loadPatternSnapshot(patternId: string | null): PatternLocalSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotStorageKey(patternId));
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (o == null || typeof o !== "object" || Array.isArray(o)) return null;
    const rec = o as Record<string, unknown>;
    if (typeof rec.savedAt !== "number" || !Number.isFinite(rec.savedAt)) return null;
    if (typeof rec.gridWidth !== "number" || typeof rec.gridHeight !== "number") return null;
    return {
      savedAt: rec.savedAt,
      name: typeof rec.name === "string" ? rec.name : "Untitled",
      gridWidth: rec.gridWidth,
      gridHeight: rec.gridHeight,
      gridData: (rec.gridData as Json) ?? null,
      progress: (rec.progress as Json) ?? null,
      yarn: (rec.yarn as Json) ?? null,
      image: (rec.image as Json) ?? null,
      notes: typeof rec.notes === "string" ? rec.notes : "",
    };
  } catch {
    return null;
  }
}

export function applyPatternSnapshot(snap: PatternLocalSnapshot): PatternDocument {
  const w = Math.max(1, Math.floor(snap.gridWidth));
  const h = Math.max(1, Math.floor(snap.gridHeight));
  const parsed = parseGridData(snap.gridData, w, h);
  return {
    savedAt: snap.savedAt,
    name: snap.name,
    gridWidth: w,
    gridHeight: h,
    cells: parsed.cells,
    palette: parsed.palette,
    progress: parseProgressData(snap.progress, h, w),
    yarn: parsePatternYarnSettings(snap.yarn),
    image: parseImageDocument(snap.image),
    manilaStock: parseManilaStockFromSettings(snap.image),
    notes: clampOwnerNotes(snap.notes),
  };
}

export function clearPatternSnapshot(patternId: string | null): void {
  try {
    localStorage.removeItem(snapshotStorageKey(patternId));
  } catch {
    /* ignore */
  }
}
