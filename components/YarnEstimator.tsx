"use client";

import {
  estimateYarnUsage,
  parseHookMillimeters,
  type YarnEstimateResult,
  type YarnWeightCategory,
  YARN_WEIGHT_CATEGORIES,
} from "@/lib/yarnEstimator";
import type { PatternYarnSettings, YarnUnits } from "@/lib/yarnSettings";
import { useId, useMemo } from "react";

const WEIGHT_LABELS: Record<YarnWeightCategory, string> = {
  lace: "Lace",
  fingering: "Fingering",
  sport: "Sport",
  dk: "DK",
  worsted: "Worsted",
  bulky: "Bulky",
  super_bulky: "Super bulky",
};

type GaugeRange = { hookMinMm: number; hookMaxMm: number; minSq: number; maxSq: number; defaultSq: number };
const FILET_GAUGE: Record<YarnWeightCategory, GaugeRange> = {
  lace:        { hookMinMm: 1.5,  hookMaxMm: 2.25, minSq: 12, maxSq: 16, defaultSq: 14 },
  fingering:   { hookMinMm: 2.25, hookMaxMm: 3.5,  minSq: 9,  maxSq: 12, defaultSq: 10 },
  sport:       { hookMinMm: 3.5,  hookMaxMm: 4.5,  minSq: 7,  maxSq: 9,  defaultSq: 8  },
  dk:          { hookMinMm: 4.0,  hookMaxMm: 5.0,  minSq: 5,  maxSq: 7,  defaultSq: 6  },
  worsted:     { hookMinMm: 4.5,  hookMaxMm: 5.5,  minSq: 4,  maxSq: 6,  defaultSq: 5  },
  bulky:       { hookMinMm: 6.5,  hookMaxMm: 9.0,  minSq: 2,  maxSq: 4,  defaultSq: 3  },
  super_bulky: { hookMinMm: 9.0,  hookMaxMm: 15.0, minSq: 1,  maxSq: 3,  defaultSq: 2  },
};

const HOOK_DEFAULTS: Record<YarnWeightCategory, string> = {
  lace: "1.5 mm", fingering: "2.25 mm", sport: "3 mm", dk: "3.5 mm",
  worsted: "5 mm", bulky: "6.5 mm", super_bulky: "9 mm",
};

export type YarnEstimatorProps = {
  gridWidth: number;
  gridHeight: number;
  filledCellCount: number;
  emptyCellCount: number;
  value: PatternYarnSettings;
  onChange: (next: PatternYarnSettings) => void;
  className?: string;
};

