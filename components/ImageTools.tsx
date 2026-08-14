"use client";

import { GridCanvas } from "@/components/GridCanvas";
import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import { createPortal } from "react-dom";
import {
  drawImageWithTransform,
  getImageTransformLayout,
  imageToThresholdGrid,
  loadImageFromFile,
  otsuThreshold,
  type CropRect,
} from "@/lib/imageCanvasUtils";
import {
  compressImageToDataUrl,
  createImageLayer,
  defaultImageLayerName,
  loadImageFromDataUrl,
  type PatternImageDocument,
  type PatternImageLayer,
  type PatternImageSettings,
} from "@/lib/imageSettings";
import { DEFAULT_MANILA_STOCK, manilaHex } from "@/lib/manilaStock";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

export type ImageReferenceMode = "none" | "underlay" | "convert";

import type { PatternProgressState, TrackMode } from "@/lib/progressData";
import type { GridUnderlayLayer, InkBrush } from "@/components/GridCanvas";
import type { CellGrid } from "@/lib/gridFormat";
import { booleanGridToCells } from "@/lib/gridFormat";

export type ImageToolsProps = {
  gridWidth: number;
  gridHeight: number;
  cells: CellGrid;
  onCommit: (next: CellGrid) => void;
  onApplyConvertedGrid: (next: CellGrid) => void;
  onBestFitGrid?: (w: number, h: number) => void;
  onImageLoad?: (naturalWidth: number, naturalHeight: number) => void;
  onGridFullscreenChange?: (fullscreen: boolean) => void;
  className?: string;
  progress?: PatternProgressState;
  onToggleRowComplete?: (row: number) => void;
  trackMode?: TrackMode;
  /** View-only horizontal mirror so turned work matches the chart. */
  mirrorView?: boolean;
  /** Saved multi-image document from the DB — applied when imageSettingsLoadKey changes. */
  savedImageDocument?: PatternImageDocument | null;
  /** Changing this key triggers a full reinit from savedImageDocument. */
  imageSettingsLoadKey?: string;
  /** Called whenever the image document changes (for autosave). */
  onImageDocumentChange?: (doc: PatternImageDocument) => void;
  /** When set, image controls are portaled into this element instead of rendered inline. */
  sidePanelTarget?: HTMLElement | null;
  /** When true, grid cells cannot be painted. */
  editLocked?: boolean;
  /** Manila card stock fill for the grid. */
  paperColor?: string;
  hideFullscreenEntry?: boolean;
  enterFullscreenRef?: MutableRefObject<(() => void) | null>;
  /** Parent control bar can call fit / zoom in / zoom out. */
  zoomApiRef?: MutableRefObject<{ fit: () => void; zoomIn: () => void; zoomOut: () => void } | null>;
  /** Palette hex colors for filled cells. */
  palette?: string[];
  /** Active ink well index, or null to erase. */
  brushInk?: InkBrush;
};

const MAX_BEST_FIT_CELLS = 80;
const PREVIEW_W = 304;
const PREVIEW_H = 216;
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
  startPanX: number;
  startPanY: number;
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

/** Free-aspect crop resize / move. */
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
  imageZoom: number,
  gridWidth: number,
  gridHeight: number,
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
  drawImageWithTransform(ctx, img, 0, 0, canvasW, canvasH, null, panX / 100, panY / 100, imageZoom);
  ctx.restore();

  // Crop overlay positioned relative to panned/zoomed image
  const { fitX: effFitX, fitY: effFitY, fitW, fitH } = getImageTransformLayout(
    img.naturalWidth,
    img.naturalHeight,
    canvasW,
    canvasH,
    null,
    panX / 100,
    panY / 100,
    imageZoom,
  );

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

  // Light grid mesh inside crop matching pattern aspect
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  const cols = Math.min(gridWidth, 24);
  const rows = Math.min(gridHeight, 24);
  ctx.beginPath();
  for (let i = 1; i < cols; i++) {
    const gx = cx + (cw * i) / cols;
    ctx.moveTo(gx, cy);
    ctx.lineTo(gx, cy + ch);
  }
  for (let j = 1; j < rows; j++) {
    const gy = cy + (ch * j) / rows;
    ctx.moveTo(cx, gy);
    ctx.lineTo(cx + cw, gy);
  }
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

  // Grid size overlay (cells), always visible
  const text = `${gridWidth} × ${gridHeight}`;
  ctx.font = "bold 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tx = cx + cw / 2;
  const ty = cy + ch / 2;
  const metrics = ctx.measureText(text);
  const pw = metrics.width + 12;
  ctx.fillStyle = isDragging ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)";
  ctx.fillRect(tx - pw / 2, ty - 9, pw, 18);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, tx, ty);
}

