"use client";

import { GridCanvas } from "@/components/GridCanvas";
import {
  drawImageWithTransform,
  imageToThresholdGrid,
  loadImageFromFile,
  otsuThreshold,
  type CropRect,
} from "@/lib/imageCanvasUtils";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ImageReferenceMode = "none" | "underlay" | "convert";

import type { PatternProgressState } from "@/lib/progressData";

export type ImageToolsProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  onCommit: (next: boolean[][]) => void;
  onApplyConvertedGrid: (next: boolean[][]) => void;
  onBestFitGrid?: (w: number, h: number) => void;
  onImageLoad?: (naturalWidth: number, naturalHeight: number) => void;
  onCropExpandedChange?: (expanded: boolean) => void;
  className?: string;
  progress?: PatternProgressState;
  onToggleRowComplete?: (row: number) => void;
};

const MAX_BEST_FIT_CELLS = 80;
const PREVIEW_W = 280;
const PREVIEW_H = 160;
const HANDLE_HALF = 8;
const HANDLE_SIZE = 8;
const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

type TransformType = "flipH" | "flipV" | "rotateLeft" | "rotateRight";
type CropHandle = "tl" | "t" | "tr" | "l" | "r" | "bl" | "b" | "br" | "move" | null;

type CropDragState = {
  handle: Exclude<CropHandle, null>;
  startCanvasX: number;
  startCanvasY: number;
  startCrop: CropRect;
  fitX: number;
  fitY: number;
  fitW: number;
  fitH: number;
};

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
  w = Math.min(200, Math.max(5, w));
  h = Math.min(200, Math.max(5, h));
  return { w, h };
}

function getContainLayout(
  imgW: number,
  imgH: number,
  cw: number,
  ch: number,
): { fitX: number; fitY: number; fitW: number; fitH: number } {
  const ar = imgW / imgH;
  const dr = cw / ch;
  if (ar > dr) {
    const fitW = cw;
    const fitH = cw / ar;
    return { fitX: 0, fitY: (ch - fitH) / 2, fitW, fitH };
  } else {
    const fitH = ch;
    const fitW = ch * ar;
    return { fitX: (cw - fitW) / 2, fitY: 0, fitW, fitH };
  }
}

type HandlePositions = Record<Exclude<CropHandle, "move" | null>, { x: number; y: number }>;

function getHandlePositions(
  crop: CropRect,
  fitX: number,
  fitY: number,
  fitW: number,
  fitH: number,
): HandlePositions {
  const cx = fitX + crop.x * fitW;
  const cy = fitY + crop.y * fitH;
  const cw = crop.w * fitW;
  const ch = crop.h * fitH;
  return {
    tl: { x: cx, y: cy },
    t: { x: cx + cw / 2, y: cy },
    tr: { x: cx + cw, y: cy },
    l: { x: cx, y: cy + ch / 2 },
    r: { x: cx + cw, y: cy + ch / 2 },
    bl: { x: cx, y: cy + ch },
    b: { x: cx + cw / 2, y: cy + ch },
    br: { x: cx + cw, y: cy + ch },
  };
}

function hitTestHandles(
  canvasX: number,
  canvasY: number,
  crop: CropRect,
  fitX: number,
  fitY: number,
  fitW: number,
  fitH: number,
): CropHandle {
  const positions = getHandlePositions(crop, fitX, fitY, fitW, fitH);
  for (const [handle, pos] of Object.entries(positions) as [Exclude<CropHandle, "move" | null>, { x: number; y: number }][]) {
    if (Math.abs(canvasX - pos.x) <= HANDLE_HALF && Math.abs(canvasY - pos.y) <= HANDLE_HALF) {
      return handle;
    }
  }
  const cx = fitX + crop.x * fitW;
  const cy = fitY + crop.y * fitH;
  const cw = crop.w * fitW;
  const ch = crop.h * fitH;
  if (canvasX >= cx && canvasX <= cx + cw && canvasY >= cy && canvasY <= cy + ch) {
    return "move";
  }
  return null;
}

