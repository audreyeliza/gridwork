"use client";

import {
  cloneGrid,
  DEFAULT_HOLE_INK,
  DEFAULT_PALETTE,
  isCellFilled,
  type CellGrid,
  type CellValue,
} from "@/lib/gridFormat";
import {
  computeGridCanvasLayout,
  LABEL_SIZE,
  ROW_TRACKER_SIDEBAR_PX,
  type GridCanvasLayout,
} from "@/lib/gridCanvasLayout";
import {
  crochetRowLabel,
  dataRowForTrack,
  diagonalAnchor,
  type TrackMode,
} from "@/lib/progressData";
import { drawImageWithTransform, type CropRect } from "@/lib/imageCanvasUtils";
import { contrastManilaHexFromPaper, hexWithAlpha } from "@/lib/manilaStock";
import { clamp } from "@/lib/mathUtils";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

export type GridUnderlayLayer = {
  image: CanvasImageSource;
  /** 0–1 */
  opacity: number;
  crop?: CropRect | null;
  panX?: number;
  panY?: number;
  zoom?: number;
};

/** Active brush: palette index, or `null` for erase. */
export type InkBrush = number | null;

export type GridCanvasProps = {
  gridWidth: number;
  gridHeight: number;
  cells: CellGrid;
  onCommit: (next: CellGrid) => void;
  /** Palette hex colors for filled cells. */
  palette?: string[];
  /**
   * Active ink well index, or `null` to erase.
   * When set, paint uses that index (clicking a cell already that color clears it).
   */
  brushInk?: InkBrush;
  className?: string;
  /** Multiple reference underlays drawn behind the grid (bottom → top). */
  underlays?: GridUnderlayLayer[];
  /** When set with opacity &gt; 0, image is drawn behind the grid and empty cells stay transparent. */
  underlayImage?: CanvasImageSource | null;
  /** 0–1; defaults to 1 when an image is present. */
  underlayOpacity?: number;
  /** Optional crop region in image-normalized (0–1) coords. */
  underlayCrop?: CropRect | null;
  /** Horizontal pan offset, grid-relative (−0.5–0.5). */
  underlayPanX?: number;
  /** Vertical pan offset, grid-relative (−0.5–0.5). */
  underlayPanY?: number;
  /** Image scale within the grid (0.5–4). */
  underlayZoom?: number;
  /** Row completion + current row highlight; length must match track length when provided. */
  rowComplete?: boolean[];
  currentRow?: number;
  onToggleRowComplete?: (row: number) => void;
  /** Row = horizontal band (from top); col = vertical; diag = C2C-style r+c diagonal. */
  trackMode?: TrackMode;
  /** View-only horizontal mirror so turned work matches the chart. */
  mirrorView?: boolean;
  /** Manila card stock fill for empty cells / paper. */
  paperColor?: string;
  /** Called when fullscreen state toggles. */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Hide the in-toolbar Fullscreen entry (controls bar owns it). */
  hideFullscreenEntry?: boolean;
  /** Parent can call this to enter fullscreen. */
  enterFullscreenRef?: MutableRefObject<(() => void) | null>;
  /** Parent control bar can call fit / zoom in / zoom out. */
  zoomApiRef?: MutableRefObject<{ fit: () => void; zoomIn: () => void; zoomOut: () => void } | null>;
  /** When true, grid cells cannot be painted. */
  editLocked?: boolean;
};

