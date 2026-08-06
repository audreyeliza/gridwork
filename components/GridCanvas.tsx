"use client";

import { cloneGrid } from "@/lib/gridFormat";
import {
  computeGridCanvasLayout,
  LABEL_SIZE,
  ROW_TRACKER_SIDEBAR_PX,
  type GridCanvasLayout,
} from "@/lib/gridCanvasLayout";
import { drawImageWithTransform, type CropRect } from "@/lib/imageCanvasUtils";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

export type GridTool = "pencil" | "eraser";

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
  /** Image scale within the grid (0.5–4). */
  underlayZoom?: number;
  /** Row completion + current row highlight; length must match `gridHeight` when provided. */
  rowComplete?: boolean[];
  currentRow?: number;
  onToggleRowComplete?: (row: number) => void;
  /** Manila card stock fill for empty cells / paper. */
  paperColor?: string;
  /** Optional undo/redo wired into the fullscreen toolbar. */
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Step current row by +1 / -1 (fullscreen toolbar). */
  onStepRow?: (delta: number) => void;
  /** Called when fullscreen state toggles. */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Hide the in-toolbar Fullscreen entry (controls bar owns it). */
  hideFullscreenEntry?: boolean;
  /** Parent can call this to enter fullscreen. */
  enterFullscreenRef?: MutableRefObject<(() => void) | null>;
  /** External tool control — when provided, overrides internal pencil/eraser state. */
  toolOverride?: GridTool;
  onToolOverrideChange?: (tool: GridTool) => void;
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
  underlayZoom = 1,
  rowComplete,
  currentRow = 0,
  onToggleRowComplete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onStepRow,
  onFullscreenChange,
  hideFullscreenEntry = false,
  enterFullscreenRef,
  toolOverride,
  onToolOverrideChange,
  paperColor = "#E8E2D0",
}: GridCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [toolInternal, setToolInternal] = useState<GridTool>("pencil");
  const tool = toolOverride ?? toolInternal;
  const setTool = (t: GridTool) => {
    if (onToolOverrideChange) onToolOverrideChange(t);
    else setToolInternal(t);
  };
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fullscreen, setFullscreen] = useState(false);
  /** Container size — used at fit zoom only. */
  const [containerSize, setContainerSize] = useState({ cssW: 400, cssH: 400 });
  const [layoutState, setLayoutState] = useState<GridCanvasLayout | null>(null);

  const draftRef = useRef<boolean[][] | null>(null);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null);
  const drawingRef = useRef(false);
  const rafRef = useRef(0);
  const dblClickDataRef = useRef<{ r: number; c: number; originalValue: boolean; timerId: number } | null>(null);

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
        canvasCssH: LABEL_SIZE + widthFitCell * gridHeight,
      };
    }
    const cell = Math.max(4, Math.round(widthFitCell * (zoom / 100)));
    return {
      cell,
      canvasCssW: leftGutter + gridWidth * cell,
      canvasCssH: LABEL_SIZE + gridHeight * cell,
    };
  }, [containerSize, zoom, gridWidth, gridHeight, leftGutter]);

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
      const { topGutter, offsetX, offsetY, gridWpx, gridHpx, cell } = layout;

      const data = draftRef.current ?? cells;

      const bg = paperColor;
      const line = "#D6CCA8";
      const fillOn = "#2C2C2C";
      const labelColor = "#62676E";

      if (showUnderlay) {
        ctx.clearRect(0, 0, cssW, cssH);
        fillMarginsOutsideGrid(ctx, cssW, cssH, bg, layout);
        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, offsetY, gridWpx, gridHpx);
        ctx.clip();
        ctx.globalAlpha = opacity;
        drawImageWithTransform(
          ctx,
          underlayImage!,
          offsetX,
          offsetY,
          gridWpx,
          gridHpx,
          underlayCrop,
          underlayPanX,
          underlayPanY,
          underlayZoom,
        );
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
          } else if (!showUnderlay) {
            ctx.fillStyle = bg;
            ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          }
          ctx.strokeStyle = line;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
      }

      const cr = showRowTracker && rowComplete ? currentRow : -1;
      if (cr >= 0 && cr < gridHeight) {
        ctx.fillStyle = "rgba(180,210,230,0.45)";
        ctx.fillRect(offsetX, offsetY + cr * cell, gridWpx, cell);
        ctx.save();
        ctx.strokeStyle = "#5B7EC9";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + cr * cell + 1);
        ctx.lineTo(offsetX + gridWpx, offsetY + cr * cell + 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + (cr + 1) * cell - 1);
        ctx.lineTo(offsetX + gridWpx, offsetY + (cr + 1) * cell - 1);
        ctx.stroke();
        ctx.restore();
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
    underlayImage,
    underlayCrop,
    underlayPanX,
    underlayPanY,
    underlayZoom,
    opacity,
    showRowTracker,
    rowComplete,
    currentRow,
    layoutOpts,
    paperColor,
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
    if (!enterFullscreenRef) return;
    enterFullscreenRef.current = () => setFullscreen(true);
    return () => {
      enterFullscreenRef.current = null;
    };
  }, [enterFullscreenRef]);

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
      const opts = { ...(layoutOpts ?? {}), forcedCell: effectiveCell };
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
    [gridWidth, gridHeight, canvasCssW, canvasCssH, effectiveCell, layoutOpts],
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
    // Suppress the second pointer-down of a double-click on the same cell
    const dbl = dblClickDataRef.current;
    if (dbl && dbl.r === hit.r && dbl.c === hit.c) return;
    if (dbl?.timerId) window.clearTimeout(dbl.timerId);
    const timerId = window.setTimeout(() => { dblClickDataRef.current = null; }, 400) as unknown as number;
    dblClickDataRef.current = { r: hit.r, c: hit.c, originalValue: cells[hit.r]?.[hit.c] ?? false, timerId };
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

  const onCanvasDoubleClick = (e: React.MouseEvent) => {
    const hit = clientToCell(e.clientX, e.clientY);
    if (!hit) return;
    const dbl = dblClickDataRef.current;
    if (dbl?.timerId) window.clearTimeout(dbl.timerId);
    // Use the pre-first-click value so the toggle is always relative to the original state
    const originalValue = dbl && dbl.r === hit.r && dbl.c === hit.c
      ? dbl.originalValue
      : cells[hit.r]?.[hit.c] ?? false;
    dblClickDataRef.current = null;
    const next = cloneGrid(cells);
    next[hit.r][hit.c] = !originalValue;
    onCommit(next);
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
              backgroundColor: paperColor || "#E8E2D0",
              isolation: "isolate",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              pointerEvents: "auto",
            }
          : undefined
      }
    >
      {/* Toolbar */}
      <div className="relative z-40 flex shrink-0 flex-wrap items-center gap-3" style={{ flexShrink: 0 }}>
        {/* Tool + Zoom — hidden in fullscreen (read-only follow-along mode) */}
        {!fullscreen && (
          <>
            {toolOverride === undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-500">Tool</span>
                <div className="inline-flex rounded-full border border-brand/20 bg-white/90 p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setTool("pencil")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                      tool === "pencil"
                        ? "bg-brand text-white shadow-sm"
                        : "text-gray-700 hover:bg-brand/10 hover:text-gray-900"
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
                        : "text-gray-700 hover:bg-brand/10 hover:text-gray-900"
                    }`}
                  >
                    Eraser
                  </button>
                </div>
              </div>
            )}
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
        {!fullscreen && !hideFullscreenEntry && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="ml-auto rounded-full border border-stone-200 bg-white/90 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50"
          >
            ⛶ Fullscreen
          </button>
        )}
      </div>

      {/* Canvas container — outer: positions HUD; inner: scrolls */}
      <div
        className="relative min-h-0 w-full flex-1 overflow-hidden border border-card-edge"
        style={{
          ...(fullscreen ? { flex: 1, minHeight: 0 } : undefined),
          backgroundColor: paperColor || "#E8E2D0",
          transition: "background-color 0.35s ease",
        }}
      >
        <div
          ref={wrapRef}
          className="absolute inset-0 overflow-auto"
        >
          {showRowTracker && layoutState && rowComplete && onToggleRowComplete ? (
            <div
              className="pointer-events-auto absolute z-20 flex flex-col border-r border-brand/15 bg-white/95 shadow-sm"
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
                  className={`flex shrink-0 cursor-pointer items-center justify-center gap-0.5 border-b border-card-edge last:border-b-0 ${
                    done ? "bg-key-blue/10" : ""
                  } ${r === currentRow ? "border-l-[3px] border-l-key-blue bg-[rgba(180,210,230,0.35)]" : ""}`}
                  style={{ height: layoutState.cell }}
                >
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => onToggleRowComplete(r)}
                    className="sr-only"
                    aria-label={`Row ${r + 1} complete`}
                  />
                  <span
                    className="relative inline-flex shrink-0 items-center justify-center"
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      border: done ? "1.5px solid #5B7EC9" : "1.5px solid rgba(91,126,201,0.4)",
                      background: done ? "#5B7EC9" : "#E8E2D0",
                    }}
                  >
                    {done && (
                      <svg viewBox="0 0 8 6" width="8" height="6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 3l2 2 4-4" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`min-w-[1rem] text-center font-mono text-[10px] font-medium tabular-nums ${
                      done ? "line-through text-key-blue" : "text-ink/70"
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
            onDoubleClick={onCanvasDoubleClick}
          />
        </div>

        {/* Zoom HUD — positioned relative to outer wrapper, not affected by scroll */}
        {!fullscreen && (
          <div className="absolute bottom-2 right-2 z-10 pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom("fit")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors duration-150 ${
                zoom === "fit"
                  ? "border-brand/40 bg-brand text-white"
                  : "border-stone-200 bg-white/95 text-gray-700 hover:bg-brand/10"
              }`}
            >
              Fit
            </button>
            <div className="inline-flex items-center rounded-full border border-stone-200 bg-white/95 shadow-sm">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(25, (z === "fit" ? 100 : z) - 10))}
                disabled={typeof zoom === "number" && zoom <= 25}
                className="rounded-l-full px-2.5 py-1 text-sm font-bold text-gray-700 transition-colors hover:bg-brand/10 disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-[3rem] border-x border-stone-200 px-1 py-1 text-center text-xs font-medium tabular-nums text-gray-700">
                {zoom === "fit" ? "Fit" : `${zoom}%`}
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(200, (z === "fit" ? 100 : z) + 10))}
                disabled={typeof zoom === "number" && zoom >= 200}
                className="rounded-r-full px-2.5 py-1 text-sm font-bold text-gray-700 transition-colors hover:bg-brand/10 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