function toFractionalInch(cm: number): string {
  const totalIn = cm * 0.3937;
  const whole = Math.floor(totalIn);
  const eighths = Math.round((totalIn - whole) * 8);
  if (eighths === 0) return String(whole);
  if (eighths === 8) return String(whole + 1);
  const FRAC: Record<number, string> = { 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞" };
  return `${whole}${FRAC[eighths] ?? ""}`;
}

export function YarnEstimator({
  gridWidth,
  gridHeight,
  filledCellCount,
  emptyCellCount,
  value,
  onChange,
  className,
}: YarnEstimatorProps) {
  const idPrefix = useId();
  const units: YarnUnits = value.units === "imperial" ? "imperial" : "metric";

  /** Squares per 10cm — shared basis for Size display and Amount estimate. */
  const gaugeSqPer10cm = useMemo(() => {
    const custom = value.customGaugeStitchesPerInch ?? 0;
    if (custom > 0) return custom;
    const range = FILET_GAUGE[value.weight];
    const mm = parseHookMillimeters(value.hookSize);
    if (mm != null && mm >= range.hookMinMm && mm <= range.hookMaxMm) {
      const t = (mm - range.hookMinMm) / (range.hookMaxMm - range.hookMinMm);
      return parseFloat((range.maxSq + t * (range.minSq - range.maxSq)).toFixed(1));
    }
    return range.defaultSq;
  }, [value.customGaugeStitchesPerInch, value.weight, value.hookSize]);

  const result: YarnEstimateResult = useMemo(
    () =>
      estimateYarnUsage({
        weight: value.weight,
        hookSize: value.hookSize,
        // Same gauge as Size (sq/10cm numeric scale used by the estimator).
        customGaugeStitchesPerInch: gaugeSqPer10cm,
        gridWidth,
        gridHeight,
        filledCellCount,
        emptyCellCount,
      }),
    [value.weight, value.hookSize, gaugeSqPer10cm, gridWidth, gridHeight, filledCellCount, emptyCellCount],
  );

  const { widthCm, heightCm } = useMemo(
    () => ({
      widthCm: parseFloat(((gridWidth * 10) / gaugeSqPer10cm).toFixed(1)),
      heightCm: parseFloat(((gridHeight * 10) / gaugeSqPer10cm).toFixed(1)),
    }),
    [gaugeSqPer10cm, gridWidth, gridHeight],
  );

  return (
    <section className={`flex flex-col gap-4 pointer-events-auto ${className ?? ""}`}>
      <div className="flex items-center gap-2" role="group" aria-label="Units">
        {(["metric", "imperial"] as const).map((u, i) => (
          <span key={u} className="flex items-center gap-2">
            {i > 0 && (
              <span className="font-mono text-[10px] punch-print-faint" aria-hidden>
                ·
              </span>
            )}
            <button
              type="button"
              aria-pressed={units === u}
              onClick={() => onChange({ ...value, units: u })}
              className={`font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-opacity ${
                units === u
                  ? "punch-print-ink underline decoration-[var(--print-ink)] underline-offset-4"
                  : "punch-print-faint hover:opacity-80"
              }`}
            >
              {u === "imperial" ? "Imperial" : "Metric"}
            </button>
          </span>
        ))}
      </div>

      <div className="border-b pb-3" style={{ borderColor: "var(--print-ink-faint)" }}>
        <div className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">
          Amount
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <div className="font-mono font-bold punch-print-ink" style={{ fontSize: 28, lineHeight: 1 }}>
            ~{units === "metric" ? result.grams : result.oz}
            <span className="ml-0.5 text-[12px] font-bold">{units === "metric" ? "g" : "oz"}</span>
          </div>
          <div className="font-mono font-bold punch-print-faint" style={{ fontSize: 18, lineHeight: 1 }}>
            {units === "metric" ? `${result.meters} m` : `${result.yards} yd`}
          </div>
        </div>
      </div>

      <div className="border-b pb-3" style={{ borderColor: "var(--print-ink-faint)" }}>
        <div className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Size</div>
        <div className="mt-1.5 font-mono text-[15px] font-bold punch-print-ink">
          {units === "metric"
            ? `${widthCm} × ${heightCm} cm`
            : `${toFractionalInch(widthCm)} × ${toFractionalInch(heightCm)} in`}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-2 border-b py-2.5" style={{ borderColor: "var(--print-ink-faint)" }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Weight</span>
          <select
            id={`${idPrefix}-weight`}
            value={value.weight}
            onChange={(e) => onChange({ ...value, weight: e.target.value as YarnWeightCategory })}
            className="bg-transparent font-mono text-[12px] font-bold punch-print-ink focus:outline-none"
          >
            {YARN_WEIGHT_CATEGORIES.map((w) => (
              <option key={w} value={w}>{WEIGHT_LABELS[w]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 border-b py-2.5" style={{ borderColor: "var(--print-ink-faint)" }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Hook</span>
          <input
            id={`${idPrefix}-hook`}
            type="text"
            value={value.hookSize}
            onChange={(e) => onChange({ ...value, hookSize: e.target.value })}
            placeholder={HOOK_DEFAULTS[value.weight]}
            className="w-24 bg-transparent text-right font-mono text-[12px] font-bold punch-print-ink placeholder:text-[var(--print-ink-faint)] focus:outline-none"
          />
        </label>
        <label className="flex items-center justify-between gap-2 border-b py-2.5" style={{ borderColor: "var(--print-ink-faint)" }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Gauge</span>
          <div className="flex items-center gap-1">
            <input
              id={`${idPrefix}-gauge`}
              type="number"
              min={units === "imperial" ? 0.5 : 1}
              max={units === "imperial" ? 4.5 : 16}
              step={units === "imperial" ? 0.1 : 0.5}
              value={
                units === "imperial" && (value.customGaugeStitchesPerInch ?? 0) > 0
                  ? parseFloat(((value.customGaugeStitchesPerInch ?? 0) / 3.937).toFixed(1))
                  : (value.customGaugeStitchesPerInch || "")
              }
              placeholder={
                units === "imperial"
                  ? String(parseFloat((FILET_GAUGE[value.weight].defaultSq / 3.937).toFixed(1)))
                  : String(FILET_GAUGE[value.weight].defaultSq)
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") { onChange({ ...value, customGaugeStitchesPerInch: 0 }); return; }
                const n = Number(raw);
                if (!Number.isFinite(n) || n <= 0) return;
                const stored = units === "imperial" ? parseFloat((n * 3.937).toFixed(2)) : n;
                onChange({ ...value, customGaugeStitchesPerInch: stored });
              }}
              className="w-12 bg-transparent text-right font-mono text-[12px] font-bold punch-print-ink placeholder:text-[var(--print-ink-faint)] focus:outline-none"
            />
            <span className="font-mono text-[9px] punch-print-faint">
              {units === "imperial" ? "/in" : "/10cm"}
            </span>
          </div>
        </label>
      </div>
    </section>
  );
}
