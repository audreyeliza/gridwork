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
      className={`relative z-10 flex shrink-0 flex-col gap-4 rounded-xl border pointer-events-auto overflow-y-auto ${className ?? ""}`}
      style={{
        background: "#FBF7EF",
        border: "1px solid rgba(61,42,30,0.10)",
        padding: 20,
      }}
    >
      {/* Header */}
      <div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted" style={{ marginBottom: 2 }}>
          Estimator
        </div>
        <h2 className="font-serif text-[20px] font-bold leading-none tracking-[-0.01em] text-text-strong">
          Yarn needed
        </h2>
      </div>

      {/* Big estimate display */}
      <div
        className="rounded-[14px] p-4"
        style={{ background: "rgba(168,70,111,0.07)", border: "1px solid rgba(168,70,111,0.18)" }}
      >
        {/* Imperial/metric toggle inside the pill */}
        <div className="mb-3 flex items-center justify-between">
          <div
            className="inline-flex items-center rounded-full p-[3px]"
            style={{ background: "rgba(61,42,30,0.06)" }}
          >
            {(["metric", "imperial"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={units === u}
                onClick={() => setUnits(u)}
                className={`rounded-full px-2.5 py-0.5 font-sans text-[11px] font-bold transition-colors ${
                  units === u ? "bg-brand text-[#FBF7EF]" : "bg-transparent text-muted hover:text-text-strong"
                }`}
              >
                {u === "imperial" ? "Imperial" : "Metric"}
              </button>
            ))}
          </div>
        </div>

        {units === "metric" ? (
          <>
            <div className="font-serif font-bold leading-none tracking-[-0.02em]" style={{ color: "#A8466F" }}>
              <span style={{ fontSize: 48 }}>~{result.grams}</span>
              <span className="font-sans font-semibold" style={{ fontSize: 20, verticalAlign: "super" }}>g</span>
            </div>
            <div className="mt-1.5 font-sans text-[13px] font-semibold text-muted">
              about {result.meters} m · {skeins} {skeins === 1 ? "skein" : "skeins"} of {WEIGHT_LABELS[value.weight].toLowerCase()}
            </div>
          </>
        ) : (
          <>
            <div className="font-serif font-bold leading-none tracking-[-0.02em]" style={{ color: "#A8466F" }}>
              <span style={{ fontSize: 48 }}>~{result.oz}</span>
              <span className="font-sans font-semibold" style={{ fontSize: 20, verticalAlign: "super" }}>oz</span>
            </div>
            <div className="mt-1.5 font-sans text-[13px] font-semibold text-muted">
              about {result.yards} yd · {skeins} {skeins === 1 ? "skein" : "skeins"} of {WEIGHT_LABELS[value.weight].toLowerCase()}
            </div>
          </>
        )}
      </div>

      {/* Yarn settings rows */}
      <div className="flex flex-col gap-2">
        {/* Weight */}
        <div
          className="flex items-center justify-between rounded-[10px] px-3 py-2"
          style={{ background: "#fff", border: "1px solid rgba(61,42,30,0.10)" }}
        >
          <span className="font-sans text-[12px] font-bold text-muted">Weight</span>
          <select
            id={`${idPrefix}-weight`}
            value={value.weight}
            onChange={(e) => onChange({ ...value, weight: e.target.value as YarnWeightCategory })}
            className="bg-transparent font-sans text-[13px] font-bold text-text-strong focus:outline-none"
          >
            {YARN_WEIGHT_CATEGORIES.map((w) => (
              <option key={w} value={w}>{WEIGHT_LABELS[w]}</option>
            ))}
          </select>
        </div>
        {/* Hook */}
        <div
          className="flex items-center justify-between rounded-[10px] px-3 py-2"
          style={{ background: "#fff", border: "1px solid rgba(61,42,30,0.10)" }}
        >
          <span className="font-sans text-[12px] font-bold text-muted">Hook</span>
          <input
            id={`${idPrefix}-hook`}
            type="text"
            value={value.hookSize}
            onChange={(e) => onChange({ ...value, hookSize: e.target.value })}
            placeholder={HOOK_DEFAULTS[value.weight]}
            className="w-24 bg-transparent text-right font-sans text-[13px] font-bold text-text-strong focus:outline-none"
          />
        </div>
        {/* Gauge */}
        <div
          className="flex items-center justify-between rounded-[10px] px-3 py-2"
          style={{ background: "#FFF8E8", border: "1px solid rgba(168,70,111,0.30)" }}
        >
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.04em]" style={{ color: "#A8466F" }}>Gauge</span>
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
              className="w-16 bg-transparent text-right font-sans text-[13px] font-bold text-text-strong focus:outline-none"
            />
            <span className="font-sans text-[11px] text-muted">
              {units === "imperial" ? "sq / inch" : "sq / 10 cm"}
            </span>
          </div>
        </div>
      </div>

      {/* Finished size */}
      <div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted" style={{ marginBottom: 8 }}>
          Finished size
        </div>
        {units === "metric" ? (
          <>
            <div className="font-serif font-bold tracking-[-0.01em] text-text-strong" style={{ fontSize: 26, lineHeight: 1 }}>
              {widthCm} × {heightCm}
              <span className="font-sans font-semibold text-muted" style={{ fontSize: 16, marginLeft: 6 }}>cm</span>
            </div>
            <div className="mt-1 font-sans text-[12px] font-semibold text-muted">
              ≈ {widthIn} × {heightIn} in · {isCustomGauge ? "your gauge" : "estimated gauge"}
            </div>
          </>
        ) : (
          <>
            <div className="font-serif font-bold tracking-[-0.01em] text-text-strong" style={{ fontSize: 26, lineHeight: 1 }}>
              {toFractionalInch(widthCm)} × {toFractionalInch(heightCm)}
              <span className="font-sans font-semibold text-muted" style={{ fontSize: 16, marginLeft: 6 }}>in</span>
            </div>
            <div className="mt-1 font-sans text-[12px] font-semibold text-muted">
              ≈ {widthCm} × {heightCm} cm · {isCustomGauge ? "your gauge" : "estimated gauge"}
            </div>
          </>
        )}
        <div
          className="mt-2 rounded-[10px] font-mono text-[11px] font-medium leading-[1.55]"
          style={{ padding: "10px 12px", background: "#FFF8E8", border: "1px solid rgba(61,42,30,0.10)", color: "#7A6A5F" }}
        >
          {units === "metric" ? (
            <>
              <div>
                <span style={{ color: "#7A6A5F", fontSize: 10 }}>W: </span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{gridWidth}</span>
                <span> ÷ (</span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{gaugeSquaresPer10cm}</span>
                <span> ÷ 10) = </span>
                <span style={{ color: "#1F1410", fontWeight: 700 }}>{widthCm} cm</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: "#7A6A5F", fontSize: 10 }}>H: </span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{gridHeight}</span>
                <span> ÷ (</span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{gaugeSquaresPer10cm}</span>
                <span> ÷ 10) = </span>
                <span style={{ color: "#1F1410", fontWeight: 700 }}>{heightCm} cm</span>
              </div>
            </>
          ) : (
            <>
              <div>
                <span style={{ color: "#7A6A5F", fontSize: 10 }}>W: </span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{gridWidth}</span>
                <span> ÷ </span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{parseFloat((gaugeSquaresPer10cm / 3.937).toFixed(1))} sq/in</span>
                <span> = </span>
                <span style={{ color: "#1F1410", fontWeight: 700 }}>{widthIn} in</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: "#7A6A5F", fontSize: 10 }}>H: </span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{gridHeight}</span>
                <span> ÷ </span>
                <span style={{ color: "#A8466F", fontWeight: 700 }}>{parseFloat((gaugeSquaresPer10cm / 3.937).toFixed(1))} sq/in</span>
                <span> = </span>
                <span style={{ color: "#1F1410", fontWeight: 700 }}>{heightIn} in</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tip */}
      <p className="font-sans text-[11px] italic text-muted" style={{ marginTop: "auto" }}>
        Tip: estimates assume ~5% loss for turning chains and weaving in ends.
      </p>
    </section>
  );
}
