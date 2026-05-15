"use client";

import { cloneGrid } from "@/lib/gridFormat";
import {
  computeGridCanvasLayout,
  LABEL_SIZE,
  ROW_TRACKER_SIDEBAR_PX,
  type GridCanvasLayout,
} from "@/lib/gridCanvasLayout";
import { drawImageContain } from "@/lib/imageCanvasUtils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GridTool = "pencil" | "eraser";

export type GridCanvasProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  onCommit: (next: boolean[][]) => void;
  className?: string;
  /** When set with opacity &gt; 0, image is drawn behind the grid (contain) and empty cells stay transparent. */
  underlayImage?: CanvasImageSource | null;
  /** 0–1; defaults to 1 when an image is present. */
  underlayOpacity?: number;
  /** Row completion + current row highlight; length must match `gridHeight` when provided. */
  rowComplete?: boolean[];
  currentRow?: number;
  onToggleRowComplete?: (row: number) => void;
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

export function GridCanvas({
  gridWidth,
  gridHeight,
  cells,
  onCommit,
  className,
  underlayImage,
  underlayOpacity = 1,
  rowComplete,
  currentRow = 0,
  onToggleRowComplete,
}: GridCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<GridTool>("pencil");
  const [size, setSize] = useState({ cssW: 400, cssH: 400 });
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

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = size.cssW;
      const cssH = size.cssH;
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const layout = computeGridCanvasLayout(cssW, cssH, gridWidth, gridHeight, layoutOpts);
      queueMicrotask(() => setLayoutState(layout));
      const { topGutter, leftGutter, cell, offsetX, offsetY, gridWpx, gridHpx } = layout;

      const data = draftRef.current ?? cells;

      const dark =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const bg = dark ? "#18181b" : "#fafafa";
      const line = dark ? "#3f3f46" : "#d4d4d8";
      const fillOn = dark ? "#a1a1aa" : "#3f3f46";
      const labelColor = dark ? "#a1a1aa" : "#71717a";

      if (showUnderlay) {
        ctx.clearRect(0, 0, cssW, cssH);
        fillMarginsOutsideGrid(ctx, cssW, cssH, bg, layout);
        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, offsetY, gridWpx, gridHpx);
        ctx.clip();
        ctx.globalAlpha = opacity;
        drawImageContain(ctx, underlayImage!, offsetX, offsetY, gridWpx, gridHpx);
        ctx.globalAlpha = 1;
        ctx.restore();
      } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      const cr = showRowTracker && rowComplete ? currentRow : -1;
      if (cr >= 0 && cr < gridHeight) {
        ctx.fillStyle = dark ? "rgba(250, 204, 21, 0.22)" : "rgba(250, 204, 21, 0.45)";
        ctx.fillRect(offsetX, offsetY + cr * cell, gridWpx, cell);
      }

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let c = 0; c < gridWidth; c++) {
        const x = offsetX + c * cell + cell / 2;
        ctx.fillText(String(c + 1), x, topGutter / 2);
      }
      if (!showRowTracker) {
        for (let r = 0; r < gridHeight; r++) {
          const y = offsetY + r * cell + cell / 2;
          ctx.fillText(String(r + 1), leftGutter / 2, y);
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
    });
  }, [
    cells,
    gridWidth,
    gridHeight,
    size.cssW,
    size.cssH,
    showUnderlay,
    underlayImage,
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
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ cssW: cr.width, cssH: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clientToCell = useCallback(
    (clientX: number, clientY: number): { r: number; c: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const layout = computeGridCanvasLayout(size.cssW, size.cssH, gridWidth, gridHeight, layoutOpts);
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
    [gridWidth, gridHeight, size.cssW, size.cssH, layoutOpts],
  );

  const endStroke = useCallback(() => {
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
    e.currentTarget.setPointerCapture(e.pointerId);
    const hit = clientToCell(e.clientX, e.clientY);
    if (!hit) return;
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

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Tool</span>
        <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-600">
          <button
            type="button"
            onClick={() => setTool("pencil")}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              tool === "pencil"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Pencil
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              tool === "eraser"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Eraser
          </button>
        </div>
      </div>
      <div
        ref={wrapRef}
        className="relative min-h-[280px] w-full flex-1 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        {showRowTracker && layoutState && rowComplete && onToggleRowComplete ? (
          <div
            className="pointer-events-auto absolute z-20 flex flex-col border-r border-zinc-200/80 bg-zinc-50/95 dark:border-zinc-700 dark:bg-zinc-900/95"
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
                className={`flex shrink-0 cursor-pointer items-center justify-center gap-0.5 border-b border-zinc-200/60 last:border-b-0 dark:border-zinc-700/80 ${
                  done ? "bg-emerald-500/20 dark:bg-emerald-500/15" : ""
                }`}
                style={{ height: layoutState.cell }}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggleRowComplete(r)}
                  className="h-3.5 w-3.5 rounded border-zinc-400 text-emerald-600"
                  aria-label={`Row ${r + 1} complete`}
                />
                <span
                  className={`min-w-[1rem] text-center text-[10px] font-medium tabular-nums ${
                    done ? "text-emerald-700 line-through dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-400"
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
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        />
      </div>
    </div>
  );
}