function applyHandleDrag(
  handle: Exclude<CropHandle, null>,
  startCrop: CropRect,
  dx: number,
  dy: number,
  fitW: number,
  fitH: number,
): CropRect {
  const minW = Math.max(0.01, 40 / fitW);
  const minH = Math.max(0.01, 40 / fitH);
  const ndx = dx / fitW;
  const ndy = dy / fitH;
  let { x, y, w, h } = startCrop;

  if (handle === "move") {
    x = Math.max(0, Math.min(1 - w, x + ndx));
    y = Math.max(0, Math.min(1 - h, y + ndy));
  } else if (handle === "tl") {
    const newX = Math.max(0, Math.min(x + w - minW, x + ndx));
    const newY = Math.max(0, Math.min(y + h - minH, y + ndy));
    w = w + (x - newX);
    h = h + (y - newY);
    x = newX;
    y = newY;
  } else if (handle === "t") {
    const newY = Math.max(0, Math.min(y + h - minH, y + ndy));
    h = h + (y - newY);
    y = newY;
  } else if (handle === "tr") {
    const newY = Math.max(0, Math.min(y + h - minH, y + ndy));
    h = h + (y - newY);
    y = newY;
    w = Math.max(minW, Math.min(1 - x, w + ndx));
  } else if (handle === "l") {
    const newX = Math.max(0, Math.min(x + w - minW, x + ndx));
    w = w + (x - newX);
    x = newX;
  } else if (handle === "r") {
    w = Math.max(minW, Math.min(1 - x, w + ndx));
  } else if (handle === "bl") {
    const newX = Math.max(0, Math.min(x + w - minW, x + ndx));
    w = w + (x - newX);
    x = newX;
    h = Math.max(minH, Math.min(1 - y, h + ndy));
  } else if (handle === "b") {
    h = Math.max(minH, Math.min(1 - y, h + ndy));
  } else if (handle === "br") {
    w = Math.max(minW, Math.min(1 - x, w + ndx));
    h = Math.max(minH, Math.min(1 - y, h + ndy));
  }

  return { x, y, w, h };
}

function getCropCursor(handle: CropHandle): string {
  switch (handle) {
    case "tl": case "br": return "cursor-nwse-resize";
    case "tr": case "bl": return "cursor-nesw-resize";
    case "t": case "b": return "cursor-ns-resize";
    case "l": case "r": return "cursor-ew-resize";
    case "move": return "cursor-move";
    default: return "cursor-default";
  }
}

function applyTransform(img: HTMLImageElement, type: TransformType): Promise<HTMLImageElement> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  const isRotate = type === "rotateLeft" || type === "rotateRight";
  canvas.width = isRotate ? h : w;
  canvas.height = isRotate ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(img);

  if (type === "flipH") {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  } else if (type === "flipV") {
    ctx.translate(0, h);
    ctx.scale(1, -1);
  } else if (type === "rotateLeft") {
    ctx.translate(0, w);
    ctx.rotate(-Math.PI / 2);
  } else {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  }

  ctx.drawImage(img, 0, 0, w, h);

  return new Promise((resolve) => {
    const newImg = new Image();
    newImg.onload = () => resolve(newImg);
    newImg.src = canvas.toDataURL("image/png");
  });
}

