"use client";

import { cloneGrid } from "@/lib/gridFormat";
import { useCallback, useEffect, useRef, useState } from "react";

const LABEL_SIZE = 28;
const MIN_CELL = 6;
const MAX_CELL = 32;

export type GridTool = "pencil" | "eraser";

export type GridCanvasProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  onCommit: (next: boolean[][]) => void;
  className?: string;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
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

export function GridCanvas({ gridWidth, gridHeight, cells, onCommit, className }: GridCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<GridTool>("pencil");
  const [size, setSize] = useState({ cssW: 400, cssH: 400 });

  const draftRef = useRef<boolean[][] | null>(null);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null);
  const drawingRef = useRef(false);
  const rafRef = useRef(0);

  const cellDimsRef = useRef({ cell: 16, label: LABEL_SIZE });

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

      const label = LABEL_SIZE;
      const areaW = cssW - label;
      const areaH = cssH - label;
      const cell = clamp(Math.floor(Math.min(areaW / gridWidth, areaH / gridHeight)), MIN_CELL, MAX_CELL);
      cellDimsRef.current = { cell, label };

      const gridWpx = cell * gridWidth;
      const gridHpx = cell * gridHeight;
      const offsetX = label + Math.max(0, (areaW - gridWpx) / 2);
      const offsetY = label + Math.max(0, (areaH - gridHpx) / 2);

      const data = draftRef.current ?? cells;

      const dark =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const bg = dark ? "#18181b" : "#fafafa";
      const line = dark ? "#3f3f46" : "#d4d4d8";
      const fillOn = dark ? "#a1a1aa" : "#3f3f46";
      const labelColor = dark ? "#a1a1aa" : "#71717a";

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let c = 0; c < gridWidth; c++) {
        const x = offsetX + c * cell + cell / 2;
        ctx.fillText(String(c + 1), x, label / 2);
      }
      for (let r = 0; r < gridHeight; r++) {
        const y = offsetY + r * cell + cell / 2;
        ctx.fillText(String(r + 1), label / 2, y);
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
  }, [cells, gridWidth, gridHeight, size.cssW, size.cssH]);

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
      const { cell, label } = cellDimsRef.current;
      const areaW = size.cssW - label;
      const areaH = size.cssH - label;
      const gridWpx = cell * gridWidth;
      const gridHpx = cell * gridHeight;
      const offsetX = label + Math.max(0, (areaW - gridWpx) / 2);
      const offsetY = label + Math.max(0, (areaH - gridHpx) / 2);
      const px = x - offsetX;
      const py = y - offsetY;
      if (px < 0 || py < 0) return null;
      const c = Math.floor(px / cell);
      const r = Math.floor(py / cell);
      if (r < 0 || r >= gridHeight || c < 0 || c >= gridWidth) return null;
      return { r, c };
    },
    [gridWidth, gridHeight, size.cssW, size.cssH],
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
