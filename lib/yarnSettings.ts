import type { Json } from "@/lib/patternHelpers";
import type { YarnWeightCategory } from "@/lib/yarnEstimator";
import { YARN_WEIGHT_CATEGORIES } from "@/lib/yarnEstimator";

export type PatternYarnSettings = {
  weight: YarnWeightCategory;
  hookSize: string;
  /** Stitches per inch; null = derive from hook / category default. */
  customGaugeStitchesPerInch: number | null;
};

export const DEFAULT_PATTERN_YARN_SETTINGS: PatternYarnSettings = {
  weight: "worsted",
  hookSize: "5.5 mm",
  customGaugeStitchesPerInch: null,
};

function isYarnWeight(v: unknown): v is YarnWeightCategory {
  return typeof v === "string" && (YARN_WEIGHT_CATEGORIES as readonly string[]).includes(v);
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
  let custom: number | null = null;
  if (typeof o.customGaugeStitchesPerInch === "number" && Number.isFinite(o.customGaugeStitchesPerInch)) {
    custom = o.customGaugeStitchesPerInch;
  } else if (o.customGaugeStitchesPerInch === null) {
    custom = null;
  }
  return { weight, hookSize, customGaugeStitchesPerInch: custom };
}

export function serializePatternYarnSettings(s: PatternYarnSettings): Json {
  return {
    weight: s.weight,
    hookSize: s.hookSize,
    customGaugeStitchesPerInch: s.customGaugeStitchesPerInch,
  } as Json;
}
