export const YARN_WEIGHT_CATEGORIES = [
  "lace",
  "fingering",
  "sport",
  "dk",
  "worsted",
  "bulky",
  "super_bulky",
] as const;

export type YarnWeightCategory = (typeof YARN_WEIGHT_CATEGORIES)[number];

export type YarnEstimateInput = {
  weight: YarnWeightCategory;
  /** Free text, e.g. "5.5 mm" or "US H/8". */
  hookSize: string;
  /** Squares per 10 cm; when set and different from auto, scales Amount. */
  customGaugeStitchesPerInch?: number | null;
  gridWidth: number;
  gridHeight: number;
  filledCellCount: number;
  emptyCellCount: number;
};

export type YarnEstimateResult = {
  yards: number;
  meters: number;
  grams: number;
  oz: number;
};

type YarnRow = {
  /** Typical ballpark yards per 100 g for that weight class. */
  yardsPer100g: number;
  /**
   * Heuristic: mesh-equivalent units per 100 g at the recommended hook.
   * Filet dc: one mesh cell = 1 unit; one filled (block) cell = 3 units.
   */
  meshEquivUnitsPer100g: number;
};

const YARN_TABLE: Record<YarnWeightCategory, YarnRow> = {
  lace: { yardsPer100g: 900, meshEquivUnitsPer100g: 14_000 },
  fingering: { yardsPer100g: 410, meshEquivUnitsPer100g: 6_200 },
  sport: { yardsPer100g: 330, meshEquivUnitsPer100g: 4_800 },
  dk: { yardsPer100g: 280, meshEquivUnitsPer100g: 3_900 },
  worsted: { yardsPer100g: 200, meshEquivUnitsPer100g: 2_800 },
  bulky: { yardsPer100g: 120, meshEquivUnitsPer100g: 1_700 },
  super_bulky: { yardsPer100g: 60, meshEquivUnitsPer100g: 900 },
};

const BLOCK_TO_MESH_YARN_RATIO = 3;

const METERS_PER_YARD = 0.9144;
const GRAMS_PER_OZ = 28.349523125;

export type GaugeRange = {
  hookMinMm: number;
  hookMaxMm: number;
  minSq: number;
  maxSq: number;
  defaultSq: number;
};

/** Filet dc squares per 10 cm vs hook size, by yarn weight. */
export const FILET_GAUGE: Record<YarnWeightCategory, GaugeRange> = {
  lace: { hookMinMm: 1.5, hookMaxMm: 2.25, minSq: 12, maxSq: 16, defaultSq: 14 },
  fingering: { hookMinMm: 2.25, hookMaxMm: 3.5, minSq: 9, maxSq: 12, defaultSq: 10 },
  sport: { hookMinMm: 3.5, hookMaxMm: 4.5, minSq: 7, maxSq: 9, defaultSq: 8 },
  dk: { hookMinMm: 4.0, hookMaxMm: 5.0, minSq: 5, maxSq: 7, defaultSq: 6 },
  worsted: { hookMinMm: 4.5, hookMaxMm: 5.5, minSq: 4, maxSq: 6, defaultSq: 5 },
  bulky: { hookMinMm: 6.5, hookMaxMm: 9.0, minSq: 2, maxSq: 4, defaultSq: 3 },
  super_bulky: { hookMinMm: 9.0, hookMaxMm: 15.0, minSq: 1, maxSq: 3, defaultSq: 2 },
};

function scaleSquares(range: GaugeRange, factor: number): GaugeRange {
  const sq = (n: number) => parseFloat(Math.max(0.5, n * factor).toFixed(1));
  return {
    hookMinMm: range.hookMinMm,
    hookMaxMm: range.hookMaxMm,
    minSq: sq(range.minSq),
    maxSq: sq(range.maxSq),
    defaultSq: sq(range.defaultSq),
  };
}

/** Filet tr squares per 10 cm — larger squares (~2/3 the dc count). */
export const FILET_TR_GAUGE: Record<YarnWeightCategory, GaugeRange> = {
  lace: scaleSquares(FILET_GAUGE.lace, 2 / 3),
  fingering: scaleSquares(FILET_GAUGE.fingering, 2 / 3),
  sport: scaleSquares(FILET_GAUGE.sport, 2 / 3),
  dk: scaleSquares(FILET_GAUGE.dk, 2 / 3),
  worsted: scaleSquares(FILET_GAUGE.worsted, 2 / 3),
  bulky: scaleSquares(FILET_GAUGE.bulky, 2 / 3),
  super_bulky: scaleSquares(FILET_GAUGE.super_bulky, 2 / 3),
};

