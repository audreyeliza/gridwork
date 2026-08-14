"use client";

import { PrintGridSvg } from "@/components/PrintGridSvg";
import { fetchPatternById, type Pattern } from "@/lib/patternHelpers";
import { parseGridData } from "@/lib/gridFormat";
import { parseProgressData } from "@/lib/progressData";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { clampYarnStitch, effectiveGaugeSqPer10cm, METHOD_LABELS, STITCH_LABELS } from "@/lib/yarnEstimator";
import { parsePatternYarnSettings } from "@/lib/yarnSettings";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function PrintPatternPage() {
  const params = useParams();
  const patternId = typeof params.patternId === "string" ? params.patternId : params.patternId?.[0] ?? "";
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [units, setUnits] = useState<"imperial" | "metric">("metric");
  const [message, setMessage] = useState<string | null>(null);
  const [pattern, setPattern] = useState<Pattern | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gridwork:yarnUnit");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a browser-only preference; unavailable during render/SSR
      if (saved === "imperial" || saved === "metric") setUnits(saved);
    } catch {}
  }, []);

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
          document.title = data.name;
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
    const { cells, palette } = parseGridData(pattern.grid_data, w, h);
    const progress = parseProgressData(pattern.progress_data, h, w);
    const yarn = parsePatternYarnSettings(pattern.yarn_settings);
    const gaugeSq = effectiveGaugeSqPer10cm(yarn.weight, yarn.hookSize, yarn.customGaugeStitchesPerInch);
    return { cells, palette, progress, yarn, gaugeSq, w, h, name: pattern.name };
  }, [pattern]);

  return (
    <div id="print-root" className="mx-auto max-w-5xl p-6 print:p-0 print:max-w-none">
      <p className="no-print mb-4 text-sm text-zinc-600">
        Opening the print dialog… Use your browser’s print dialog to save as PDF if needed.
      </p>

      {status === "loading" ? (
        <p className="no-print text-sm text-zinc-600">Loading pattern…</p>
      ) : null}
      {status === "error" ? (
        <p className="no-print rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{message}</p>
      ) : null}

      {status === "ready" && view ? (
        <div className="flex flex-col gap-4 print:gap-3">
          <header className="pb-1">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 print:text-black">{view.name}</h1>
            <p className="mt-1 text-sm text-zinc-600 print:text-black">
              Grid {view.w}×{view.h}
              {" · "}
              Method: {METHOD_LABELS[view.yarn.method]}
              {" · "}
              Stitch: {STITCH_LABELS[clampYarnStitch(view.yarn.method, view.yarn.stitch)]}
              {" · "}
              Yarn: {view.yarn.weight.replaceAll("_", " ")}
              {" · "}
              Hook: {view.yarn.hookSize}
              {" · "}
              Gauge:{" "}
              {units === "metric"
                ? `${view.gaugeSq} sq / 10 cm`
                : `${parseFloat((view.gaugeSq / 3.937).toFixed(1))} sq / in`}
            </p>
          </header>

          <section className="break-inside-avoid print-grid-fit" style={{ pageBreakInside: "avoid" }}>
            <PrintGridSvg
              gridWidth={view.w}
              gridHeight={view.h}
              cells={view.cells}
              palette={view.palette}
              rowComplete={view.progress.rowComplete}
              trackMode={view.progress.trackMode}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
