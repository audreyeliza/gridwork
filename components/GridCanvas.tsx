"use client";

import { cloneGrid } from "@/lib/gridFormat";
import {
  computeGridCanvasLayout,
  LABEL_SIZE,
  ROW_TRACKER_SIDEBAR_PX,
  type GridCanvasLayout,
} from "@/lib/gridCanvasLayout";
import { drawImageWithTransform, type CropRect } from "@/lib/imageCanvasUtils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GridTool = "pencil" | "eraser";
type ZoomLevel = "fit" | "100" | "150";

const ZOOM_CELL_SIZE: Record<ZoomLevel, number | null> = {
  fit: null,
  "100": 20,
  "150": 30,
};

export type GridCanvasProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  onCommit: (next: boolean[][]) => void;
  className?: string;
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
  /** Row completion + current row highlight; length must match `gridHeight` when provided. */
  rowComplete?: boolean[];
  currentRow?: number;
  onToggleRowComplete?: (row: number) => void;
  /** Optional undo/redo wired into the fullscreen toolbar. */
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Step current row by +1 / -1 (fullscreen toolbar). */
  onStepRow?: (delta: number) => void;
  /** Called when fullscreen state toggles. */
  onFullscreenChange?: (fullscreen: boolean) => void;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

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
}

function paintLine(
  grid: boolean[][],
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  value: boolean,
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

export function GridCanvas({
  gridWidth,
  gridHeight,
  cells,
  onCommit,
  className,
  underlayImage,
  underlayOpacity = 1,
  underlayCrop = null,
  underlayPanX = 0,
  underlayPanY = 0,
  rowComplete,
  currentRow = 0,
  onToggleRowComplete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onStepRow,
  onFullscreenChange,
}: GridCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<GridTool>("pencil");
  const [zoom, setZoom] = useState<ZoomLevel>("fit");
  const [fullscreen, setFullscreen] = useState(false);
  /** Container size — used at fit zoom only. */
  const [containerSize, setContainerSize] = useState({ cssW: 400, cssH: 400 });
  const [layoutState, setLayoutState] = useState<GridCanvasLayout | null>(null);

  const draftRef = useRef<boolean[][] | null>(null);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null);
  const drawingRef = useRef(false);
  const rafRef = useRef(0);

  const opacity = clamp(underlayOpacity, 0, 1);
  const showUnderlay = Boolean(underlayImage) && opacity > 0;

  const showRowTracker =
    Boolean(onToggleRowComplete) &&
    Array.isArray(rowComplete) &&
    rowComplete.length === gridHeight;

  const layoutOpts = useMemo(
    () => (showRowTracker ? { rowSidebarPx: ROW_TRACKER_SIDEBAR_PX } : undefined),
    [showRowTracker],
  );

  const leftGutter = LABEL_SIZE + (showRowTracker ? ROW_TRACKER_SIDEBAR_PX : 0);

  const zoomCellSize = ZOOM_CELL_SIZE[zoom];

  /**
   * At "fit" zoom, cells are sized so columns exactly fill the container width.
   * No upper cap — this makes the canvas taller than the container for most grids,
   * enabling vertical scroll. A floor of 4px keeps the grid renderable.
   * At explicit zoom levels the canvas uses fixed cell sizes in both axes.
   */
  const fitCell = Math.max(4, Math.floor((containerSize.cssW - leftGutter) / Math.max(1, gridWidth)));

  /** Canvas display size in CSS pixels. */
  const canvasCssW =
    zoomCellSize != null
      ? leftGutter + gridWidth * zoomCellSize
      : containerSize.cssW;
  const canvasCssH =
    zoomCellSize != null
      ? LABEL_SIZE + gridHeight * zoomCellSize
      : LABEL_SIZE + fitCell * gridHeight;

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

      const effectiveCell = zoomCellSize ?? fitCell;
      const opts = { ...(layoutOpts ?? {}), forcedCell: effectiveCell };
      const layout = computeGridCanvasLayout(cssW, cssH, gridWidth, gridHeight, opts);
      queueMicrotask(() => setLayoutState(layout));
      const { topGutter, offsetX, offsetY, gridWpx, gridHpx, cell } = layout;

      const data = draftRef.current ?? cells;

      const bg = "#fffbf5";
      const line = "#e7e5e4";
      const fillOn = "#F0569A";
      const labelColor = "#78716c";

      if (showUnderlay) {
        ctx.clearRect(0, 0, cssW, cssH);
        fillMarginsOutsideGrid(ctx, cssW, cssH, bg, layout);
        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, offsetY, gridWpx, gridHpx);
        ctx.clip();
        ctx.globalAlpha = opacity;
        drawImageWithTransform(ctx, underlayImage!, offsetX, offsetY, gridWpx, gridHpx, underlayCrop, underlayPanX, underlayPanY);
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
        const x = offsetX + c * cell + cell / 2;
        ctx.fillText(String(c + 1), x, topGutter / 2);
      }
      if (!showRowTracker) {
        for (let r = 0; r < gridHeight; r++) {
          if (r % step !== 0 && r !== gridHeight - 1) continue;
          const y = offsetY + r * cell + cell / 2;
          ctx.fillText(String(r + 1), LABEL_SIZE / 2, y);
        }
      }

      for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
          const x = offsetX + c * cell;
          const y = offsetY + r * cell;
          if (data[r]?.[c]) {
            ctx.fillStyle = fillOn;
            ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          }
          ctx.strokeStyle = line;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
      }

      const cr = showRowTracker && rowComplete ? currentRow : -1;
      if (cr >= 0 && cr < gridHeight) {
        ctx.fillStyle = "rgba(249, 168, 122, 0.35)";
        ctx.fillRect(offsetX, offsetY + cr * cell, gridWpx, cell);
      }
    });
  }, [
    cells,
    gridWidth,
    gridHeight,
    canvasCssW,
    canvasCssH,
    zoomCellSize,
    fitCell,
    showUnderlay,
    underlayImage,
    underlayCrop,
    underlayPanX,
    underlayPanY,
    opacity,
    showRowTracker,
    rowComplete,
    currentRow,
    layoutOpts,
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
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen, onFullscreenChange]);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // Auto-scroll the canvas container to keep the current row in view in fullscreen
  useEffect(() => {
    if (!fullscreen || !wrapRef.current || !layoutState) return;
    const container = wrapRef.current;
    const rowTop = layoutState.offsetY + currentRow * layoutState.cell;
    const rowBottom = rowTop + layoutState.cell;
    const { scrollTop, clientHeight } = container;
    if (rowTop < scrollTop) {
      container.scrollTo({ top: rowTop - 8, behavior: "smooth" });
    } else if (rowBottom > scrollTop + clientHeight) {
      container.scrollTo({ top: rowBottom - clientHeight + 8, behavior: "smooth" });
    }
  }, [fullscreen, currentRow, layoutState]);

  const clientToCell = useCallback(
    (clientX: number, clientY: number): { r: number; c: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const opts = { ...(layoutOpts ?? {}), forcedCell: zoomCellSize ?? fitCell };
      const layout = computeGridCanvasLayout(canvasCssW, canvasCssH, gridWidth, gridHeight, opts);
      const { cell: cellSize, offsetX, offsetY, gridWpx, gridHpx } = layout;
      const px = x - offsetX;
      const py = y - offsetY;
      if (px < 0 || py < 0) return null;
      const col = Math.floor(px / cellSize);
      const row = Math.floor(py / cellSize);
      if (row < 0 || row >= gridHeight || col < 0 || col >= gridWidth) return null;
      if (px >= gridWpx || py >= gridHpx) return null;
      return { r: row, c: col };
    },
    [gridWidth, gridHeight, canvasCssW, canvasCssH, zoomCellSize, fitCell, layoutOpts],
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
    const hit = clientToCell(e.clientX, e.clientY);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    draftRef.current = cloneGrid(cells);
    lastCellRef.current = hit;
    const brush = tool === "pencil";
    if (draftRef.current) {
      draftRef.current[hit.r][hit.c] = brush;
    }
    scheduleDraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !draftRef.current) return;
    const hit = clientToCell(e.clientX, e.clientY);
    if (!hit) return;
    const last = lastCellRef.current;
    const brush = tool === "pencil";
    if (last && (last.r !== hit.r || last.c !== hit.c)) {
      paintLine(draftRef.current, last.r, last.c, hit.r, hit.c, brush);
    } else if (!last) {
      draftRef.current[hit.r][hit.c] = brush;
    }
    lastCellRef.current = hit;
    scheduleDraw();
  };

  const checkedRows = rowComplete ? rowComplete.filter(Boolean).length : 0;
  const totalRows = rowComplete ? rowComplete.length : 0;
  const progressPct = totalRows > 0 ? Math.round((checkedRows / totalRows) * 100) : 0;
  const progressComplete = totalRows > 0 && checkedRows === totalRows;

  const toolbarButtonCls = "rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40";

  return (
    <div
      className={fullscreen ? "gap-3 p-4" : `flex min-h-0 flex-1 flex-col gap-3 ${className ?? ""}`}
      style={
        fullscreen
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 200,
              backgroundColor: "#ffffff",
              isolation: "isolate",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              pointerEvents: "auto",
            }
          : undefined
      }
    >
      {/* Progress bar — shown when row tracking is active */}
      {showRowTracker && totalRows > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                backgroundColor: progressComplete ? "#E8609A" : "#F9A87A",
              }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-stone-500">
            {progressComplete ? "Complete! 🎉" : `${progressPct}%`}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="relative z-40 flex shrink-0 flex-wrap items-center gap-3" style={{ flexShrink: 0 }}>
        {/* Tool + Zoom — hidden in fullscreen (read-only follow-along mode) */}
        {!fullscreen && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-500">Tool</span>
              <div id="tutorial-pencil" className="inline-flex rounded-full border border-brand/20 bg-white/90 p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setTool("pencil")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    tool === "pencil"
                      ? "bg-brand text-white shadow-sm"
                      : "text-gray-700 hover:bg-pink-50 hover:text-gray-900"
                  }`}
                >
                  Pencil
                </button>
                <button
                  type="button"
                  onClick={() => setTool("eraser")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    tool === "eraser"
                      ? "bg-brand text-white shadow-sm"
                      : "text-gray-700 hover:bg-pink-50 hover:text-gray-900"
                  }`}
                >
                  Eraser
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-500">Zoom</span>
              <div className="inline-flex rounded-full border border-stone-200 bg-white/90 p-0.5 shadow-sm">
                {(["fit", "100", "150"] as ZoomLevel[]).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoom(z)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                      zoom === z
                        ? "bg-brand text-white shadow-sm"
                        : "text-gray-700 hover:bg-pink-50 hover:text-gray-900"
                    }`}
                  >
                    {z === "fit" ? "Fit" : `${z}%`}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Fullscreen: Prev row / Next row + Exit */}
        {fullscreen && (
          <div className="flex w-full items-center gap-2">
            {onStepRow !== undefined && (
              <>
                <button
                  type="button"
                  onClick={() => onStepRow(-1)}
                  disabled={currentRow <= 0}
                  className={toolbarButtonCls}
                >
                  Prev row
                </button>
                <button
                  type="button"
                  onClick={() => onStepRow(1)}
                  disabled={currentRow >= gridHeight - 1}
                  className={toolbarButtonCls}
                >
                  Next row
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="ml-auto rounded-full border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
            >
              ✕ Exit fullscreen
            </button>
          </div>
        )}

        {/* Normal mode: fullscreen entry button */}
        {!fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="ml-auto rounded-full border border-stone-200 bg-white/90 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50"
          >
            ⛶ Fullscreen
          </button>
        )}
      </div>

      {/* Canvas container */}
      <div
        ref={wrapRef}
        className="relative min-h-0 w-full flex-1 overflow-auto rounded-xl border border-rose-100/80 bg-white/90 shadow-sm"
        style={fullscreen ? { flex: 1, minHeight: 0, overflow: "auto" } : undefined}
      >
        {showRowTracker && layoutState && rowComplete && onToggleRowComplete ? (
          <div
            className="pointer-events-auto absolute z-20 flex flex-col border-r border-rose-100/90 bg-white/95 shadow-sm"
            style={{
              left: LABEL_SIZE,
              top: layoutState.offsetY,
              width: ROW_TRACKER_SIDEBAR_PX,
              height: layoutState.gridHpx,
            }}
          >
            {rowComplete.map((done, r) => (
              <label
                key={r}
                className={`flex shrink-0 cursor-pointer items-center justify-center gap-0.5 border-b border-rose-100/70 last:border-b-0 ${
                  done ? "bg-emerald-100/50" : ""
                }`}
                style={{ height: layoutState.cell }}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggleRowComplete(r)}
                  className="h-3.5 w-3.5 rounded border-rose-200 text-emerald-600"
                  aria-label={`Row ${r + 1} complete`}
                />
                <span
                  className={`min-w-[1rem] text-center text-[10px] font-medium tabular-nums ${
                    done ? "text-emerald-800 line-through" : "text-stone-600"
                  }`}
                >
                  {r + 1}
                </span>
              </label>
            ))}
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: canvasCssW, height: canvasCssH, pointerEvents: fullscreen ? "none" : "auto" }}
          className="touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        />
      </div>
    </div>
  );
}
