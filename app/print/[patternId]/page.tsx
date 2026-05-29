"use client";

import { PrintGridSvg } from "@/components/PrintGridSvg";
import { fetchPatternById, type Pattern } from "@/lib/patternHelpers";
import { parseGridData } from "@/lib/gridFormat";
import { parseProgressData } from "@/lib/progressData";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { parsePatternYarnSettings } from "@/lib/yarnSettings";
import { estimateYarnUsage } from "@/lib/yarnEstimator";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function countCells(cells: boolean[][]) {
  let filled = 0;
  let empty = 0;
  for (const row of cells) {
    for (const c of row) {
      if (c) filled += 1;
      else empty += 1;
    }
  }
  return { filled, empty };
}

export default function PrintPatternPage() {
  const params = useParams();
  const patternId = typeof params.patternId === "string" ? params.patternId : params.patternId?.[0] ?? "";
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [units, setUnits] = useState<"imperial" | "metric">("metric");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gridwork:yarnUnit");
      if (saved === "imperial" || saved === "metric") setUnits(saved);
    } catch {}
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [pattern, setPattern] = useState<Pattern | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!patternId) {
        setStatus("error");
        setMessage("Missing pattern id.");
        return;
      }
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (!uid) {
          setStatus("error");
          setMessage("Sign in to print a pattern.");
          return;
        }
        const { data, error } = await fetchPatternById(supabase, patternId, uid);
        if (cancelled) return;
        if (error || !data) {
          setStatus("error");
          setMessage("Could not load this pattern.");
          return;
        }
        setPattern(data);
        setStatus("ready");
        if (typeof document !== "undefined") {
          document.title = `Print — ${data.name}`;
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Supabase is not configured or the request failed.");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [patternId]);

  useEffect(() => {
    if (status !== "ready" || !pattern) return;
    const id = window.setTimeout(() => window.print(), 800);
    return () => window.clearTimeout(id);
  }, [status, pattern]);

  const view = useMemo(() => {
    if (!pattern) return null;
    const w = pattern.grid_width;
    const h = pattern.grid_height;
    const cells = parseGridData(pattern.grid_data, w, h);
    const progress = parseProgressData(pattern.progress_data, h);
    const yarn = parsePatternYarnSettings(pattern.yarn_settings);
    const { filled, empty } = countCells(cells);
    const est = estimateYarnUsage({
      weight: yarn.weight,
      hookSize: yarn.hookSize,
      customGaugeStitchesPerInch: yarn.customGaugeStitchesPerInch,
      gridWidth: w,
      gridHeight: h,
      filledCellCount: filled,
      emptyCellCount: empty,
    });

    return { cells, progress, yarn, est, w, h, name: pattern.name };
  }, [pattern]);

  return (
    <div id="print-root" className="mx-auto max-w-5xl p-6 print:p-4 print:max-w-none">
      <p className="no-print mb-4 text-sm text-zinc-600">
        Opening the print dialog… Use your browser’s print dialog to save as PDF if needed.
      </p>

      {status === "loading" ? <p className="text-sm text-zinc-600">Loading pattern…</p> : null}
      {status === "error" ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{message}</p>
      ) : null}

      {status === "ready" && view ? (
        <div className="flex flex-col gap-6 print:gap-4">
          <header className="border-b border-zinc-200 pb-3 print:border-zinc-800">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 print:text-black">{view.name}</h1>
            <p className="mt-1 text-sm text-zinc-600 print:text-zinc-700">
              Grid {view.w}×{view.h} · Yarn: {view.yarn.weight.replaceAll("_", " ")} · Hook: {view.yarn.hookSize}
              {" · "}
              {(view.yarn.customGaugeStitchesPerInch ?? 0) > 0
                ? units === "metric"
                  ? `Gauge: ${view.yarn.customGaugeStitchesPerInch ?? 0} sq / 10 cm`
                  : `Gauge: ${parseFloat(((view.yarn.customGaugeStitchesPerInch ?? 0) / 3.937).toFixed(1))} sq / in`
                : "Gauge: not set"}
            </p>
          </header>

          <section className="break-inside-avoid" style={{ pageBreakInside: "avoid" }}>
            <div style={{ maxWidth: "100%", overflowX: "auto" }}>
              <PrintGridSvg
                gridWidth={view.w}
                gridHeight={view.h}
                cells={view.cells}
                rowComplete={view.progress.rowComplete}
                currentRow={view.progress.currentRow}
                cellPx={12}
              />
            </div>
          </section>

          <section className="mt-1">
            <p className="text-[11px] text-zinc-500 print:text-zinc-600">
              <span className="font-medium">Yarn estimate</span>
              {" — "}
              {units === "metric"
                ? `${view.est.meters} m · ${view.est.grams} g`
                : `${view.est.yards} yd · ${view.est.oz} oz`}
              {" · "}estimates only, swatch for accuracy.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
