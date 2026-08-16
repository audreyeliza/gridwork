"use client";

import { chainReadout } from "@/lib/craftMode";
import {
  autoGaugeSqPer10cm,
  clampYarnStitch,
  DEFAULT_STITCH_FOR_METHOD,
  effectiveGaugeSqPer10cm,
  estimateYarnUsage,
  finishedSizeForYarn,
  HOOK_DEFAULTS,
  METHOD_LABELS,
  normalizeHookSize,
  STITCH_LABELS,
  STITCHES_FOR_METHOD,
  YARN_METHODS,
  YARN_WEIGHT_CATEGORIES,
  type YarnEstimateResult,
  type YarnMethod,
  type YarnStitch,
  type YarnWeightCategory,
} from "@/lib/yarnEstimator";
import type { PatternYarnSettings, YarnUnits } from "@/lib/yarnSettings";
import { useId, useMemo } from "react";

const WEIGHT_LABELS: Record<YarnWeightCategory, string> = {
  lace: "0 · Lace",
  fingering: "1 · Fingering",
  sport: "2 · Sport",
  dk: "3 · DK",
  worsted: "4 · Worsted",
  bulky: "5 · Bulky",
  super_bulky: "6 · Super bulky",
};

const SQ_PER_INCH = 3.937;
const AUTO_GAUGE_EPS = 0.1;

export type YarnEstimatorProps = {
  gridWidth: number;
  gridHeight: number;
  filledCellCount: number;
  emptyCellCount: number;
  /** Bottom-right cell filled — filet chain count / from-hook hint. */
  startFilled?: boolean;
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

function displayGauge(sqPer10cm: number, units: YarnUnits): number {
  if (units === "imperial") return parseFloat((sqPer10cm / SQ_PER_INCH).toFixed(1));
  return sqPer10cm;
}

function formatFinishedSize(widthCm: number, heightCm: number, units: YarnUnits): string {
  return units === "metric"
    ? `${widthCm} × ${heightCm} cm`
    : `${toFractionalInch(widthCm)} × ${toFractionalInch(heightCm)} in`;
}

export function YarnEstimator({
  gridWidth,
  gridHeight,
  filledCellCount,
  emptyCellCount,
  startFilled = false,
  value,
  onChange,
  className,
}: YarnEstimatorProps) {
  const idPrefix = useId();
  const units: YarnUnits = value.units === "imperial" ? "imperial" : "metric";
  const method: YarnMethod = value.method ?? "filet";
  const stitch: YarnStitch = clampYarnStitch(method, value.stitch ?? DEFAULT_STITCH_FOR_METHOD[method]);
  const stitchOptions = STITCHES_FOR_METHOD[method];

  const autoGauge = useMemo(
    () => autoGaugeSqPer10cm(value.weight, value.hookSize),
    [value.weight, value.hookSize],
  );

  const gaugeSqPer10cm = useMemo(
    () => effectiveGaugeSqPer10cm(value.weight, value.hookSize, value.customGaugeStitchesPerInch),
    [value.weight, value.hookSize, value.customGaugeStitchesPerInch],
  );

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
    [
      value.weight,
      value.hookSize,
      value.customGaugeStitchesPerInch,
      gridWidth,
      gridHeight,
      filledCellCount,
      emptyCellCount,
    ],
  );

  const size = useMemo(
    () =>
      finishedSizeForYarn(
        method,
        stitch,
        value.weight,
        value.hookSize,
        gridWidth,
        gridHeight,
        value.customGaugeStitchesPerInch,
      ),
    [method, stitch, value.weight, value.hookSize, gridWidth, gridHeight, value.customGaugeStitchesPerInch],
  );

  const chain = useMemo(
    () => chainReadout(method, stitch, gridWidth, startFilled),
    [method, stitch, gridWidth, startFilled],
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
        <div className="mt-1.5 font-mono text-[15px] font-bold tabular-nums punch-print-ink">
          {formatFinishedSize(size.widthCm, size.heightCm, units)}
        </div>
      </div>

      <div className="border-b pb-3" style={{ borderColor: "var(--print-ink-faint)" }}>
        <div className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Chain</div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3 font-mono text-[11px] punch-print-ink">
          <span className="font-bold tabular-nums">{chain.display}</span>
          <span className="text-right text-[9px] uppercase tracking-[0.06em] punch-print-faint">
            {chain.hint}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-2 border-b py-2.5" style={{ borderColor: "var(--print-ink-faint)" }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Method</span>
          <select
            id={`${idPrefix}-method`}
            value={method}
            onChange={(e) => {
              const nextMethod = e.target.value as YarnMethod;
              onChange({
                ...value,
                method: nextMethod,
                stitch: clampYarnStitch(nextMethod, stitch),
              });
            }}
            className="bg-transparent font-mono text-[12px] font-bold punch-print-ink focus:outline-none"
          >
            {YARN_METHODS.map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 border-b py-2.5" style={{ borderColor: "var(--print-ink-faint)" }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Stitch</span>
          <select
            id={`${idPrefix}-stitch`}
            value={stitch}
            onChange={(e) => onChange({ ...value, stitch: e.target.value as YarnStitch })}
            className="bg-transparent font-mono text-[12px] font-bold punch-print-ink focus:outline-none"
          >
            {stitchOptions.map((s) => (
              <option key={s} value={s}>{STITCH_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 border-b py-2.5" style={{ borderColor: "var(--print-ink-faint)" }}>
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">Weight</span>
          <select
            id={`${idPrefix}-weight`}
            value={value.weight}
            onChange={(e) => {
              const weight = e.target.value as YarnWeightCategory;
              onChange({ ...value, weight, hookSize: HOOK_DEFAULTS[weight] });
            }}
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
            onBlur={() => {
              const next = normalizeHookSize(value.hookSize);
              if (next !== value.hookSize) onChange({ ...value, hookSize: next });
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const next = normalizeHookSize(value.hookSize);
              if (next !== value.hookSize) onChange({ ...value, hookSize: next });
              (e.target as HTMLInputElement).blur();
            }}
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
              value={displayGauge(gaugeSqPer10cm, units)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange({ ...value, customGaugeStitchesPerInch: 0 });
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n) || n <= 0) return;
                const stored = units === "imperial" ? parseFloat((n * SQ_PER_INCH).toFixed(2)) : n;
                const custom = Math.abs(stored - autoGauge) < AUTO_GAUGE_EPS ? 0 : stored;
                onChange({ ...value, customGaugeStitchesPerInch: custom });
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
