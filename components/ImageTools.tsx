"use client";

import { GridCanvas } from "@/components/GridCanvas";
import { imageToThresholdGrid, loadImageFromFile } from "@/lib/imageCanvasUtils";
import { useCallback, useId, useRef, useState } from "react";

export type ImageReferenceMode = "none" | "underlay" | "convert";

export type ImageToolsProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  onCommit: (next: boolean[][]) => void;
  /** Receives the threshold-generated grid as one editable commit. */
  onApplyConvertedGrid: (next: boolean[][]) => void;
  className?: string;
};

export function ImageTools({
  gridWidth,
  gridHeight,
  cells,
  onCommit,
  onApplyConvertedGrid,
  className,
}: ImageToolsProps) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImageReferenceMode>("none");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [underlayOpacityPct, setUnderlayOpacityPct] = useState(65);
  const [threshold, setThreshold] = useState(140);
  const [status, setStatus] = useState<string | null>(null);

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
      } catch {
        setStatus("Could not load that image.");
      }
    },
    [],
  );

  const applyConversion = useCallback(() => {
    if (!image) {
      setStatus("Upload an image first.");
      return;
    }
    const next = imageToThresholdGrid(image, gridWidth, gridHeight, threshold, true);
    onApplyConvertedGrid(next);
    setStatus("Applied. You can edit or undo.");
  }, [image, gridWidth, gridHeight, threshold, onApplyConvertedGrid]);

  const underlayOpacity = Math.min(100, Math.max(0, underlayOpacityPct)) / 100;

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${className ?? ""}`}>
      <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Reference image</span>
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
            className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            Upload…
          </label>
          {image ? (
            <button
              type="button"
              onClick={clearImage}
              className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
            >
              Clear image
            </button>
          ) : null}
        </div>

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
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                mode === m
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "underlay" && image ? (
          <label className="flex max-w-xs flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
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
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              Threshold (0–255, dark pixels fill cells below this value)
              <input
                type="range"
                min={0}
                max={255}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="tabular-nums text-zinc-500">{threshold}</span>
            </label>
            <button
              type="button"
              onClick={applyConversion}
              className="w-fit rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Apply to grid
            </button>
            <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              Uses canvas grayscale + threshold only. Result is merged as a normal edit (undo available).
            </p>
          </div>
        ) : null}

        {status ? <p className="text-xs text-amber-700 dark:text-amber-300">{status}</p> : null}
      </div>

      <GridCanvas
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        cells={cells}
        onCommit={onCommit}
        underlayImage={mode === "underlay" ? image : null}
        underlayOpacity={underlayOpacity}
        className="min-h-0"
      />
    </div>
  );
}
