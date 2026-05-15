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
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");

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

  return (
    <section
      className={`relative z-10 flex shrink-0 flex-col gap-3 rounded-xl border border-periwinkle/20 bg-white/95 p-4 shadow-sm pointer-events-auto ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-stone-800">Yarn estimate</h2>
          <p className="mt-0.5 text-[11px] text-stone-500">
            {units === "imperial" ? "Yards & ounces" : "Meters & grams"}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-periwinkle/25 bg-white/90 p-0.5 text-xs shadow-sm">
          <button
            type="button"
            aria-pressed={units === "imperial"}
            onClick={() => setUnits("imperial")}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors duration-150 ${
              units === "imperial"
                ? "bg-brand text-white shadow-sm"
                : "text-gray-700 hover:bg-pink-50 hover:text-gray-900"
            }`}
          >
            Imperial
          </button>
          <button
            type="button"
            aria-pressed={units === "metric"}
            onClick={() => setUnits("metric")}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors duration-150 ${
              units === "metric"
                ? "bg-brand text-white shadow-sm"
                : "text-gray-700 hover:bg-pink-50 hover:text-gray-900"
            }`}
          >
            Metric
          </button>
        </div>
      </div>

      <p className="text-[11px] leading-snug text-stone-600">
        Results are rough estimates only. Work a gauge swatch in your yarn and adjust stitches per inch for
        better accuracy.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-700">
          Yarn weight
          <select
            id={`${idPrefix}-weight`}
            value={value.weight}
            onChange={(e) =>
              onChange({ ...value, weight: e.target.value as YarnWeightCategory })
            }
            className="rounded-lg border border-periwinkle/20 bg-white px-2 py-1.5 text-sm text-stone-900"
          >
            {YARN_WEIGHT_CATEGORIES.map((w) => (
              <option key={w} value={w}>
                {WEIGHT_LABELS[w]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-stone-700">
          Hook size
          <input
            id={`${idPrefix}-hook`}
            type="text"
            value={value.hookSize}
            onChange={(e) => onChange({ ...value, hookSize: e.target.value })}
            placeholder='e.g. "5.5 mm"'
            className="rounded-lg border border-periwinkle/20 bg-white px-2 py-1.5 text-sm text-stone-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-stone-700 sm:col-span-2">
          Custom gauge (stitches / inch), optional
          <input
            id={`${idPrefix}-gauge`}
            type="number"
            min={2}
            max={14}
            step={0.25}
            value={value.customGaugeStitchesPerInch ?? ""}
            placeholder="Leave blank to use hook / weight default"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange({ ...value, customGaugeStitchesPerInch: null });
                return;
              }
              const n = Number(raw);
              onChange({
                ...value,
                customGaugeStitchesPerInch: Number.isFinite(n) ? n : null,
              });
            }}
            className="max-w-xs rounded-lg border border-sky-100 bg-amber-50/20 px-2 py-1.5 text-sm text-stone-900"
          />
        </label>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-periwinkle/15 bg-periwinkle/8 px-3 py-2 text-sm">
        {units === "imperial" ? (
          <>
            <dt className="text-stone-500">Yards</dt>
            <dd className="text-right font-medium tabular-nums text-stone-900">
              {result.yards}
            </dd>
            <dt className="text-stone-500">Ounces</dt>
            <dd className="text-right font-medium tabular-nums text-stone-900">
              {result.oz}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-stone-500">Meters</dt>
            <dd className="text-right font-medium tabular-nums text-stone-900">
              {result.meters}
            </dd>
            <dt className="text-stone-500">Grams</dt>
            <dd className="text-right font-medium tabular-nums text-stone-900">
              {result.grams}
            </dd>
          </>
        )}
      </dl>

      <p className="text-[11px] text-stone-500">
        Grid {gridWidth}×{gridHeight} · {filledCellCount} filled · {emptyCellCount} empty · block cells count
        ~3× mesh for yarn.
      </p>
    </section>
  );
}
