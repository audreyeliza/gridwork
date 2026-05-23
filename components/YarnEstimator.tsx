"use client";

import {
  estimateYarnUsage,
  type YarnEstimateResult,
  type YarnWeightCategory,
  YARN_WEIGHT_CATEGORIES,
} from "@/lib/yarnEstimator";
import type { PatternYarnSettings } from "@/lib/yarnSettings";
import { useId, useMemo, useState } from "react";

const WEIGHT_LABELS: Record<YarnWeightCategory, string> = {
  lace: "Lace",
  fingering: "Fingering",
  sport: "Sport",
  dk: "DK",
  worsted: "Worsted",
  bulky: "Bulky",
  super_bulky: "Super bulky",
};

const DEFAULT_SPI: Record<YarnWeightCategory, number> = {
  lace: 8.5, fingering: 7.5, sport: 6.5, dk: 5.75, worsted: 5, bulky: 4, super_bulky: 3,
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

  const { gaugeSquaresPer10cm, widthCm, heightCm, widthIn, heightIn } = useMemo(() => {
    const spi = value.customGaugeStitchesPerInch ?? DEFAULT_SPI[value.weight] ?? 5;
    const gaugePer10cm = parseFloat((spi * 10 / 7.62).toFixed(1));
    const wCm = parseFloat(((gridWidth * 10) / gaugePer10cm).toFixed(1));
    const hCm = parseFloat(((gridHeight * 10) / gaugePer10cm).toFixed(1));
    return {
      gaugeSquaresPer10cm: gaugePer10cm,
      widthCm: wCm,
      heightCm: hCm,
      widthIn: parseFloat((wCm / 2.54).toFixed(1)),
      heightIn: parseFloat((hCm / 2.54).toFixed(1)),
    };
  }, [value.customGaugeStitchesPerInch, value.weight, gridWidth, gridHeight]);

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
              min={2}
              max={14}
              step={0.25}
              value={value.customGaugeStitchesPerInch ?? ""}
              placeholder={String(DEFAULT_SPI[value.weight])}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") { onChange({ ...value, customGaugeStitchesPerInch: null }); return; }
                const n = Number(raw);
                onChange({ ...value, customGaugeStitchesPerInch: Number.isFinite(n) ? n : null });
              }}
              className="w-16 bg-transparent text-right font-sans text-[13px] font-bold text-text-strong focus:outline-none"
            />
            <span className="font-sans text-[11px] text-muted">sts/in</span>
          </div>
        </div>
      </div>

      {/* Finished size */}
      <div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted" style={{ marginBottom: 8 }}>
          Finished size
        </div>
        <div className="font-serif font-bold tracking-[-0.01em] text-text-strong" style={{ fontSize: 26, lineHeight: 1 }}>
          {widthCm} × {heightCm}
          <span className="font-sans font-semibold text-muted" style={{ fontSize: 16, marginLeft: 6 }}>cm</span>
        </div>
        <div className="mt-1 font-sans text-[12px] font-semibold text-muted">
          ≈ {widthIn} × {heightIn} in
        </div>
        <div
          className="mt-2 rounded-[10px] font-mono text-[11px] font-medium leading-[1.55]"
          style={{ padding: "10px 12px", background: "#FFF8E8", border: "1px solid rgba(61,42,30,0.10)", color: "#7A6A5F" }}
        >
          <div>
            <span style={{ color: "#7A6A5F", fontSize: 10 }}>W: </span>
            <span style={{ color: "#A8466F", fontWeight: 700 }}>{gridWidth}</span>
            <span> × 10 ÷ </span>
            <span style={{ color: "#A8466F", fontWeight: 700 }}>{gaugeSquaresPer10cm}</span>
            <span> = </span>
            <span style={{ color: "#1F1410", fontWeight: 700 }}>{widthCm} cm</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: "#7A6A5F", fontSize: 10 }}>H: </span>
            <span style={{ color: "#A8466F", fontWeight: 700 }}>{gridHeight}</span>
            <span> × 10 ÷ </span>
            <span style={{ color: "#A8466F", fontWeight: 700 }}>{gaugeSquaresPer10cm}</span>
            <span> = </span>
            <span style={{ color: "#1F1410", fontWeight: 700 }}>{heightCm} cm</span>
          </div>
        </div>
      </div>

      {/* Tip */}
      <p className="font-sans text-[11px] italic text-muted" style={{ marginTop: "auto" }}>
        Tip: estimates assume ~5% loss for turning chains and weaving in ends.
      </p>
    </section>
  );
}
