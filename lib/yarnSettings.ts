import type { Json } from "@/lib/patternHelpers";
import {
  clampYarnStitch,
  DEFAULT_STITCH_FOR_METHOD,
  parseYarnMethod,
  parseYarnStitch,
  YARN_WEIGHT_CATEGORIES,
  type YarnMethod,
  type YarnStitch,
  type YarnWeightCategory,
} from "@/lib/yarnEstimator";

export type YarnUnits = "metric" | "imperial";

export type PatternYarnSettings = {
  weight: YarnWeightCategory;
  hookSize: string;
  /** Squares per 10 cm; 0 or null = derive from hook / category default. */
  customGaugeStitchesPerInch: number | null;
  units: YarnUnits;
  method: YarnMethod;
  stitch: YarnStitch;
};

export const DEFAULT_PATTERN_YARN_SETTINGS: PatternYarnSettings = {
  weight: "worsted",
  hookSize: "5.5 mm",
  customGaugeStitchesPerInch: 0,
  units: "metric",
  method: "filet",
  stitch: "dc",
};

function isYarnWeight(v: unknown): v is YarnWeightCategory {
  return typeof v === "string" && (YARN_WEIGHT_CATEGORIES as readonly string[]).includes(v);
}

function isYarnUnits(v: unknown): v is YarnUnits {
  return v === "metric" || v === "imperial";
}

export function parsePatternYarnSettings(data: Json | undefined): PatternYarnSettings {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { ...DEFAULT_PATTERN_YARN_SETTINGS };
  }
  const o = data as Record<string, unknown>;
  const weight = isYarnWeight(o.weight) ? o.weight : DEFAULT_PATTERN_YARN_SETTINGS.weight;
  const hookSize =
    typeof o.hookSize === "string" && o.hookSize.trim().length > 0
      ? o.hookSize
      : DEFAULT_PATTERN_YARN_SETTINGS.hookSize;
  let custom: number | null = 0;
  if (typeof o.customGaugeStitchesPerInch === "number" && Number.isFinite(o.customGaugeStitchesPerInch) && o.customGaugeStitchesPerInch > 0) {
    custom = o.customGaugeStitchesPerInch;
  }
  const units = isYarnUnits(o.units) ? o.units : DEFAULT_PATTERN_YARN_SETTINGS.units;
  const method = parseYarnMethod(o.method);
  const stitch =
    o.stitch == null
      ? DEFAULT_STITCH_FOR_METHOD[method]
      : clampYarnStitch(method, parseYarnStitch(o.stitch));
  return { weight, hookSize, customGaugeStitchesPerInch: custom, units, method, stitch };
}

export function serializePatternYarnSettings(s: PatternYarnSettings): Json {
  return {
    weight: s.weight,
    hookSize: s.hookSize,
    customGaugeStitchesPerInch: s.customGaugeStitchesPerInch,
    units: s.units,
    method: s.method,
    stitch: s.stitch,
  } as Json;
}
