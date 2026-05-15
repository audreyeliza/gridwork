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
  /** Free text, e.g. "5.5 mm" or "US H/8" — used only when custom gauge is absent. */
  hookSize: string;
  /** Stitches per inch; when set, overrides hook-based / default gauge. */
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
  /** Default stitches per inch when no custom gauge and hook cannot be parsed. */
  defaultStitchesPerInch: number;
  /**
   * Heuristic: mesh-equivalent units per 100 g at `defaultStitchesPerInch`.
   * One mesh cell = 1 unit; one filled (block) cell = 3 units (see spec).
   */
  meshEquivUnitsPer100g: number;
};

const YARN_TABLE: Record<YarnWeightCategory, YarnRow> = {
  lace: { yardsPer100g: 900, defaultStitchesPerInch: 8.5, meshEquivUnitsPer100g: 14_000 },
  fingering: { yardsPer100g: 410, defaultStitchesPerInch: 7.5, meshEquivUnitsPer100g: 6_200 },
  sport: { yardsPer100g: 330, defaultStitchesPerInch: 6.5, meshEquivUnitsPer100g: 4_800 },
  dk: { yardsPer100g: 280, defaultStitchesPerInch: 5.75, meshEquivUnitsPer100g: 3_900 },
  worsted: { yardsPer100g: 200, defaultStitchesPerInch: 5, meshEquivUnitsPer100g: 2_800 },
  bulky: { yardsPer100g: 120, defaultStitchesPerInch: 4, meshEquivUnitsPer100g: 1_700 },
  super_bulky: { yardsPer100g: 60, defaultStitchesPerInch: 3, meshEquivUnitsPer100g: 900 },
};

const BLOCK_TO_MESH_YARN_RATIO = 3;

const METERS_PER_YARD = 0.9144;
const GRAMS_PER_OZ = 28.349523125;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** First millimeter dimension found in hook string, e.g. "5.5 mm" → 5.5 */
export function parseHookMillimeters(hookSize: string): number | null {
  const m = hookSize.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Resolve stitches per inch: explicit custom gauge wins; else infer from mm in hook string;
 * else yarn-category default.
 */
export function resolveStitchesPerInch(input: {
  weight: YarnWeightCategory;
  hookSize: string;
  customGaugeStitchesPerInch?: number | null;
}): number {
  const custom = input.customGaugeStitchesPerInch;
  if (custom != null && Number.isFinite(custom) && custom > 0) {
    return clamp(custom, 2, 14);
  }
  const mm = parseHookMillimeters(input.hookSize);
  if (mm != null) {
    // Larger hook → coarser fabric → fewer stitches per inch (very rough).
    const fromHook = clamp(20 / mm, 2.5, 12);
    return fromHook;
  }
  return YARN_TABLE[input.weight].defaultStitchesPerInch;
}

/**
 * Pure yarn estimate: mesh cells count as 1× yarn, filled (block) cells as ~3×.
 * Grams scale with mesh-equivalent units and inversely with gauge squared
 * (tighter gauge → smaller physical piece for the same grid → less yarn).
 */
export function estimateYarnUsage(input: YarnEstimateInput): YarnEstimateResult {
  const row = YARN_TABLE[input.weight];
  const spi = resolveStitchesPerInch(input);
  const refSpi = row.defaultStitchesPerInch;

  const meshEquiv =
    input.filledCellCount * BLOCK_TO_MESH_YARN_RATIO + input.emptyCellCount * 1;

  if (
    meshEquiv <= 0 ||
    input.gridWidth <= 0 ||
    input.gridHeight <= 0 ||
    input.filledCellCount + input.emptyCellCount <= 0
  ) {
    return { yards: 0, meters: 0, grams: 0, oz: 0 };
  }

  const gaugeFactor = (refSpi / spi) ** 2;
  const grams = (100 * meshEquiv * gaugeFactor) / row.meshEquivUnitsPer100g;
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

export function getYarnTableRow(weight: YarnWeightCategory): YarnRow {
  return YARN_TABLE[weight];
}