/** Draws the crop preview canvas: image with pan, dim overlay, rule-of-thirds, handles. */
function drawCropCanvas(
  canvas: HTMLCanvasElement,
  canvasW: number,
  canvasH: number,
  img: HTMLImageElement,
  cropRect: CropRect,
  isDragging: boolean,
  panX: number,
  panY: number,
): void {
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#fdf8f0";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Draw image with pan applied so user sees the offset visually
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvasW, canvasH);
  ctx.clip();
  drawImageWithTransform(ctx, img, 0, 0, canvasW, canvasH, null, panX / 100, panY / 100);
  ctx.restore();

  // Crop overlay positioned relative to panned image
  const { fitX, fitY, fitW, fitH } = getContainLayout(img.naturalWidth, img.naturalHeight, canvasW, canvasH);
  const panXPx = (panX / 100) * canvasW;
  const panYPx = (panY / 100) * canvasH;
  const effFitX = fitX + panXPx;
  const effFitY = fitY + panYPx;

  const cr = cropRect;
  const cx = effFitX + cr.x * fitW;
  const cy = effFitY + cr.y * fitH;
  const cw = cr.w * fitW;
  const ch = cr.h * fitH;

  // 4-panel dim overlay
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, canvasW, cy);
  ctx.fillRect(0, cy + ch, canvasW, canvasH - cy - ch);
  ctx.fillRect(0, cy, cx, ch);
  ctx.fillRect(cx + cw, cy, canvasW - cx - cw, ch);

  // Rule of thirds
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + cw / 3, cy); ctx.lineTo(cx + cw / 3, cy + ch);
  ctx.moveTo(cx + (2 * cw) / 3, cy); ctx.lineTo(cx + (2 * cw) / 3, cy + ch);
  ctx.moveTo(cx, cy + ch / 3); ctx.lineTo(cx + cw, cy + ch / 3);
  ctx.moveTo(cx, cy + (2 * ch) / 3); ctx.lineTo(cx + cw, cy + (2 * ch) / 3);
  ctx.stroke();

  // Crop border
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx, cy, cw, ch);

  // 8 handles
  const positions = getHandlePositions(cr, effFitX, effFitY, fitW, fitH);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (const pos of Object.values(positions)) {
    ctx.fillRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  }

  // Dimensions overlay while dragging
  if (isDragging) {
    const wPct = Math.round(cr.w * 100);
    const hPct = Math.round(cr.h * 100);
    const text = `${wPct}% × ${hPct}%`;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tx = cx + cw / 2;
    const ty = cy + ch / 2;
    const metrics = ctx.measureText(text);
    const pw = metrics.width + 10;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(tx - pw / 2, ty - 9, pw, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, tx, ty);
  }
}