/** Single crochet stitches per 10 cm (tapestry / mosaic). */
export const SC_GAUGE: Record<YarnWeightCategory, GaugeRange> = {
  lace: { hookMinMm: 1.5, hookMaxMm: 2.25, minSq: 32, maxSq: 40, defaultSq: 36 },
  fingering: { hookMinMm: 2.25, hookMaxMm: 3.5, minSq: 24, maxSq: 28, defaultSq: 26 },
  sport: { hookMinMm: 3.5, hookMaxMm: 4.5, minSq: 20, maxSq: 24, defaultSq: 22 },
  dk: { hookMinMm: 4.0, hookMaxMm: 5.0, minSq: 18, maxSq: 20, defaultSq: 19 },
  worsted: { hookMinMm: 4.5, hookMaxMm: 5.5, minSq: 14, maxSq: 16, defaultSq: 15 },
  bulky: { hookMinMm: 6.5, hookMaxMm: 9.0, minSq: 10, maxSq: 12, defaultSq: 11 },
  super_bulky: { hookMinMm: 9.0, hookMaxMm: 15.0, minSq: 7, maxSq: 9, defaultSq: 8 },
};

/** C2C blocks per 10 cm. */
export const C2C_GAUGE: Record<YarnWeightCategory, GaugeRange> = {
  lace: { hookMinMm: 1.5, hookMaxMm: 2.25, minSq: 6, maxSq: 8, defaultSq: 7 },
  fingering: { hookMinMm: 2.25, hookMaxMm: 3.5, minSq: 5, maxSq: 7, defaultSq: 6 },
  sport: { hookMinMm: 3.5, hookMaxMm: 4.5, minSq: 4, maxSq: 6, defaultSq: 5 },
  dk: { hookMinMm: 4.0, hookMaxMm: 5.0, minSq: 4, maxSq: 5, defaultSq: 4.5 },
  worsted: { hookMinMm: 4.5, hookMaxMm: 5.5, minSq: 3.5, maxSq: 5, defaultSq: 4 },
  bulky: { hookMinMm: 6.5, hookMaxMm: 9.0, minSq: 3, maxSq: 4, defaultSq: 3.5 },
  super_bulky: { hookMinMm: 9.0, hookMaxMm: 15.0, minSq: 2, maxSq: 3, defaultSq: 2.5 },
};

export const YARN_METHODS = ["filet", "tapestry", "c2c"] as const;
export type YarnMethod = (typeof YARN_METHODS)[number];

export const YARN_STITCHES = ["sc", "hdc", "dc", "tr"] as const;
export type YarnStitch = (typeof YARN_STITCHES)[number];

export const STITCHES_FOR_METHOD: Record<YarnMethod, readonly YarnStitch[]> = {
  filet: ["dc", "tr"],
  tapestry: ["sc", "hdc", "dc", "tr"],
  c2c: ["dc", "hdc"],
};

export const DEFAULT_STITCH_FOR_METHOD: Record<YarnMethod, YarnStitch> = {
  filet: "dc",
  tapestry: "sc",
  c2c: "dc",
};

export const METHOD_LABELS: Record<YarnMethod, string> = {
  filet: "Filet",
  tapestry: "Tapestry / mosaic",
  c2c: "C2C",
};

export const STITCH_LABELS: Record<YarnStitch, string> = {
  sc: "sc",
  hdc: "hdc",
  dc: "dc",
  tr: "tr",
};

export function parseYarnMethod(v: unknown): YarnMethod {
  if (typeof v === "string" && (YARN_METHODS as readonly string[]).includes(v)) {
    return v as YarnMethod;
  }
  return "filet";
}

export function parseYarnStitch(v: unknown): YarnStitch {
  if (typeof v === "string" && (YARN_STITCHES as readonly string[]).includes(v)) {
    return v as YarnStitch;
  }
  return "dc";
}

export function clampYarnStitch(method: YarnMethod, stitch: YarnStitch): YarnStitch {
  const allowed = STITCHES_FOR_METHOD[method];
  return allowed.includes(stitch) ? stitch : DEFAULT_STITCH_FOR_METHOD[method];
}

