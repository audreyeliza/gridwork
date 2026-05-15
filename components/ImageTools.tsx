"use client";

import { GridCanvas } from "@/components/GridCanvas";
import { imageToThresholdGrid, loadImageFromFile, otsuThreshold } from "@/lib/imageCanvasUtils";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ImageReferenceMode = "none" | "underlay" | "convert";

import type { PatternProgressState } from "@/lib/progressData";

export type ImageToolsProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  onCommit: (next: boolean[][]) => void;
  /** Receives the threshold-generated grid as one editable commit. */
  onApplyConvertedGrid: (next: boolean[][]) => void;
  /** Called when an image is loaded or the scale slider changes so the grid can be resized to match the image aspect ratio. */
  onBestFitGrid?: (w: number, h: number) => void;
  className?: string;
  progress?: PatternProgressState;
  onToggleRowComplete?: (row: number) => void;
};

const MAX_BEST_FIT_CELLS = 80;

function bestFitDimensions(img: HTMLImageElement, scale: number): { w: number; h: number } {
  const ar = img.naturalWidth / img.naturalHeight;
  const maxCells = Math.round(MAX_BEST_FIT_CELLS * scale);
  let w: number;
  let h: number;
  if (ar >= 1) {
    w = maxCells;
    h = Math.max(5, Math.round(w / ar));
  } else {
    h = maxCells;
    w = Math.max(5, Math.round(h * ar));
  }
  w = Math.min(100, Math.max(5, w));
  h = Math.min(100, Math.max(5, h));
  return { w, h };
}

export function ImageTools({
  gridWidth,
  gridHeight,
  cells,
  onCommit,
  onApplyConvertedGrid,
  onBestFitGrid,
  className,
  progress,
  onToggleRowComplete,
}: ImageToolsProps) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImageReferenceMode>("none");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [underlayOpacityPct, setUnderlayOpacityPct] = useState(65);
  const [threshold, setThreshold] = useState(140);
  const [darkIsFilled, setDarkIsFilled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const thresholdRef = useRef(threshold);
  const darkIsFilledRef = useRef(darkIsFilled);

  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  useEffect(() => {
    darkIsFilledRef.current = darkIsFilled;
  }, [darkIsFilled]);

  /** When switching to Auto-convert, changing image/grid size, or toggling fill direction, push a snapshot. */
  useEffect(() => {
    if (mode !== "convert" || !image) return;
    const snap = thresholdRef.current;
    const dif = darkIsFilledRef.current;
    const next = imageToThresholdGrid(image, gridWidth, gridHeight, snap, dif);
    queueMicrotask(() => {
      onApplyConvertedGrid(next);
      setStatus("Image applied to the grid. Adjust threshold and click Apply to grid to refine.");
    });
  }, [image, mode, gridWidth, gridHeight, darkIsFilled, onApplyConvertedGrid]);

  const clearImage = useCallback(() => {
    setImage(null);
    setStatus(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setStatus("Choose an image file.");
        return;
      }
      setStatus(null);
      try {
        const img = await loadImageFromFile(file);
        setImage(img);
        const dims = bestFitDimensions(img, 1.0);
        onBestFitGrid?.(dims.w, dims.h);
      } catch {
        setStatus("Could not load that image.");
      }
    },
    [onBestFitGrid],
  );

  const applyConversion = useCallback(() => {
    if (!image) {
      setStatus("Upload an image first.");
      return;
    }
    const next = imageToThresholdGrid(image, gridWidth, gridHeight, threshold, darkIsFilled);
    onApplyConvertedGrid(next);
    setStatus("Applied. You can edit or undo.");
  }, [image, gridWidth, gridHeight, threshold, darkIsFilled, onApplyConvertedGrid]);

  const underlayOpacity = Math.min(100, Math.max(0, underlayOpacityPct)) / 100;

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${className ?? ""}`}>
      <div className="relative z-30 flex shrink-0 flex-col gap-3 rounded-xl border border-rose-100/90 bg-white/95 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-700">Reference image</span>
          <input
            ref={fileRef}
            id={fileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor={fileInputId}
            className="cursor-pointer rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
          >
            Upload…
          </label>
          {image ? (
            <button
              type="button"
              onClick={clearImage}
              className="text-xs font-medium text-stone-500 underline decoration-rose-200 hover:text-rose-700"
            >
              Clear image
            </button>
          ) : null}
        </div>

        {image ? (
          <div className="flex max-w-xs flex-col gap-1">
            <span className="text-[11px] text-stone-500">Preview</span>
            {/* Local blob preview; next/image is not suited for object URLs here. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
            <img
              src={image.src}
              alt=""
              className="max-h-24 w-auto rounded-lg border border-rose-100 bg-amber-50/40 object-contain"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["none", "Off"],
              ["underlay", "Underlay"],
              ["convert", "Auto-convert"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-violet-400 text-white shadow-sm"
                  : "border border-stone-200 bg-white text-stone-600 hover:border-violet-200 hover:bg-violet-50/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "underlay" && image ? (
          <label className="flex max-w-xs flex-col gap-1 text-xs text-stone-600">
            Underlay opacity ({underlayOpacityPct}%)
            <input
              type="range"
              min={0}
              max={100}
              value={underlayOpacityPct}
              onChange={(e) => setUnderlayOpacityPct(Number(e.target.value))}
            />
          </label>
        ) : null}

        {mode === "convert" && image ? (
          <div className="flex max-w-md flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-stone-600">
                  Threshold — pixels {darkIsFilled ? "below" : "above"} this value fill cells
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="inline-flex rounded-full border border-stone-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setDarkIsFilled(true)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        darkIsFilled ? "bg-stone-700 text-white shadow-sm" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Dark fills
                    </button>
                    <button
                      type="button"
                      onClick={() => setDarkIsFilled(false)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        !darkIsFilled ? "bg-stone-700 text-white shadow-sm" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Light fills
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setThreshold(otsuThreshold(image))}
                    className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100"
                  >
                    Suggest
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={255}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="tabular-nums text-xs text-stone-500">{threshold}</span>
            </div>
            <button
              type="button"
              onClick={applyConversion}
              className="w-fit rounded-full bg-violet-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-violet-600"
            >
              Apply to grid
            </button>
            <p className="text-[11px] leading-snug text-stone-500">
              Uses canvas grayscale + threshold only. Result is merged as a normal edit (undo available).
            </p>
          </div>
        ) : null}

        {status ? <p className="text-xs text-amber-800">{status}</p> : null}
      </div>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col">
      <GridCanvas
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        cells={cells}
        onCommit={onCommit}
        underlayImage={mode === "underlay" ? image : null}
        underlayOpacity={underlayOpacity}
        rowComplete={progress?.rowComplete}
        currentRow={progress?.currentRow}
        onToggleRowComplete={onToggleRowComplete}
        className="min-h-0"
      />
      </div>
    </div>
  );
}