function CropCanvas({
  canvasRef,
  w,
  h,
  positionLocked,
  cropCursor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  w: number;
  h: number;
  positionLocked: boolean;
  cropCursor: string;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: () => void;
}) {
  return (
    <div
      className="overflow-hidden border"
      style={{
        width: w,
        height: h,
        borderColor: "var(--print-ink-faint)",
        flexShrink: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={positionLocked ? "cursor-not-allowed" : cropCursor}
        style={{
          width: w,
          height: h,
          display: "block",
        }}
      />
    </div>
  );
}

export function ImageTools({
  gridWidth,
  gridHeight,
  cells,
  onCommit,
  onApplyConvertedGrid,
  onBestFitGrid,
  onImageLoad,
  onGridFullscreenChange,
  className,
  progress,
  onToggleRowComplete,
  trackMode = "row",
  mirrorView = false,
  savedImageDocument,
  imageSettingsLoadKey,
  onImageDocumentChange,
  sidePanelTarget,
  editLocked = false,
  paperColor = "#E8E2D0",
  hideFullscreenEntry = false,
  enterFullscreenRef,
  zoomApiRef,
  palette,
  brushInk = 0,
}: ImageToolsProps) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const expandedCropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropDragRef = useRef<CropDragState | null>(null);

  const [layers, setLayers] = useState<PatternImageLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [layerImages, setLayerImages] = useState<Record<string, HTMLImageElement>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [mode, setMode] = useState<ImageReferenceMode>("none");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [workingImage, setWorkingImage] = useState<HTMLImageElement | null>(null);
  const [underlayOpacityPct, setUnderlayOpacityPct] = useState(65);
  const [threshold, setThreshold] = useState(140);
  const [darkIsFilled, setDarkIsFilled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [gridFullscreen, setGridFullscreen] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect>(FULL_CROP);
  const [appliedCrop, setAppliedCrop] = useState<CropRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverHandle, setHoverHandle] = useState<CropHandle>(null);
  const [dragHandle, setDragHandle] = useState<CropHandle>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [positionLocked, setPositionLocked] = useState(false);
  const [cropExpanded, setCropExpanded] = useState(false);
  const [expandedSize, setExpandedSize] = useState({ w: 640, h: 400 });

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  /** View-only zoom for crop canvases — does not affect grid underlay/convert. */
  const [cropViewZoom, setCropViewZoom] = useState(1);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const skipImageResetRef = useRef(false);
  const suppressReportRef = useRef(false);

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

  // When source image changes, reset working image and crop/pan state.
  useEffect(() => {
    if (skipImageResetRef.current) {
      skipImageResetRef.current = false;
      return;
    }
    setWorkingImage(image);
    setCropRect(FULL_CROP);
    setAppliedCrop(null);
    setPanX(0);
    setPanY(0);
    setPositionLocked(false);
    setCropExpanded(false);
    setImageZoom(1);
    setCropViewZoom(1);
  }, [image]);

  useEffect(() => {
    if (!cropExpanded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets crop view state each time the crop panel expands
    setCropViewZoom(1);
    const padding = 120;
    const w = Math.min(Math.round(window.innerWidth * 0.72) - 48, 720);
    const h = Math.min(Math.round(w * (PREVIEW_H / PREVIEW_W)), Math.round(window.innerHeight * 0.55) - padding);
    setExpandedSize({ w: Math.max(280, w), h: Math.max(180, h) });
  }, [cropExpanded]);

  useEffect(() => {
    if (!sidePanelTarget || !cropCanvasRef.current || !workingImage || cropExpanded) return;
    drawCropCanvas(
      cropCanvasRef.current,
      PREVIEW_W,
      PREVIEW_H,
      workingImage,
      cropRect,
      isDragging,
      0,
      0,
      cropViewZoom,
      gridWidth,
      gridHeight,
    );
  }, [sidePanelTarget, workingImage, cropRect, isDragging, cropViewZoom, cropExpanded, gridWidth, gridHeight]);

  useEffect(() => {
    if (!expandedCropCanvasRef.current || !workingImage || !cropExpanded) return;
    drawCropCanvas(
      expandedCropCanvasRef.current,
      expandedSize.w,
      expandedSize.h,
      workingImage,
      cropRect,
      isDragging,
      0,
      0,
      cropViewZoom,
      gridWidth,
      gridHeight,
    );
  }, [workingImage, cropRect, isDragging, cropViewZoom, cropExpanded, expandedSize, gridWidth, gridHeight]);

  const applyLayerToEditor = useCallback((layer: PatternImageLayer | null) => {
    suppressReportRef.current = true;
    setMode(layer?.mode ?? "none");
    setUnderlayOpacityPct(layer?.underlayOpacityPct ?? 65);
    setThreshold(layer?.threshold ?? 140);
    setDarkIsFilled(layer?.darkIsFilled ?? true);
    setCropRect(layer?.cropRect ?? FULL_CROP);
    setAppliedCrop(layer?.appliedCrop ?? null);
    setPanX(layer?.panX ?? 0);
    setPanY(layer?.panY ?? 0);
    setImageZoom(layer?.imageZoom ?? 1);
    setPositionLocked(layer?.positionLocked ?? false);
    setCropViewZoom(1);
    setCropExpanded(false);

    if (layer?.imageDataUrl) {
      setImageDataUrl(layer.imageDataUrl);
      loadImageFromDataUrl(layer.imageDataUrl)
        .then((img) => {
          skipImageResetRef.current = true;
          setImage(img);
          setWorkingImage(img);
          setLayerImages((prev) => ({ ...prev, [layer.id]: img }));
        })
        .catch(() => {
          setImage(null);
          setWorkingImage(null);
          setImageDataUrl(null);
        })
        .finally(() => {
          window.setTimeout(() => {
            suppressReportRef.current = false;
          }, 0);
        });
    } else {
      setImage(null);
      setWorkingImage(null);
      setImageDataUrl(null);
      window.setTimeout(() => {
        suppressReportRef.current = false;
      }, 0);
    }
  }, []);

  const currentSettings = useCallback((): PatternImageSettings => ({
    mode,
    imageDataUrl,
    underlayOpacityPct,
    threshold,
    darkIsFilled,
    cropRect,
    appliedCrop,
    panX,
    panY,
    imageZoom,
    positionLocked,
  }), [mode, imageDataUrl, underlayOpacityPct, threshold, darkIsFilled, cropRect, appliedCrop, panX, panY, imageZoom, positionLocked]);

  const buildDocument = useCallback((): PatternImageDocument => {
    const settings = currentSettings();
    const images = layers.map((layer) =>
      layer.id === activeLayerId
        ? { ...layer, ...settings }
        : layer,
    );
    // If active id is missing from layers but we have an image, keep a layer
    if (activeLayerId && !images.some((l) => l.id === activeLayerId) && settings.imageDataUrl) {
      images.push(createImageLayer({ id: activeLayerId, ...settings }));
    }
    return { images, activeImageId: activeLayerId };
  }, [layers, activeLayerId, currentSettings]);

  const fillIndexForConvert = brushInk ?? 0;

  // Auto-apply conversion when pan changes in convert mode (reconnects pan → convert mapping)
  useEffect(() => {
    if (mode !== "convert" || !workingImage) return;
    const next = booleanGridToCells(
      imageToThresholdGrid(
        workingImage, gridWidth, gridHeight,
        thresholdRef.current, darkIsFilledRef.current,
        appliedCropRef.current, panX / 100, panY / 100, imageZoom,
      ),
      fillIndexForConvert,
    );
    queueMicrotask(() => onApplyConvertedGrid(next));
  }, [mode, workingImage, gridWidth, gridHeight, panX, panY, imageZoom, onApplyConvertedGrid, fillIndexForConvert]);

  // Reinitialize all image state when the load key changes (new pattern loaded from DB).
  useEffect(() => {
    if (!imageSettingsLoadKey) return;
    const doc = savedImageDocument ?? { images: [], activeImageId: null };
    const nextLayers = doc.images.map((img) => ({ ...img }));
    const nextActive = doc.activeImageId && nextLayers.some((l) => l.id === doc.activeImageId)
      ? doc.activeImageId
      : (nextLayers[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinitializes editor state when a new document loads
    setLayers(nextLayers);
    setActiveLayerId(nextActive);
    setLayerImages({});
    applyLayerToEditor(nextLayers.find((l) => l.id === nextActive) ?? null);

    // Prefetch all layer images for stacked underlays
    for (const layer of nextLayers) {
      if (!layer.imageDataUrl) continue;
      void loadImageFromDataUrl(layer.imageDataUrl)
        .then((img) => {
          setLayerImages((prev) => ({ ...prev, [layer.id]: img }));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSettingsLoadKey]);

  // Report current image document to parent for autosave.
  useEffect(() => {
    if (suppressReportRef.current) return;
    onImageDocumentChange?.(buildDocument());
  }, [mode, imageDataUrl, underlayOpacityPct, threshold, darkIsFilled, cropRect, appliedCrop, panX, panY, imageZoom, positionLocked, layers, activeLayerId, buildDocument, onImageDocumentChange]);

  const selectLayer = useCallback((id: string) => {
    if (id === activeLayerId) return;
    const flushed = layers.map((layer) =>
      layer.id === activeLayerId ? { ...layer, ...currentSettings() } : layer,
    );
    setLayers(flushed);
    setActiveLayerId(id);
    applyLayerToEditor(flushed.find((l) => l.id === id) ?? null);
  }, [activeLayerId, layers, currentSettings, applyLayerToEditor]);

  const layersRef = useRef(layers);
  const activeLayerIdRef = useRef(activeLayerId);
  const selectLayerRef = useRef(selectLayer);
  const applyLayerToEditorRef = useRef(applyLayerToEditor);
  layersRef.current = layers;
  activeLayerIdRef.current = activeLayerId;
  selectLayerRef.current = selectLayer;
  applyLayerToEditorRef.current = applyLayerToEditor;

  // Import panel remounts the crop canvas. Select the top image and restore its settings.
  useLayoutEffect(() => {
    if (!sidePanelTarget) return;
    const top = layersRef.current[0];
    if (!top) return;
    if (top.id !== activeLayerIdRef.current) {
      selectLayerRef.current(top.id);
    } else {
      applyLayerToEditorRef.current(top);
    }
  }, [sidePanelTarget]);

  const removeActiveLayer = useCallback(() => {
    if (!activeLayerId) return;
    const remaining = layers.filter((l) => l.id !== activeLayerId);
    setLayers(remaining);
    setLayerImages((prev) => {
      const next = { ...prev };
      delete next[activeLayerId];
      return next;
    });
    const nextActive = remaining[remaining.length - 1]?.id ?? null;
    setActiveLayerId(nextActive);
    applyLayerToEditor(remaining.find((l) => l.id === nextActive) ?? null);
    if (fileRef.current) fileRef.current.value = "";
    setStatus(null);
  }, [activeLayerId, layers, applyLayerToEditor]);

  const toggleLayerVisible = useCallback((id: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  }, []);

  const commitRename = useCallback((id: string, raw: string, fallbackIndex: number) => {
    const trimmed = raw.trim();
    const nextName = trimmed || defaultImageLayerName(fallbackIndex);
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name: nextName } : l)));
    setRenamingId(null);
    setRenameDraft("");
  }, []);

  const startRename = useCallback((layer: PatternImageLayer) => {
    setRenamingId(layer.id);
    setRenameDraft(layer.name);
    selectLayer(layer.id);
  }, [selectLayer]);

  const reorderLayers = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setLayers((prev) => {
      const from = prev.findIndex((l) => l.id === fromId);
      const to = prev.findIndex((l) => l.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleGridFullscreenChange = useCallback((fs: boolean) => {
    setGridFullscreen(fs);
    onGridFullscreenChange?.(fs);
  }, [onGridFullscreenChange]);

  const clearImage = useCallback(() => {
    removeActiveLayer();
  }, [removeActiveLayer]);

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
        const dataUrl = await compressImageToDataUrl(img);
        const flushed = layers.map((layer) =>
          layer.id === activeLayerId ? { ...layer, ...currentSettings() } : layer,
        );
        const newLayer = createImageLayer({
          mode: "underlay",
          imageDataUrl: dataUrl,
          threshold: otsuThreshold(img),
          name: defaultImageLayerName(flushed.length),
        });
        const nextLayers = [...flushed, newLayer];
        setLayers(nextLayers);
        setActiveLayerId(newLayer.id);
        setLayerImages((prev) => ({ ...prev, [newLayer.id]: img }));
        skipImageResetRef.current = true;
        setImage(img);
        setWorkingImage(img);
        setImageDataUrl(dataUrl);
        setMode("underlay");
        setThreshold(otsuThreshold(img));
        setUnderlayOpacityPct(65);
        setDarkIsFilled(true);
        setCropRect(FULL_CROP);
        setAppliedCrop(null);
        setPanX(0);
        setPanY(0);
        setImageZoom(1);
        setPositionLocked(false);
        setCropViewZoom(1);
        onImageLoad?.(img.naturalWidth, img.naturalHeight);
        const dims = bestFitDimensions(img, 1.0);
        onBestFitGrid?.(dims.w, dims.h);
      } catch {
        setStatus("Could not load that image.");
      }
    },
    [onBestFitGrid, onImageLoad, layers, activeLayerId, currentSettings],
  );

  const handleTransform = useCallback(
    async (type: TransformType) => {
      if (!workingImage) return;
      const newImg = await applyTransform(workingImage, type);
      const dataUrl = await compressImageToDataUrl(newImg);
      setWorkingImage(newImg);
      setImageDataUrl(dataUrl);
      if (activeLayerId) {
        setLayerImages((prev) => ({ ...prev, [activeLayerId]: newImg }));
      }
    },
    [workingImage, activeLayerId],
  );

  const applyConversion = useCallback(() => {
    if (!workingImage) {
      setStatus("Upload an image first.");
      return;
    }
    const next = booleanGridToCells(
      imageToThresholdGrid(
        workingImage, gridWidth, gridHeight,
        threshold, darkIsFilled, appliedCrop, panX / 100, panY / 100, imageZoom,
      ),
      fillIndexForConvert,
    );
    onApplyConvertedGrid(next);
    setStatus("Applied. You can edit or undo.");
  }, [workingImage, gridWidth, gridHeight, threshold, darkIsFilled, appliedCrop, panX, panY, imageZoom, onApplyConvertedGrid, fillIndexForConvert]);

  const applyCrop = useCallback(() => {
    setAppliedCrop({ ...cropRect });
    if (mode === "convert" && workingImage) {
      const next = booleanGridToCells(
        imageToThresholdGrid(
          workingImage, gridWidth, gridHeight,
          thresholdRef.current, darkIsFilledRef.current,
          cropRect, panXRef.current / 100, panYRef.current / 100, imageZoom,
        ),
        fillIndexForConvert,
      );
      onApplyConvertedGrid(next);
      setStatus("Applied.");
    } else {
      setStatus(null);
    }
  }, [cropRect, mode, workingImage, gridWidth, gridHeight, imageZoom, onApplyConvertedGrid, fillIndexForConvert]);

  const closeCropCard = useCallback(() => {
    applyCrop();
    setCropExpanded(false);
  }, [applyCrop]);

  useEffect(() => {
    if (sidePanelTarget || !cropExpanded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-applies the pending crop when the side panel is closed
    applyCrop();
    setCropExpanded(false);
  }, [sidePanelTarget, cropExpanded, applyCrop]);

  const resetCrop = useCallback(() => {
    setCropRect(FULL_CROP);
    setAppliedCrop(null);
    setPanX(0);
    setPanY(0);
    setImageZoom(1);
    setCropViewZoom(1);
  }, []);

  useEffect(() => {
    if (!cropExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeCropCard();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [cropExpanded, closeCropCard]);

  const onCropPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!workingImage || positionLocked) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasW = rect.width;
      const canvasH = rect.height;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { fitX, fitY, fitW, fitH } = getImageTransformLayout(
        workingImage.naturalWidth,
        workingImage.naturalHeight,
        canvasW,
        canvasH,
        null,
        0,
        0,
        cropViewZoom,
      );
      const handle = hitTestHandles(px, py, cropRect, fitX, fitY, fitW, fitH);
      if (!handle) return;
      cropDragRef.current = {
        handle,
        startCanvasX: px,
        startCanvasY: py,
        startCrop: { ...cropRect },
        startPanX: 0,
        startPanY: 0,
        fitX,
        fitY,
        fitW,
        fitH,
      };
      setIsDragging(true);
      setDragHandle(handle);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [workingImage, positionLocked, cropRect, cropViewZoom],
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
        const drag = cropDragRef.current;
        setCropRect(
          applyHandleDrag(
            drag.handle,
            drag.startCrop,
            px - drag.startCanvasX,
            py - drag.startCanvasY,
            drag.fitW,
            drag.fitH,
          ),
        );
        return;
      }

      const { fitX, fitY, fitW, fitH } = getImageTransformLayout(
        workingImage.naturalWidth,
        workingImage.naturalHeight,
        canvasW,
        canvasH,
        null,
        0,
        0,
        cropViewZoom,
      );
      setHoverHandle(hitTestHandles(px, py, cropRect, fitX, fitY, fitW, fitH));
    },
    [workingImage, cropRect, cropViewZoom],
  );

  const onCropPointerUp = useCallback(() => {
    cropDragRef.current = null;
    setIsDragging(false);
    setDragHandle(null);
  }, []);

  const attachCropWheel = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return () => {};
    const handler = (e: WheelEvent) => {
      if (positionLocked) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setCropViewZoom((z) => Math.min(4, Math.max(0.5, Math.round((z + delta) * 10) / 10)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [positionLocked]);

  useEffect(() => {
    if (!workingImage) return;
    const cleanA = attachCropWheel(cropCanvasRef.current);
    const cleanB = attachCropWheel(expandedCropCanvasRef.current);
    return () => {
      cleanA();
      cleanB();
    };
  }, [workingImage, cropExpanded, expandedSize, attachCropWheel]);

  useEffect(() => {
    const els = [cropCanvasRef.current, expandedCropCanvasRef.current].filter(
      (el): el is HTMLCanvasElement => Boolean(el),
    );
    if (!workingImage || els.length === 0) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          dist: Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          ),
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current || positionLocked) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = dist / pinchRef.current.dist;
      pinchRef.current = { dist };
      setCropViewZoom((z) => Math.min(4, Math.max(0.5, Math.round(z * ratio * 10) / 10)));
    };
    const onTouchEnd = () => { pinchRef.current = null; };

    for (const el of els) {
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      el.addEventListener("touchend", onTouchEnd);
    }
    return () => {
      for (const el of els) {
        el.removeEventListener("touchstart", onTouchStart);
        el.removeEventListener("touchmove", onTouchMove);
        el.removeEventListener("touchend", onTouchEnd);
      }
    };
  }, [workingImage, positionLocked, cropExpanded, expandedSize]);

  const stackedUnderlays = useMemo((): GridUnderlayLayer[] => {
    const docLayers = layers.map((layer) =>
      layer.id === activeLayerId
        ? { ...layer, ...currentSettings() }
        : layer,
    );
    const result: GridUnderlayLayer[] = [];
    for (const layer of docLayers) {
      if (!layer.visible || layer.mode !== "underlay" || !layer.imageDataUrl) continue;
      const img =
        layer.id === activeLayerId && workingImage
          ? workingImage
          : layerImages[layer.id];
      if (!img) continue;
      result.push({
        image: img,
        opacity: Math.min(100, Math.max(0, layer.underlayOpacityPct)) / 100,
        crop: layer.appliedCrop,
        panX: layer.panX / 100,
        panY: layer.panY / 100,
        zoom: layer.imageZoom,
      });
    }
    return result;
  }, [layers, activeLayerId, currentSettings, workingImage, layerImages]);

  // Keep active layer image map in sync when working pixels change (e.g. transform).
  useEffect(() => {
    if (!activeLayerId || !workingImage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the layer image cache with the active layer's pixels
    setLayerImages((prev) =>
      prev[activeLayerId] === workingImage ? prev : { ...prev, [activeLayerId]: workingImage },
    );
  }, [activeLayerId, workingImage]);

  const cropCursor = getCropCursor(isDragging ? dragHandle : hoverHandle);

  const sliderRow = (
    label: string,
    value: number,
    display: string,
    props: {
      min: number;
      max: number;
      step?: number;
      disabled?: boolean;
      onChange: (n: number) => void;
      onReset?: () => void;
      showReset?: boolean;
    },
  ) => (
    <div className="flex items-center gap-2 border-b py-2" style={{ borderColor: "var(--print-ink-faint)" }}>
      <span className="w-16 shrink-0 font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">
        {label}
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="min-w-0 flex-1 disabled:opacity-40"
      />
      <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums punch-print-faint">
        {display}
      </span>
      {props.showReset && props.onReset ? (
        <button
          type="button"
          onClick={props.onReset}
          className="font-mono text-[9px] font-bold uppercase punch-print-faint hover:opacity-70"
          title="Reset"
        >
          Reset
        </button>
      ) : (
        <span className="w-8" aria-hidden />
      )}
    </div>
  );

  const controlsPanel = !gridFullscreen ? (
    <div className="relative z-30 flex shrink-0 flex-col gap-5 overflow-y-auto p-0">
      <div className="border-b pb-4" style={{ borderColor: "var(--print-ink-faint)" }}>
        <div className="flex flex-wrap items-center gap-3">
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
            className="cursor-pointer font-mono text-[11px] font-bold tracking-[0.08em] uppercase punch-print-ink hover:underline hover:decoration-[var(--print-ink)]/40 hover:underline-offset-2 hover:opacity-70"
          >
            {layers.length > 0 ? "Add image…" : "Upload…"}
          </label>
          {workingImage ? (
            <button
              type="button"
              onClick={clearImage}
              className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase punch-print-faint hover:underline hover:decoration-[var(--print-ink-faint)] hover:opacity-70"
            >
              Remove
            </button>
          ) : null}
        </div>
        {layers.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">
              Images
            </p>
            {layers.map((layer, index) => (
              <div
                key={layer.id}
                draggable={renamingId !== layer.id}
                onDragStart={(e) => {
                  setDragId(layer.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", layer.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDragOverId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverId !== layer.id) setDragOverId(layer.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === layer.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = e.dataTransfer.getData("text/plain") || dragId;
                  if (fromId) reorderLayers(fromId, layer.id);
                  setDragId(null);
                  setDragOverId(null);
                }}
                className={`flex items-center gap-2 py-0.5 ${
                  dragOverId === layer.id && dragId !== layer.id
                    ? "border-t border-[var(--print-ink)]"
                    : ""
                } ${dragId === layer.id ? "opacity-50" : ""}`}
              >
                <span
                  className="shrink-0 cursor-grab select-none font-mono text-[10px] punch-print-faint active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-hidden
                >
                  ⋮⋮
                </span>
                {renamingId === layer.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => commitRename(layer.id, renameDraft, index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(layer.id, renameDraft, index);
                      } else if (e.key === "Escape") {
                        setRenamingId(null);
                        setRenameDraft("");
                      }
                    }}
                    className="min-w-0 flex-1 border-b border-[var(--print-ink)] bg-transparent font-mono text-[11px] font-bold tracking-[0.06em] uppercase punch-print-ink focus:outline-none"
                    aria-label="Rename image"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => selectLayer(layer.id)}
                    onDoubleClick={() => startRename(layer)}
                    title="Double-click to rename"
                    className={`min-w-0 flex-1 truncate text-left font-mono text-[11px] font-bold tracking-[0.06em] uppercase ${
                      layer.id === activeLayerId ? "punch-print-ink" : "punch-print-faint hover:opacity-70"
                    }`}
                  >
                    {layer.name || defaultImageLayerName(index)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleLayerVisible(layer.id)}
                  className="font-mono text-[9px] font-bold uppercase punch-print-faint hover:opacity-70"
                  title={layer.visible ? "Hide" : "Show"}
                >
                  {layer.visible ? "Hide" : "Show"}
                </button>
              </div>
            ))}
            <p className="mt-1 font-mono text-[9px] leading-relaxed punch-print-faint">
              Drag to change which sits on top. Double-click a name to rename.
            </p>
          </div>
        ) : null}
      </div>

      {workingImage ? (
        <div className="flex flex-col gap-3 border-b pb-4" style={{ borderColor: "var(--print-ink-faint)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">
              Crop
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCropExpanded(true)}
                className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-faint hover:underline hover:underline-offset-2 hover:opacity-70"
              >
                Expand
              </button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={positionLocked}
                className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-ink hover:underline hover:underline-offset-2 hover:opacity-70 disabled:opacity-40"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={resetCrop}
                disabled={positionLocked}
                className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-faint hover:underline hover:underline-offset-2 hover:opacity-70 disabled:opacity-40"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setPositionLocked((p) => !p)}
                title={positionLocked ? "Unlock position" : "Lock position"}
                className={`font-mono text-[10px] font-bold tracking-[0.08em] uppercase hover:underline hover:underline-offset-2 hover:opacity-70 ${
                  positionLocked ? "punch-print-ink" : "punch-print-faint"
                }`}
              >
                {positionLocked ? "Locked" : "Lock"}
              </button>
            </div>
          </div>
          {!cropExpanded && (
            <CropCanvas
              canvasRef={cropCanvasRef}
              w={PREVIEW_W}
              h={PREVIEW_H}
              positionLocked={positionLocked}
              cropCursor={cropCursor}
              onPointerDown={onCropPointerDown}
              onPointerMove={onCropPointerMove}
              onPointerUp={onCropPointerUp}
            />
          )}
          <div className="flex flex-col">
            {sliderRow("Zoom", Math.round(imageZoom * 100), `${Math.round(imageZoom * 100)}%`, {
              min: 50,
              max: 400,
              step: 1,
              disabled: positionLocked,
              onChange: (n) => setImageZoom(n / 100),
              onReset: () => setImageZoom(1),
              showReset: imageZoom !== 1 && !positionLocked,
            })}
            {sliderRow("X offset", panX, panX > 0 ? `+${panX}%` : `${panX}%`, {
              min: -50,
              max: 50,
              step: 1,
              disabled: positionLocked,
              onChange: setPanX,
              onReset: () => setPanX(0),
              showReset: panX !== 0 && !positionLocked,
            })}
            {sliderRow("Y offset", panY, panY > 0 ? `+${panY}%` : `${panY}%`, {
              min: -50,
              max: 50,
              step: 1,
              disabled: positionLocked,
              onChange: setPanY,
              onReset: () => setPanY(0),
              showReset: panY !== 0 && !positionLocked,
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">
              Transform
            </span>
            {(["flipH", "flipV", "rotateLeft", "rotateRight"] as TransformType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => void handleTransform(type)}
                disabled={positionLocked}
                className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase punch-print-faint hover:underline hover:underline-offset-2 hover:opacity-70 disabled:opacity-40"
              >
                {type === "flipH" ? "Flip H" : type === "flipV" ? "Flip V" : type === "rotateLeft" ? "↺ 90°" : "↻ 90°"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {workingImage ? (
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">
            Use
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Image use mode">
            {(
              [
                ["underlay", "Reference"],
                ["convert", "Auto-convert"],
              ] as const
            ).map(([m, label], i) => (
              <span key={m} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="font-mono text-[10px] punch-print-faint" aria-hidden>
                    ·
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-opacity hover:underline hover:underline-offset-4 hover:opacity-80 ${
                    mode === m ? "punch-print-ink" : "punch-print-faint"
                  }`}
                >
                  {label}
                </button>
              </span>
            ))}
          </div>

          {mode === "underlay" ? (
            <div className="flex flex-col gap-2 pt-1">
              <p className="font-mono text-[9px] leading-relaxed punch-print-faint">
                Shows behind the grid so you can trace.
              </p>
              {sliderRow("Opacity", underlayOpacityPct, `${underlayOpacityPct}%`, {
                min: 0,
                max: 100,
                step: 1,
                onChange: setUnderlayOpacityPct,
              })}
            </div>
          ) : null}

          {mode === "convert" ? (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold tracking-[0.12em] uppercase punch-print-ink">
                  Threshold
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={darkIsFilled}
                    onClick={() => setDarkIsFilled(true)}
                    className={`font-mono text-[10px] font-bold tracking-[0.08em] uppercase hover:underline hover:underline-offset-2 hover:opacity-70 ${
                      darkIsFilled ? "punch-print-ink" : "punch-print-faint"
                    }`}
                  >
                    Dark fills
                  </button>
                  <span className="font-mono text-[10px] punch-print-faint" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    aria-pressed={!darkIsFilled}
                    onClick={() => setDarkIsFilled(false)}
                    className={`font-mono text-[10px] font-bold tracking-[0.08em] uppercase hover:underline hover:underline-offset-2 hover:opacity-70 ${
                      !darkIsFilled ? "punch-print-ink" : "punch-print-faint"
                    }`}
                  >
                    Light fills
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (workingImage) setThreshold(otsuThreshold(workingImage)); }}
                    className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-faint hover:underline hover:underline-offset-2 hover:opacity-70"
                  >
                    Suggest
                  </button>
                </div>
              </div>
              {sliderRow("Level", threshold, String(threshold), {
                min: 0,
                max: 255,
                step: 1,
                onChange: setThreshold,
              })}
              <button
                type="button"
                onClick={applyConversion}
                className="mt-1 font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-ink hover:underline hover:underline-offset-2 hover:opacity-70"
              >
                Apply
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {status ? (
        <p className="font-mono text-[11px] punch-print-ink">{status}</p>
      ) : null}
    </div>
  ) : null;

  return (
      <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
      {sidePanelTarget && controlsPanel && createPortal(controlsPanel, sidePanelTarget)}

      {cropExpanded &&
        workingImage &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-recess/70"
              aria-label="Close crop"
              onClick={closeCropCard}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Crop image"
              onPointerDown={(e) => e.stopPropagation()}
              className="punch-card relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden px-6 py-5"
              style={{
                ["--manila-stock" as string]: manilaHex(DEFAULT_MANILA_STOCK),
                background: manilaHex(DEFAULT_MANILA_STOCK),
              }}
            >
              <OperatorCardHeader className="shrink-0" title="Crop card" colLabel="JOB CROP" />
              <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={applyCrop}
                  disabled={positionLocked}
                  className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-ink hover:underline hover:underline-offset-2 hover:opacity-70 disabled:opacity-40"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={resetCrop}
                  disabled={positionLocked}
                  className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-faint hover:underline hover:underline-offset-2 hover:opacity-70 disabled:opacity-40"
                >
                  Reset
                </button>
              </div>
              <div className="mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                <CropCanvas
                  canvasRef={expandedCropCanvasRef}
                  w={expandedSize.w}
                  h={expandedSize.h}
                  positionLocked={positionLocked}
                  cropCursor={cropCursor}
                  onPointerDown={onCropPointerDown}
                  onPointerMove={onCropPointerMove}
                  onPointerUp={onCropPointerUp}
                />
              </div>
              <div className="mt-auto flex shrink-0 items-center justify-end pt-4">
                <button
                  type="button"
                  onClick={closeCropCard}
                  className="punch-print text-[11px] opacity-70"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div className="relative z-0 flex min-h-0 flex-1 flex-col">
        <GridCanvas
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          cells={cells}
          onCommit={onCommit}
          palette={palette}
          brushInk={brushInk}
          underlays={stackedUnderlays}
          rowComplete={progress?.rowComplete}
          currentRow={progress?.currentRow}
          onToggleRowComplete={onToggleRowComplete}
          trackMode={trackMode}
          mirrorView={mirrorView}
          onFullscreenChange={handleGridFullscreenChange}
          editLocked={editLocked}
          paperColor={paperColor}
          hideFullscreenEntry={hideFullscreenEntry}
          enterFullscreenRef={enterFullscreenRef}
          zoomApiRef={zoomApiRef}
          className="min-h-0"
        />
      </div>
    </div>
  );
}