/** Tapestry row height vs sc (fewer rows per 10 cm → taller piece). */
const TAPESTRY_ROW_HEIGHT: Record<YarnStitch, number> = {
  sc: 1,
  hdc: 1.5,
  dc: 2,
  tr: 3,
};

export const SIZE_METHODS = ["filet-dc", "filet-tr", "sc", "c2c"] as const;
export type SizeMethod = (typeof SIZE_METHODS)[number];

const GAUGE_BY_METHOD: Record<SizeMethod, Record<YarnWeightCategory, GaugeRange>> = {
  "filet-dc": FILET_GAUGE,
  "filet-tr": FILET_TR_GAUGE,
  sc: SC_GAUGE,
  c2c: C2C_GAUGE,
};

export const HOOK_DEFAULTS: Record<YarnWeightCategory, string> = {
  lace: "1.5 mm",
  fingering: "2.25 mm",
  sport: "3 mm",
  dk: "3.5 mm",
  worsted: "5 mm",
  bulky: "6.5 mm",
  super_bulky: "9 mm",
};

/** Millimeters from "5.5 mm" anywhere in the string, or a bare "5.5". */
export function parseHookMillimeters(hookSize: string): number | null {
  const mm = hookSize.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mm) {
    const v = Number(mm[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const bare = hookSize.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const v = Number(bare[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/** If the field is a positive number with no unit, append " mm". */
export function normalizeHookSize(hookSize: string): string {
  const trimmed = hookSize.trim();
  if (!trimmed) return hookSize;
  if (!/^(\d+(?:\.\d+)?)$/.test(trimmed)) return trimmed;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return trimmed;
  return `${trimmed} mm`;
}

export function recommendedHookMm(weight: YarnWeightCategory): number {
  return parseHookMillimeters(HOOK_DEFAULTS[weight]) ?? 5;
}

function interpolateGauge(range: GaugeRange, weight: YarnWeightCategory, hookSize: string): number {
  const mm = parseHookMillimeters(hookSize) ?? recommendedHookMm(weight);
  const t = (mm - range.hookMinMm) / Math.max(0.001, range.hookMaxMm - range.hookMinMm);
  const sq = range.maxSq + t * (range.minSq - range.maxSq);
  return parseFloat(Math.min(range.maxSq, Math.max(range.minSq, sq)).toFixed(1));
}

/** Filet dc squares per 10 cm from yarn weight + hook. Larger hook → fewer squares. */
export function autoGaugeSqPer10cm(weight: YarnWeightCategory, hookSize: string): number {
  return interpolateGauge(FILET_GAUGE[weight], weight, hookSize);
}

export function autoGaugeForMethod(
  method: SizeMethod,
  weight: YarnWeightCategory,
  hookSize: string,
): number {
  return interpolateGauge(GAUGE_BY_METHOD[method][weight], weight, hookSize);
}

/**
 * Cells per 10 cm for a method. Custom gauge is filet squares / 10 cm;
 * when set, finished size is scaled by autoFilet / custom (tighter swatch → smaller).
 */
export function cellsPer10cm(
  method: SizeMethod,
  weight: YarnWeightCategory,
  hookSize: string,
  customFiletGauge?: number | null,
): number {
  const auto = autoGaugeForMethod(method, weight, hookSize);
  const autoFilet = autoGaugeSqPer10cm(weight, hookSize);
  const custom = customFiletGauge ?? 0;
  if (custom > 0 && Math.abs(custom - autoFilet) >= 0.1) {
    return parseFloat(Math.max(0.5, auto * (custom / autoFilet)).toFixed(1));
  }
  return auto;
}

export function finishedSizeCm(
  gridWidth: number,
  gridHeight: number,
  widthCellsPer10: number,
  heightCellsPer10 = widthCellsPer10,
): { widthCm: number; heightCm: number } {
  const wPer = Math.max(0.5, widthCellsPer10);
  const hPer = Math.max(0.5, heightCellsPer10);
  return {
    widthCm: parseFloat(((gridWidth * 10) / wPer).toFixed(1)),
    heightCm: parseFloat(((gridHeight * 10) / hPer).toFixed(1)),
  };
}

function applyCustomFiletScale(
  cells: number,
  weight: YarnWeightCategory,
  hookSize: string,
  customFiletGauge?: number | null,
): number {
  const autoFilet = autoGaugeSqPer10cm(weight, hookSize);
  const custom = customFiletGauge ?? 0;
  if (custom > 0 && Math.abs(custom - autoFilet) >= 0.1) {
    return parseFloat(Math.max(0.5, cells * (custom / autoFilet)).toFixed(1));
  }
  return cells;
}

/** Width/height cells per 10 cm for the selected method + stitch. */
export function cellsPer10cmForYarn(
  method: YarnMethod,
  stitch: YarnStitch,
  weight: YarnWeightCategory,
  hookSize: string,
  customFiletGauge?: number | null,
): { widthCells: number; heightCells: number } {
  const st = clampYarnStitch(method, stitch);
  if (method === "filet") {
    const table = st === "tr" ? "filet-tr" : "filet-dc";
    const n = cellsPer10cm(table, weight, hookSize, customFiletGauge);
    return { widthCells: n, heightCells: n };
  }
  if (method === "c2c") {
    const dc = autoGaugeForMethod("c2c", weight, hookSize);
    const blocks = st === "hdc" ? parseFloat((dc * 1.5).toFixed(1)) : dc;
    const n = applyCustomFiletScale(blocks, weight, hookSize, customFiletGauge);
    return { widthCells: n, heightCells: n };
  }
  const sc = autoGaugeForMethod("sc", weight, hookSize);
  const width = applyCustomFiletScale(sc, weight, hookSize, customFiletGauge);
  const height = parseFloat(Math.max(0.5, width / TAPESTRY_ROW_HEIGHT[st]).toFixed(1));
  return { widthCells: width, heightCells: height };
}

export function finishedSizeForYarn(
  method: YarnMethod,
  stitch: YarnStitch,
  weight: YarnWeightCategory,
  hookSize: string,
  gridWidth: number,
  gridHeight: number,
  customFiletGauge?: number | null,
): { widthCm: number; heightCm: number } {
  const { widthCells, heightCells } = cellsPer10cmForYarn(
    method,
    stitch,
    weight,
    hookSize,
    customFiletGauge,
  );
  return finishedSizeCm(gridWidth, gridHeight, widthCells, heightCells);
}

export function effectiveGaugeSqPer10cm(
  weight: YarnWeightCategory,
  hookSize: string,
  customGaugeStitchesPerInch?: number | null,
): number {
  const custom = customGaugeStitchesPerInch ?? 0;
  if (custom > 0) return custom;
  return autoGaugeSqPer10cm(weight, hookSize);
}

/**
 * Yarn estimate: filet dc units (empty 1×, filled 3×).
 * Weight and hook always drive Amount. Custom gauge (different from auto) scales by (auto / custom)².
 */
export function estimateYarnUsage(input: YarnEstimateInput): YarnEstimateResult {
  const row = YARN_TABLE[input.weight];
  const meshEquiv =
    input.filledCellCount * BLOCK_TO_MESH_YARN_RATIO + input.emptyCellCount;

  if (
    meshEquiv <= 0 ||
    input.gridWidth <= 0 ||
    input.gridHeight <= 0 ||
    input.filledCellCount + input.emptyCellCount <= 0
  ) {
    return { yards: 0, meters: 0, grams: 0, oz: 0 };
  }

  const recMm = recommendedHookMm(input.weight);
  const hookMm = parseHookMillimeters(input.hookSize) ?? recMm;
  const hookFactor = (hookMm / Math.max(0.001, recMm)) ** 2;

  const autoGauge = autoGaugeSqPer10cm(input.weight, input.hookSize);
  const custom = input.customGaugeStitchesPerInch ?? 0;
  const gaugeFactor =
    custom > 0 && Math.abs(custom - autoGauge) >= 0.1 ? (autoGauge / custom) ** 2 : 1;

  const grams = (100 * meshEquiv * hookFactor * gaugeFactor) / row.meshEquivUnitsPer100g;
  const yards = (grams * row.yardsPer100g) / 100;
  const meters = yards * METERS_PER_YARD;
  const oz = grams / GRAMS_PER_OZ;

  return {
    yards: roundDisplay(yards, 1),
    meters: roundDisplay(meters, 2),
    grams: roundDisplay(grams, 1),
    oz: roundDisplay(oz, 2),
  };
}

function roundDisplay(n: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}
