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
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
    return () => window.cancelAnimationFrame(id);
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
    <div id="print-root" className="mx-auto max-w-4xl p-6 print:p-4 print:max-w-none">
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
              {view.yarn.customGaugeStitchesPerInch != null
                ? ` · Gauge ${view.yarn.customGaugeStitchesPerInch} sts/in`
                : ""}
            </p>
          </header>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-800 print:text-black">Pattern</h2>
            <PrintGridSvg
              gridWidth={view.w}
              gridHeight={view.h}
              cells={view.cells}
              rowComplete={view.progress.rowComplete}
              currentRow={view.progress.currentRow}
              cellPx={12}
            />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm print:border-zinc-800 print:bg-white">
            <h2 className="mb-2 font-semibold text-zinc-900 print:text-black">Yarn estimate (approximate)</h2>
            <ul className="grid gap-1 text-zinc-700 sm:grid-cols-2 print:text-black">
              <li>Yards: {view.est.yards}</li>
              <li>Meters: {view.est.meters}</li>
              <li>Grams: {view.est.grams}</li>
              <li>Ounces: {view.est.oz}</li>
            </ul>
            <p className="mt-2 text-xs text-zinc-500 print:text-zinc-600">
              Estimates only — swatch and measure your gauge for best accuracy.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
