"use client";

import { cloneGrid } from "@/lib/gridFormat";
import {
  computeGridCanvasLayout,
  LABEL_SIZE,
  ROW_TRACKER_SIDEBAR_PX,
  type GridCanvasLayout,
} from "@/lib/gridCanvasLayout";
import { drawImageWithTransform, type CropRect } from "@/lib/imageCanvasUtils";
import { contrastManilaHexFromPaper, hexWithAlpha } from "@/lib/manilaStock";
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

export type GridCanvasProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  onCommit: (next: boolean[][]) => void;
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
  /** Parent control bar can call fit / zoom in / zoom out. */
  zoomApiRef?: MutableRefObject<{ fit: () => void; zoomIn: () => void; zoomOut: () => void } | null>;
  /** When true, grid cells cannot be painted. */
  editLocked?: boolean;
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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onStepRow,
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

  const draftRef = useRef<boolean[][] | null>(null);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null);
  const drawingRef = useRef(false);
  const brushRef = useRef(true);
  const rafRef = useRef(0);

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
      const line = `color-mix(in srgb, ${paperColor} 92%, #8B3A2A 8%)`;
      const fillOn = "#2C2C2C";
      const labelColor = "#0A0A0A";

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
        // Flush tint from canvas left edge through the grid (no border)
        const hx = 0;
        const hy = offsetY + cr * cell;
        const hw = offsetX + gridWpx;
        ctx.fillStyle = hexWithAlpha(contrastManilaHexFromPaper(paperColor || "#E8E2D0"), 0.4);
        ctx.fillRect(hx, hy, hw, cell);
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
    document.body.classList.toggle("gridwork-grid-fullscreen", fullscreen);
    if (fullscreen) {
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

  // Auto-scroll the canvas container to keep the current row in view in follow mode
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
    if (editLocked) return;
    const hit = clientToCell(e.clientX, e.clientY);
    if (!hit) return;
    // Toggle: block → mesh, mesh → block. Drag keeps that brush for the stroke.
    const brush = !(cells[hit.r]?.[hit.c] ?? false);
    brushRef.current = brush;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    draftRef.current = cloneGrid(cells);
    lastCellRef.current = hit;
    if (draftRef.current) {
      draftRef.current[hit.r][hit.c] = brush;
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
            <div
              className="pointer-events-auto absolute z-20 flex flex-col"
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
                className={`flex shrink-0 cursor-pointer items-center justify-center gap-1`}
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
                    {r + 1}
                  </span>
                </label>
              ))}
            </div>
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