function fillMarginsOutsideGrid(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  bg: string,
  layout: GridCanvasLayout,
): void {
  const { topGutter, leftGutter, offsetX, offsetY, gridWpx, gridHpx, areaW, areaH } = layout;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, topGutter);
  ctx.fillRect(0, topGutter, leftGutter, cssH - topGutter);
  const x0 = leftGutter;
  const y0 = topGutter;
  const x1 = leftGutter + areaW;
  const y1 = topGutter + areaH;
  const gx0 = offsetX;
  const gy0 = offsetY;
  const gx1 = offsetX + gridWpx;
  const gy1 = offsetY + gridHpx;
  if (gy0 > y0) ctx.fillRect(x0, y0, areaW, gy0 - y0);
  if (gy1 < y1) ctx.fillRect(x0, gy1, areaW, y1 - gy1);
  if (gx0 > x0) ctx.fillRect(x0, gy0, gx0 - x0, gridHpx);
  if (gx1 < x1) ctx.fillRect(gx1, gy0, x1 - gx1, gridHpx);
  if (gy1 < cssH) ctx.fillRect(0, gy1, cssW, cssH - gy1);
  if (gx1 < cssW) ctx.fillRect(gx1, 0, cssW - gx1, cssH);
}

function paintLine(
  grid: CellGrid,
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  value: CellValue,
): void {
  let x0 = c0;
  let y0 = r0;
  const x1 = c1;
  const y1 = r1;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const h = grid.length;
  const w = h > 0 ? (grid[0]?.length ?? 0) : 0;

  for (;;) {
    if (y0 >= 0 && y0 < h && x0 >= 0 && x0 < w) {
      grid[y0][x0] = value;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Returns the label step: show label at index `i` when `i % step === 0` (plus always show the last). */
function labelStep(cellPx: number): number {
  if (cellPx >= 16) return 1;
  if (cellPx >= 10) return 2;
  if (cellPx >= 6) return 5;
  return 10;
}

function TrackCheckMark({
  done,
  label,
  ariaLabel,
  onToggle,
}: {
  done: boolean;
  label: string;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex h-full w-full cursor-pointer items-center justify-center gap-0.5">
      <input type="checkbox" checked={done} onChange={onToggle} className="sr-only" aria-label={ariaLabel} />
      <span
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{
          width: 18,
          height: 18,
          borderRadius: 2,
          border: done ? "2px solid #0A0A0A" : "2px solid rgba(10,10,10,0.45)",
          background: "transparent",
        }}
      >
        {done && (
          <svg viewBox="0 0 12 10" width="12" height="10" fill="none" stroke="#0A0A0A" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 5l3 3 6-6" />
          </svg>
        )}
      </span>
      <span
        className={`min-w-[1.1rem] text-center font-mono text-[11px] font-bold tabular-nums ${
          done ? "line-through text-black/55" : "text-black"
        }`}
      >
        {label}
      </span>
    </label>
  );
}

export function GridCanvas({
  gridWidth,
  gridHeight,
  cells,
  onCommit,
  palette = DEFAULT_PALETTE,
  brushInk = 0,
  className,
  underlays,
  underlayImage,
  underlayOpacity = 1,
  underlayCrop = null,
  underlayPanX = 0,
  underlayPanY = 0,
  underlayZoom = 1,
  rowComplete,
  currentRow = 0,
  onToggleRowComplete,
  trackMode = "row",
  mirrorView = false,
  onFullscreenChange,
  hideFullscreenEntry = false,
  enterFullscreenRef,
  zoomApiRef,
  editLocked = false,
  paperColor = "#E8E2D0",
}: GridCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fullscreen, setFullscreen] = useState(false);
  /** Container size — used at fit zoom only. */
  const [containerSize, setContainerSize] = useState({ cssW: 400, cssH: 400 });
  const [layoutState, setLayoutState] = useState<GridCanvasLayout | null>(null);

  const draftRef = useRef<CellGrid | null>(null);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null);
  const drawingRef = useRef(false);
  const brushRef = useRef<CellValue>(0);
  const rafRef = useRef(0);
  const paletteRef = useRef(palette);
  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  const resolvedUnderlays = useMemo((): GridUnderlayLayer[] => {
    if (underlays && underlays.length > 0) {
      return underlays.filter((u) => u.image && clamp(u.opacity, 0, 1) > 0);
    }
    const opacity = clamp(underlayOpacity, 0, 1);
    if (underlayImage && opacity > 0) {
      return [
        {
          image: underlayImage,
          opacity,
          crop: underlayCrop,
          panX: underlayPanX,
          panY: underlayPanY,
          zoom: underlayZoom,
        },
      ];
    }
    return [];
  }, [underlays, underlayImage, underlayOpacity, underlayCrop, underlayPanX, underlayPanY, underlayZoom]);

  const showUnderlay = resolvedUnderlays.length > 0;

  const showTrackHighlight =
    Boolean(onToggleRowComplete) &&
    Array.isArray(rowComplete) &&
    (trackMode === "row"
      ? rowComplete.length === gridHeight
      : trackMode === "col"
        ? rowComplete.length === gridWidth
        : rowComplete.length === gridWidth + gridHeight - 1);

  const showRowTracker = showTrackHighlight;
  const rowSidebarPx = showRowTracker && (trackMode === "row" || trackMode === "diag") ? ROW_TRACKER_SIDEBAR_PX : 0;
  const colSidebarPx = showRowTracker && trackMode === "col" ? ROW_TRACKER_SIDEBAR_PX : 0;
  const bottomSidebarPx = showRowTracker && trackMode === "diag" ? ROW_TRACKER_SIDEBAR_PX : 0;

  const layoutOpts = useMemo(
    () =>
      showRowTracker
        ? { rowSidebarPx, colSidebarPx, bottomSidebarPx }
        : undefined,
    [showRowTracker, rowSidebarPx, colSidebarPx, bottomSidebarPx],
  );

  const leftGutter = LABEL_SIZE + rowSidebarPx;
  const topGutterFit = LABEL_SIZE + colSidebarPx;

  const visualCol = useCallback(
    (c: number) => (mirrorView ? gridWidth - 1 - c : c),
    [mirrorView, gridWidth],
  );

  /**
   * Fit: columns fill container width; canvas may scroll vertically.
   * 100% / 200%: scale relative to width-fit cell; above 100% the canvas grows so you can scroll/zoom in.
   */
  const zoomMetrics = useMemo(() => {
    const widthFitCell = Math.max(
      4,
      Math.floor((containerSize.cssW - leftGutter) / Math.max(1, gridWidth)),
    );
    if (zoom === "fit") {
      return {
        cell: widthFitCell,
        canvasCssW: containerSize.cssW,
        canvasCssH: topGutterFit + widthFitCell * gridHeight + bottomSidebarPx,
      };
    }
    const cell = Math.max(4, Math.round(widthFitCell * (zoom / 100)));
    return {
      cell,
      canvasCssW: leftGutter + gridWidth * cell,
      canvasCssH: topGutterFit + gridHeight * cell + bottomSidebarPx,
    };
  }, [containerSize, zoom, gridWidth, gridHeight, leftGutter, topGutterFit, bottomSidebarPx]);

  const { cell: effectiveCell, canvasCssW, canvasCssH } = zoomMetrics;

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvasCssW;
      const cssH = canvasCssH;
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const opts = { ...(layoutOpts ?? {}), forcedCell: effectiveCell };
      const layout = computeGridCanvasLayout(cssW, cssH, gridWidth, gridHeight, opts);
      queueMicrotask(() => setLayoutState(layout));
      const { offsetX, offsetY, gridWpx, gridHpx, cell } = layout;

      const data = draftRef.current ?? cells;

      const bg = paperColor;
      const line = `color-mix(in srgb, ${paperColor} 92%, #8B3A2A 8%)`;
      const labelColor = "#0A0A0A";
      const colors = paletteRef.current.length > 0 ? paletteRef.current : DEFAULT_PALETTE;

      if (showUnderlay) {
        ctx.clearRect(0, 0, cssW, cssH);
        fillMarginsOutsideGrid(ctx, cssW, cssH, bg, layout);
        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, offsetY, gridWpx, gridHpx);
        ctx.clip();
        for (const layer of resolvedUnderlays) {
          const layerOpacity = clamp(layer.opacity, 0, 1);
          if (layerOpacity <= 0) continue;
          ctx.globalAlpha = layerOpacity;
          drawImageWithTransform(
            ctx,
            layer.image,
            offsetX,
            offsetY,
            gridWpx,
            gridHpx,
            layer.crop ?? null,
            layer.panX ?? 0,
            layer.panY ?? 0,
            layer.zoom ?? 1,
          );
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const step = labelStep(cell);

      for (let c = 0; c < gridWidth; c++) {
        if (c % step !== 0 && c !== gridWidth - 1) continue;
        const x = offsetX + visualCol(c) * cell + cell / 2;
        ctx.fillText(String(c + 1), x, LABEL_SIZE / 2);
      }
      if (trackMode !== "row" && trackMode !== "diag") {
        for (let r = 0; r < gridHeight; r++) {
          if (r % step !== 0 && r !== gridHeight - 1) continue;
          const y = offsetY + r * cell + cell / 2;
          ctx.fillText(String(crochetRowLabel(r, gridHeight)), LABEL_SIZE / 2, y);
        }
      }

      for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
          const x = offsetX + visualCol(c) * cell;
          const y = offsetY + r * cell;
          const value = data[r]?.[c];
          if (isCellFilled(value)) {
            ctx.fillStyle = colors[value!] ?? DEFAULT_HOLE_INK;
            ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          } else if (!showUnderlay) {
            ctx.fillStyle = bg;
            ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          }
          ctx.strokeStyle = line;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
      }

      const tint = hexWithAlpha(contrastManilaHexFromPaper(paperColor || "#E8E2D0"), 0.55);
      const cr = showTrackHighlight ? currentRow : -1;
      if (trackMode === "row" && cr >= 0 && cr < gridHeight) {
        const dataRow = dataRowForTrack(cr, gridHeight);
        const hx = 0;
        const hy = offsetY + dataRow * cell;
        const hw = offsetX + gridWpx;
        ctx.fillStyle = tint;
        ctx.fillRect(hx, hy, hw, cell);
      } else if (trackMode === "col" && cr >= 0 && cr < gridWidth) {
        const hx = offsetX + visualCol(cr) * cell;
        ctx.fillStyle = tint;
        ctx.fillRect(hx, offsetY, cell, gridHpx);
      } else if (trackMode === "diag" && cr >= 0) {
        ctx.fillStyle = tint;
        for (let r = 0; r < gridHeight; r++) {
          const c = cr - r;
          if (c < 0 || c >= gridWidth) continue;
          const x = offsetX + visualCol(c) * cell;
          const y = offsetY + r * cell;
          ctx.fillRect(x, y, cell, cell);
        }
      }
    });
  }, [
    cells,
    gridWidth,
    gridHeight,
    canvasCssW,
    canvasCssH,
    effectiveCell,
    showUnderlay,
    resolvedUnderlays,
    showTrackHighlight,
    currentRow,
    trackMode,
    layoutOpts,
    paperColor,
    visualCol,
  ]);

  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setContainerSize({ cssW: cr.width, cssH: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    onFullscreenChange?.(fullscreen);
    document.body.classList.toggle("gridwork-grid-fullscreen", fullscreen);
    if (fullscreen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets zoom to fit each time fullscreen is entered
      setZoom("fit");
    }
    return () => {
      document.body.classList.remove("gridwork-grid-fullscreen");
    };
  }, [fullscreen, onFullscreenChange]);

  useEffect(() => {
    if (!enterFullscreenRef) return;
    enterFullscreenRef.current = () => setFullscreen((v) => !v);
    return () => {
      enterFullscreenRef.current = null;
    };
  }, [enterFullscreenRef]);

  useEffect(() => {
    if (!zoomApiRef) return;
    zoomApiRef.current = {
      fit: () => setZoom("fit"),
      zoomIn: () => setZoom((z) => Math.min(200, (z === "fit" ? 100 : z) + 10)),
      zoomOut: () => setZoom((z) => Math.max(25, (z === "fit" ? 100 : z) - 10)),
    };
    return () => {
      zoomApiRef.current = null;
    };
  }, [zoomApiRef]);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // Auto-scroll the canvas container to keep the current track in view in follow mode
  useEffect(() => {
    if (!fullscreen || !wrapRef.current || !layoutState) return;
    const container = wrapRef.current;
      const { offsetY, cell } = layoutState;
    if (trackMode === "diag") {
      const d = currentRow;
      let minR = gridHeight;
      let maxR = -1;
      for (let r = 0; r < gridHeight; r++) {
        const c = d - r;
        if (c < 0 || c >= gridWidth) continue;
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
      }
      if (maxR < 0) return;
      const bandTop = offsetY + minR * cell;
      const bandBottom = offsetY + (maxR + 1) * cell;
      const { scrollTop, clientHeight } = container;
      if (bandTop < scrollTop) {
        container.scrollTo({ top: bandTop - 8, behavior: "smooth" });
      } else if (bandBottom > scrollTop + clientHeight) {
        container.scrollTo({ top: bandBottom - clientHeight + 8, behavior: "smooth" });
      }
      return;
    }
    if (trackMode === "col") {
      return;
    }
    const dataRow = dataRowForTrack(currentRow, gridHeight);
    const rowTop = offsetY + dataRow * cell;
    const rowBottom = rowTop + cell;
    const { scrollTop, clientHeight } = container;
    if (rowTop < scrollTop) {
      container.scrollTo({ top: rowTop - 8, behavior: "smooth" });
    } else if (rowBottom > scrollTop + clientHeight) {
      container.scrollTo({ top: rowBottom - clientHeight + 8, behavior: "smooth" });
    }
  }, [fullscreen, currentRow, layoutState, trackMode, gridWidth, gridHeight]);

  const clientToCell = useCallback(
    (clientX: number, clientY: number): { r: number; c: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const opts = { ...(layoutOpts ?? {}), forcedCell: effectiveCell };
      const layout = computeGridCanvasLayout(canvasCssW, canvasCssH, gridWidth, gridHeight, opts);
      const { cell: cellSize, offsetX, offsetY, gridWpx, gridHpx } = layout;
      const px = x - offsetX;
      const py = y - offsetY;
      if (px < 0 || py < 0) return null;
      const colRaw = Math.floor(px / cellSize);
      const row = Math.floor(py / cellSize);
      const col = mirrorView ? gridWidth - 1 - colRaw : colRaw;
      if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) return null;
      if (px >= gridWpx || py >= gridHpx) return null;
      return { r: row, c: col };
    },
    [gridWidth, gridHeight, canvasCssW, canvasCssH, effectiveCell, layoutOpts, mirrorView],
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current && !draftRef.current) return;
    drawingRef.current = false;
    lastCellRef.current = null;
    const d = draftRef.current;
    draftRef.current = null;
    if (d) onCommit(cloneGrid(d));
    scheduleDraw();
  }, [onCommit, scheduleDraw]);

  useEffect(() => {
    const end = () => endStroke();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [endStroke]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (editLocked) return;
    const hit = clientToCell(e.clientX, e.clientY);
    if (!hit) return;
    const current = cells[hit.r]?.[hit.c] ?? null;
    let brush: CellValue;
    if (brushInk === null) {
      brush = null;
    } else if (current === brushInk) {
      brush = null;
    } else {
      brush = brushInk;
    }
    brushRef.current = brush;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    draftRef.current = cloneGrid(cells);
    lastCellRef.current = hit;
    if (draftRef.current) {
      draftRef.current[hit.r]![hit.c] = brush;
    }
    scheduleDraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (editLocked || !drawingRef.current || !draftRef.current) return;
    const hit = clientToCell(e.clientX, e.clientY);
    if (!hit) return;
    const last = lastCellRef.current;
    const brush = brushRef.current;
    if (last && (last.r !== hit.r || last.c !== hit.c)) {
      paintLine(draftRef.current, last.r, last.c, hit.r, hit.c, brush);
    } else if (!last) {
      draftRef.current[hit.r][hit.c] = brush;
    }
    lastCellRef.current = hit;
    scheduleDraw();
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${className ?? ""}`}>
      {!hideFullscreenEntry && (
        <div className="relative z-40 flex shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="ml-auto rounded-full border border-stone-200 bg-white/90 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50"
          >
            {fullscreen ? "Exit follow" : "⛶ Fullscreen"}
          </button>
        </div>
      )}
      <div
        className="relative min-h-0 w-full flex-1 overflow-hidden"
        style={{
          backgroundColor: paperColor || "#E8E2D0",
          border: `1px solid color-mix(in srgb, ${paperColor || "#E8E2D0"} 92%, #8B3A2A 8%)`,
          transition: "background-color 0.35s ease, border-color 0.35s ease",
        }}
      >
        <div ref={wrapRef} className="absolute inset-0 overflow-auto">
          {showRowTracker && layoutState && rowComplete && onToggleRowComplete ? (
            <>
              {trackMode === "row"
                ? rowComplete.map((done, i) => {
                    const dataRow = dataRowForTrack(i, gridHeight);
                    return (
                      <div
                        key={`row-${i}`}
                        className="pointer-events-auto absolute z-20"
                        style={{
                          left: LABEL_SIZE,
                          top: layoutState.offsetY + dataRow * layoutState.cell,
                          width: ROW_TRACKER_SIDEBAR_PX,
                          height: layoutState.cell,
                        }}
                      >
                        <TrackCheckMark
                          done={done}
                          label={String(i + 1)}
                          ariaLabel={`Row ${i + 1} complete`}
                          onToggle={() => onToggleRowComplete(i)}
                        />
                      </div>
                    );
                  })
                : null}
              {trackMode === "col"
                ? rowComplete.map((done, i) => (
                    <div
                      key={`col-${i}`}
                      className="pointer-events-auto absolute z-20"
                      style={{
                        left: layoutState.offsetX + visualCol(i) * layoutState.cell,
                        top: LABEL_SIZE,
                        width: layoutState.cell,
                        height: ROW_TRACKER_SIDEBAR_PX,
                      }}
                    >
                      <TrackCheckMark
                        done={done}
                        label={String(i + 1)}
                        ariaLabel={`Column ${i + 1} complete`}
                        onToggle={() => onToggleRowComplete(i)}
                      />
                    </div>
                  ))
                : null}
              {trackMode === "diag"
                ? rowComplete.map((done, i) => {
                    const anchor = diagonalAnchor(i, gridWidth, gridHeight);
                    const style =
                      anchor.edge === "left"
                        ? {
                            left: LABEL_SIZE,
                            top: layoutState.offsetY + anchor.row * layoutState.cell,
                            width: ROW_TRACKER_SIDEBAR_PX,
                            height: layoutState.cell,
                          }
                        : {
                            left: layoutState.offsetX + visualCol(anchor.col) * layoutState.cell,
                            top: layoutState.offsetY + layoutState.gridHpx,
                            width: layoutState.cell,
                            height: ROW_TRACKER_SIDEBAR_PX,
                          };
                    return (
                      <div key={`diag-${i}`} className="pointer-events-auto absolute z-20" style={style}>
                        <TrackCheckMark
                          done={done}
                          label={String(i + 1)}
                          ariaLabel={`Diagonal ${i + 1} complete`}
                          onToggle={() => onToggleRowComplete(i)}
                        />
                      </div>
                    );
                  })
                : null}
            </>
          ) : null}
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              width: canvasCssW,
              height: canvasCssH,
              pointerEvents: fullscreen ? "none" : "auto",
              cursor: editLocked ? "default" : "crosshair",
            }}
            className="touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
          />
        </div>
      </div>
    </div>
  );
}
