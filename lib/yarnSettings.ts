import type { Json } from "@/lib/patternHelpers";
import type { YarnWeightCategory } from "@/lib/yarnEstimator";
import { YARN_WEIGHT_CATEGORIES } from "@/lib/yarnEstimator";

export type YarnUnits = "metric" | "imperial";

export type PatternYarnSettings = {
  weight: YarnWeightCategory;
  hookSize: string;
  /** Squares per 10 cm; 0 or null = derive from hook / category default. */
  customGaugeStitchesPerInch: number | null;
  units: YarnUnits;
};

export const DEFAULT_PATTERN_YARN_SETTINGS: PatternYarnSettings = {
  weight: "worsted",
  hookSize: "5.5 mm",
  customGaugeStitchesPerInch: 0,
  units: "metric",
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
  return { weight, hookSize, customGaugeStitchesPerInch: custom, units };
}

export function serializePatternYarnSettings(s: PatternYarnSettings): Json {
  return {
    weight: s.weight,
    hookSize: s.hookSize,
    customGaugeStitchesPerInch: s.customGaugeStitchesPerInch,
    units: s.units,
  } as Json;
}
