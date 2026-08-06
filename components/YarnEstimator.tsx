"use client";

import {
  estimateYarnUsage,
  parseHookMillimeters,
  type YarnEstimateResult,
  type YarnWeightCategory,
  YARN_WEIGHT_CATEGORIES,
} from "@/lib/yarnEstimator";
import type { PatternYarnSettings } from "@/lib/yarnSettings";
import { useEffect, useId, useMemo, useState } from "react";

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
  const [units, setUnits] = useState<"imperial" | "metric">("metric");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gridwork:yarnUnit");
      if (saved === "imperial" || saved === "metric") setUnits(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("gridwork:yarnUnit", units); } catch {}
  }, [units]);

  const result: YarnEstimateResult = useMemo(
    () =>
      estimateYarnUsage({
        weight: value.weight,
        hookSize: value.hookSize,
        customGaugeStitchesPerInch: value.customGaugeStitchesPerInch,
        gridWidth,
        gridHeight,
        filledCellCount,
        emptyCellCount,
      }),
    [value.weight, value.hookSize, value.customGaugeStitchesPerInch, gridWidth, gridHeight, filledCellCount, emptyCellCount],
  );

  const isCustomGauge = (value.customGaugeStitchesPerInch ?? 0) > 0;
  const { gaugeSquaresPer10cm, widthCm, heightCm, widthIn, heightIn } = useMemo(() => {
    const custom = value.customGaugeStitchesPerInch ?? 0;
    let sq: number;
    if (custom > 0) {
      sq = custom;
    } else {
      const range = FILET_GAUGE[value.weight];
      const mm = parseHookMillimeters(value.hookSize);
      if (mm != null && mm >= range.hookMinMm && mm <= range.hookMaxMm) {
        const t = (mm - range.hookMinMm) / (range.hookMaxMm - range.hookMinMm);
        sq = parseFloat((range.maxSq + t * (range.minSq - range.maxSq)).toFixed(1));
      } else {
        sq = range.defaultSq;
      }
    }
    const wCm = parseFloat((gridWidth * 10 / sq).toFixed(1));
    const hCm = parseFloat((gridHeight * 10 / sq).toFixed(1));
    return {
      gaugeSquaresPer10cm: sq,
      widthCm: wCm,
      heightCm: hCm,
      widthIn: parseFloat((wCm * 0.3937).toFixed(1)),
      heightIn: parseFloat((hCm * 0.3937).toFixed(1)),
    };
  }, [value.customGaugeStitchesPerInch, value.weight, value.hookSize, gridWidth, gridHeight]);

  const skeinGrams = value.weight === "lace" ? 50 : value.weight === "fingering" ? 100 : value.weight === "super_bulky" ? 200 : 100;
  const skeins = Math.ceil(result.grams / skeinGrams);

  return (
    <section
      className={`relative z-10 flex shrink-0 flex-col overflow-y-auto pointer-events-auto ${className ?? ""}`}
      style={{
        background: "#fff",
        border: "1px solid #3A3E44",
        boxShadow: "2px 3px 0 rgba(74,78,85,0.12)",
      }}
    >
      <div className="flex items-center justify-between border-b border-[#D6DCE4] bg-[#2F5F9E] px-3 py-2">
        <h2 className="m-0 font-mono text-[10px] font-bold tracking-[0.14em] text-white uppercase">Yarn</h2>
        <div className="inline-flex items-center gap-0.5 border border-white/30 bg-white/10 p-0.5">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={units === u}
              onClick={() => setUnits(u)}
              className={`px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                units === u ? "bg-white text-[#2F5F9E]" : "text-white/80"
              }`}
            >
              {u === "imperial" ? "In" : "Cm"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
      <div
        className="flex items-baseline justify-between gap-2 px-2 py-1.5"
        style={{ background: "rgba(47,95,158,0.08)", border: "1px solid rgba(47,95,158,0.22)" }}
      >
        <div className="font-mono font-bold text-[#2F5F9E]" style={{ fontSize: 28, lineHeight: 1 }}>
          ~{units === "metric" ? result.grams : result.oz}
          <span className="ml-0.5 text-[12px] font-bold">{units === "metric" ? "g" : "oz"}</span>
        </div>
        <div className="text-right font-mono text-[10px] font-bold text-[#4A4E55]">
          {units === "metric" ? `${result.meters} m` : `${result.yards} yd`}
          <br />
          {skeins} sk · {WEIGHT_LABELS[value.weight]}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center justify-between gap-2 border-b border-[#D6DCE4] bg-transparent px-0 py-1.5">
          <span className="font-mono text-[9px] font-bold text-[#2F5F9E] uppercase">Wt</span>
          <select
            id={`${idPrefix}-weight`}
            value={value.weight}
            onChange={(e) => onChange({ ...value, weight: e.target.value as YarnWeightCategory })}
            className="bg-transparent font-mono text-[11px] font-bold text-ink focus:outline-none"
          >
            {YARN_WEIGHT_CATEGORIES.map((w) => (
              <option key={w} value={w}>{WEIGHT_LABELS[w]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 border-b border-[#D6DCE4] bg-transparent px-0 py-1.5">
          <span className="font-mono text-[9px] font-bold text-[#2F5F9E] uppercase">Hook</span>
          <input
            id={`${idPrefix}-hook`}
            type="text"
            value={value.hookSize}
            onChange={(e) => onChange({ ...value, hookSize: e.target.value })}
            placeholder={HOOK_DEFAULTS[value.weight]}
            className="w-20 bg-transparent text-right font-mono text-[11px] font-bold text-ink focus:outline-none"
          />
        </label>
        <label className="flex items-center justify-between gap-2 border-b border-[#D6DCE4] bg-transparent px-0 py-1.5">
          <span className="font-mono text-[9px] font-bold text-[#2F5F9E] uppercase">Gauge</span>
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
              className="w-12 bg-transparent text-right font-mono text-[11px] font-bold text-ink focus:outline-none"
            />
            <span className="font-mono text-[9px] text-muted">
              {units === "imperial" ? "/in" : "/10cm"}
            </span>
          </div>
        </label>
      </div>

      <div className="border-b border-[#D6DCE4] px-0 py-1.5">
        <div className="font-mono text-[9px] font-bold text-[#2F5F9E] uppercase">Size</div>
        <div className="font-mono text-[15px] font-bold text-ink">
          {units === "metric"
            ? `${widthCm} × ${heightCm} cm`
            : `${toFractionalInch(widthCm)} × ${toFractionalInch(heightCm)} in`}
        </div>
        <div className="mt-0.5 font-mono text-[9px] text-muted">
          {units === "metric" ? `≈ ${widthIn} × ${heightIn} in` : `≈ ${widthCm} × ${heightCm} cm`}
          {" · "}
          {isCustomGauge ? "custom" : "est."} gauge
        </div>
      </div>

      <p className="m-0 font-sans text-[10px] leading-snug text-[#4A4E55]">
        ~5% loss built in for chains &amp; ends. W {gridWidth}÷({gaugeSquaresPer10cm}÷10)={widthCm}cm
      </p>
      </div>
    </section>
  );
}