export function ImageTools({
  gridWidth,
  gridHeight,
  cells,
  onCommit,
  onApplyConvertedGrid,
  onBestFitGrid,
  onImageLoad,
  onCropExpandedChange,
  className,
  progress,
  onToggleRowComplete,
}: ImageToolsProps) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const expandedCropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropDragRef = useRef<CropDragState | null>(null);

  const [mode, setMode] = useState<ImageReferenceMode>("none");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [workingImage, setWorkingImage] = useState<HTMLImageElement | null>(null);
  const [underlayOpacityPct, setUnderlayOpacityPct] = useState(65);
  const [threshold, setThreshold] = useState(140);
  const [darkIsFilled, setDarkIsFilled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [cropRect, setCropRect] = useState<CropRect>(FULL_CROP);
  const [appliedCrop, setAppliedCrop] = useState<CropRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverHandle, setHoverHandle] = useState<CropHandle>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [positionLocked, setPositionLocked] = useState(false);
  const [cropExpanded, setCropExpanded] = useState(false);
  const [expandedSize, setExpandedSize] = useState({ w: 700, h: 400 });

  const thresholdRef = useRef(threshold);
  const darkIsFilledRef = useRef(darkIsFilled);
  const appliedCropRef = useRef(appliedCrop);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);

  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);
  useEffect(() => { darkIsFilledRef.current = darkIsFilled; }, [darkIsFilled]);
  useEffect(() => { appliedCropRef.current = appliedCrop; }, [appliedCrop]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  // When source image changes, reset working image and all crop/pan state
  useEffect(() => {
    setWorkingImage(image);
    setCropRect(FULL_CROP);
    setAppliedCrop(null);
    setPanX(0);
    setPanY(0);
    setPositionLocked(false);
    setCropExpanded(false);
  }, [image]);

  // Compute expanded canvas size from viewport when modal opens
  useEffect(() => {
    if (!cropExpanded) return;
    const padding = 96;
    const w = Math.min(Math.round(window.innerWidth * 0.8) - 48, 900);
    const h = Math.min(Math.round(w * (PREVIEW_H / PREVIEW_W)), Math.round(window.innerHeight * 0.8) - padding);
    setExpandedSize({ w, h });
  }, [cropExpanded]);

  // Notify parent when crop fullscreen state changes
  useEffect(() => {
    onCropExpandedChange?.(cropExpanded);
  }, [cropExpanded, onCropExpandedChange]);

  // Draw normal crop preview canvas
  useEffect(() => {
    if (!cropCanvasRef.current || !workingImage || cropExpanded) return;
    drawCropCanvas(cropCanvasRef.current, PREVIEW_W, PREVIEW_H, workingImage, cropRect, isDragging, panX, panY);
  }, [workingImage, cropRect, isDragging, panX, panY, cropExpanded]);

  // Draw expanded crop canvas
  useEffect(() => {
    if (!expandedCropCanvasRef.current || !workingImage || !cropExpanded) return;
    drawCropCanvas(expandedCropCanvasRef.current, expandedSize.w, expandedSize.h, workingImage, cropRect, isDragging, panX, panY);
  }, [workingImage, cropRect, isDragging, panX, panY, cropExpanded, expandedSize]);

  // Auto-apply conversion when pan changes in convert mode (reconnects pan → convert mapping)
  useEffect(() => {
    if (mode !== "convert" || !workingImage) return;
    const next = imageToThresholdGrid(
      workingImage, gridWidth, gridHeight,
      thresholdRef.current, darkIsFilledRef.current,
      appliedCropRef.current, panX / 100, panY / 100,
    );
    queueMicrotask(() => onApplyConvertedGrid(next));
  }, [mode, workingImage, gridWidth, gridHeight, panX, panY, onApplyConvertedGrid]);

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
        setThreshold(otsuThreshold(img));
        onImageLoad?.(img.naturalWidth, img.naturalHeight);
        const dims = bestFitDimensions(img, 1.0);
        onBestFitGrid?.(dims.w, dims.h);
      } catch {
        setStatus("Could not load that image.");
      }
    },
    [onBestFitGrid, onImageLoad],
  );

  const handleTransform = useCallback(
    async (type: TransformType) => {
      if (!workingImage) return;
      const newImg = await applyTransform(workingImage, type);
      setWorkingImage(newImg);
    },
    [workingImage],
  );

  const applyConversion = useCallback(() => {
    if (!workingImage) {
      setStatus("Upload an image first.");
      return;
    }
    const next = imageToThresholdGrid(
      workingImage, gridWidth, gridHeight,
      threshold, darkIsFilled, appliedCrop, panX / 100, panY / 100,
    );
    onApplyConvertedGrid(next);
    setStatus("Applied. You can edit or undo.");
  }, [workingImage, gridWidth, gridHeight, threshold, darkIsFilled, appliedCrop, panX, panY, onApplyConvertedGrid]);

  const applyCrop = useCallback(() => {
    setAppliedCrop({ ...cropRect });
    if (mode === "convert" && workingImage) {
      const next = imageToThresholdGrid(
        workingImage, gridWidth, gridHeight,
        thresholdRef.current, darkIsFilledRef.current,
        cropRect, panXRef.current / 100, panYRef.current / 100,
      );
      onApplyConvertedGrid(next);
      setStatus("Crop applied and grid updated.");
    }
  }, [cropRect, mode, workingImage, gridWidth, gridHeight, onApplyConvertedGrid]);

  const resetCrop = useCallback(() => {
    setCropRect(FULL_CROP);
    setAppliedCrop(null);
  }, []);

  // Pointer handlers — use bounding rect for dimensions so they work on both normal and expanded canvas
  const onCropPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!workingImage || positionLocked) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasW = rect.width;
      const canvasH = rect.height;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { fitX, fitY, fitW, fitH } = getContainLayout(
        workingImage.naturalWidth, workingImage.naturalHeight, canvasW, canvasH,
      );
      const panXPx = (panX / 100) * canvasW;
      const panYPx = (panY / 100) * canvasH;
      const handle = hitTestHandles(px, py, cropRect, fitX + panXPx, fitY + panYPx, fitW, fitH);
      if (!handle) return;
      cropDragRef.current = {
        handle,
        startCanvasX: px,
        startCanvasY: py,
        startCrop: { ...cropRect },
        fitX: fitX + panXPx,
        fitY: fitY + panYPx,
        fitW,
        fitH,
      };
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [workingImage, positionLocked, cropRect, panX, panY],
  );

  const onCropPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!workingImage) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasW = rect.width;
      const canvasH = rect.height;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (cropDragRef.current) {
        const { handle, startCanvasX, startCanvasY, startCrop, fitW, fitH } = cropDragRef.current;
        setCropRect(applyHandleDrag(handle, startCrop, px - startCanvasX, py - startCanvasY, fitW, fitH));
        return;
      }

      const { fitX, fitY, fitW, fitH } = getContainLayout(
        workingImage.naturalWidth, workingImage.naturalHeight, canvasW, canvasH,
      );
      const panXPx = (panX / 100) * canvasW;
      const panYPx = (panY / 100) * canvasH;
      setHoverHandle(hitTestHandles(px, py, cropRect, fitX + panXPx, fitY + panYPx, fitW, fitH));
    },
    [workingImage, cropRect, panX, panY],
  );

  const onCropPointerUp = useCallback(() => {
    cropDragRef.current = null;
    setIsDragging(false);
  }, []);

  const underlayOpacity = Math.min(100, Math.max(0, underlayOpacityPct)) / 100;
  const activeCrop = appliedCrop;
  const cropCursor = getCropCursor(isDragging ? (cropDragRef.current?.handle ?? null) : hoverHandle);

  const cropCanvasJSX = (ref: React.RefObject<HTMLCanvasElement | null>, w: number, h: number) => (
    <canvas
      ref={ref}
      width={w}
      height={h}
      onPointerDown={onCropPointerDown}
      onPointerMove={onCropPointerMove}
      onPointerUp={onCropPointerUp}
      className={`rounded-lg border border-rose-100 ${positionLocked ? "cursor-not-allowed" : cropCursor}`}
      style={{ width: w, height: h, display: "block" }}
    />
  );

  return (
    <div id="tutorial-image-tools" className={`flex min-h-0 flex-1 flex-col gap-3 ${className ?? ""}`}>
      {/* Expanded crop modal */}
      {cropExpanded && workingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setCropExpanded(false); }}
        >
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-2xl" style={{ maxWidth: "95vw" }}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-stone-800">Crop image</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyCrop}
                  disabled={positionLocked}
                  className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
                >
                  Apply Crop
                </button>
                <button
                  type="button"
                  onClick={resetCrop}
                  disabled={positionLocked}
                  className="rounded-full border border-gray-300 px-2.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-pink-50 disabled:opacity-40"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setCropExpanded(false)}
                  className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-stone-50"
                >
                  Collapse ↙
                </button>
              </div>
            </div>
            {cropCanvasJSX(expandedCropCanvasRef, expandedSize.w, expandedSize.h)}
          </div>
        </div>
      )}

      <div className="relative z-30 flex shrink-0 flex-col gap-3 rounded-xl border border-rose-100/90 bg-white/95 p-3 shadow-sm">

        {/* Upload row */}
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

        {/* Image section */}
        {workingImage ? (
          <div className="flex flex-col gap-2">
            {/* Crop header */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-stone-500">Crop</span>
              <button
                type="button"
                onClick={() => setCropExpanded(true)}
                title="Expand crop preview"
                className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-pink-50"
              >
                ⤢
              </button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={positionLocked}
                className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-medium text-white shadow-sm transition-colors disabled:opacity-50 hover:bg-brand-dark"
              >
                Apply Crop
              </button>
              <button
                type="button"
                onClick={resetCrop}
                disabled={positionLocked}
                className="rounded-full border border-gray-300 px-2.5 py-0.5 text-[11px] font-medium text-gray-700 transition-colors disabled:opacity-40 hover:bg-pink-50"
              >
                Reset
              </button>
              {appliedCrop && (
                <span className="text-[11px] text-stone-400">
                  Applied {Math.round(appliedCrop.w * 100)}%×{Math.round(appliedCrop.h * 100)}%
                </span>
              )}
              <button
                type="button"
                onClick={() => setPositionLocked((p) => !p)}
                title={positionLocked ? "Unlock position" : "Lock position — freeze crop and pan"}
                className={`ml-auto rounded-md border border-gray-300 bg-white/80 p-1.5 transition-colors hover:bg-pink-50 ${
                  positionLocked ? "text-brand" : "text-gray-400"
                }`}
              >
                {positionLocked ? (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="12" height="8" rx="1.5" />
                    <path d="M5 7V5a3 3 0 016 0v2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="12" height="8" rx="1.5" />
                    <path d="M5 7V5a3 3 0 016 0V2" />
                  </svg>
                )}
              </button>
            </div>

            {/* Normal crop canvas (hidden when expanded modal is open) */}
            {!cropExpanded && cropCanvasJSX(cropCanvasRef, PREVIEW_W, PREVIEW_H)}

            {/* Pan controls */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-16 text-[11px] text-stone-500">X offset</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={panX}
                  disabled={positionLocked}
                  onChange={(e) => setPanX(Number(e.target.value))}
                  className="flex-1 disabled:opacity-40"
                />
                <span className="w-8 text-right tabular-nums text-[11px] text-stone-500">{panX > 0 ? `+${panX}` : panX}%</span>
                {panX !== 0 && !positionLocked && (
                  <button type="button" onClick={() => setPanX(0)} className="text-[10px] text-stone-400 hover:text-stone-600">↩</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 text-[11px] text-stone-500">Y offset</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={panY}
                  disabled={positionLocked}
                  onChange={(e) => setPanY(Number(e.target.value))}
                  className="flex-1 disabled:opacity-40"
                />
                <span className="w-8 text-right tabular-nums text-[11px] text-stone-500">{panY > 0 ? `+${panY}` : panY}%</span>
                {panY !== 0 && !positionLocked && (
                  <button type="button" onClick={() => setPanY(0)} className="text-[10px] text-stone-400 hover:text-stone-600">↩</button>
                )}
              </div>
            </div>

            {/* Transform controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-stone-500">Transform</span>
              {(["flipH", "flipV", "rotateLeft", "rotateRight"] as TransformType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => void handleTransform(type)}
                  disabled={positionLocked}
                  className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 transition-colors hover:bg-pink-50 hover:text-gray-900 disabled:opacity-40"
                >
                  {type === "flipH" ? "Flip H" : type === "flipV" ? "Flip V" : type === "rotateLeft" ? "↺ 90°" : "↻ 90°"}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Mode selector */}
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
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                mode === m
                  ? "border-transparent bg-brand text-white shadow-sm"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-pink-50 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "underlay" && workingImage ? (
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

        {mode === "convert" && workingImage ? (
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
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 ${
                        darkIsFilled ? "bg-brand text-white shadow-sm" : "text-gray-700 hover:bg-pink-50"
                      }`}
                    >
                      Dark fills
                    </button>
                    <button
                      type="button"
                      onClick={() => setDarkIsFilled(false)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 ${
                        !darkIsFilled ? "bg-brand text-white shadow-sm" : "text-gray-700 hover:bg-pink-50"
                      }`}
                    >
                      Light fills
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (workingImage) setThreshold(otsuThreshold(workingImage)); }}
                    className="rounded-full border border-accent/30 bg-accent/8 px-2.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/15"
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
              className="w-fit rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-dark"
            >
              Apply to grid
            </button>
            <p className="text-[11px] leading-snug text-stone-500">
              Uses canvas grayscale + threshold. Crop and pan apply before conversion. Result is merged as a normal edit (undo available).
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
          underlayImage={mode === "underlay" ? workingImage : null}
          underlayOpacity={underlayOpacity}
          underlayCrop={activeCrop}
          underlayPanX={panX / 100}
          underlayPanY={panY / 100}
          rowComplete={progress?.rowComplete}
          currentRow={progress?.currentRow}
          onToggleRowComplete={onToggleRowComplete}
          className="min-h-0"
        />
      </div>
    </div>
  );
}
