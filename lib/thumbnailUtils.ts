/**
 * Generate a PNG thumbnail from grid cells with per-cell sizing and optional grid lines.
 * Empty cells are transparent so manila card CSS shows through; filled cells use palette colors.
 */

import {
  DEFAULT_HOLE_INK,
  DEFAULT_PALETTE,
  isCellFilled,
  type CellGrid,
} from "@/lib/gridFormat";
import { DEFAULT_MANILA_STOCK, manilaHex, type ManilaStockId } from "@/lib/manilaStock";

export const HOLE_INK = DEFAULT_HOLE_INK;

/** Keep thumbnail edge the same sheet color as the paper fill. */
function edgeFromPaper(paper: string): string {
  return paper;
}

export type ThumbnailOptions = {
  maxDim?: number;
  paper?: string;
  stockId?: ManilaStockId;
  palette?: string[];
  /** When true (default), empty cells are transparent for CSS paper underlay. */
  transparentEmpty?: boolean;
};

export function generateGridThumbnail(
  cells: CellGrid,
  maxDimOrOpts: number | ThumbnailOptions = 300,
): string {
  if (typeof document === "undefined") return "";
  const opts: ThumbnailOptions =
    typeof maxDimOrOpts === "number" ? { maxDim: maxDimOrOpts } : maxDimOrOpts;
  const maxDim = opts.maxDim ?? 300;
  const paper =
    opts.paper ??
    (opts.stockId ? manilaHex(opts.stockId) : manilaHex(DEFAULT_MANILA_STOCK));
  const edge = edgeFromPaper(paper);
  const colors = opts.palette && opts.palette.length > 0 ? opts.palette : DEFAULT_PALETTE;
  const transparentEmpty = opts.transparentEmpty !== false;

  const rows = cells.length;
  const cols = rows > 0 ? (cells[0]?.length ?? 0) : 0;
  if (rows === 0 || cols === 0) return "";

  const cellPx = Math.max(1, Math.floor(maxDim / Math.max(rows, cols)));
  const gap = cellPx >= 3 ? 1 : 0;
  const stride = cellPx + gap;
  const cw = cols * stride - gap;
  const ch = rows * stride - gap;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  if (transparentEmpty) {
    ctx.clearRect(0, 0, cw, ch);
  } else {
    ctx.fillStyle = gap ? edge : paper;
    ctx.fillRect(0, 0, cw, ch);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = cells[r]?.[c];
      if (isCellFilled(value)) {
        ctx.fillStyle = colors[value!] ?? HOLE_INK;
        ctx.fillRect(c * stride, r * stride, cellPx, cellPx);
      } else if (!transparentEmpty) {
        ctx.fillStyle = paper;
        ctx.fillRect(c * stride, r * stride, cellPx, cellPx);
      }
    }
  }

  return canvas.toDataURL("image/png");
}

const remanilaCache = new Map<string, string>();

/**
 * Punch paper-like empty cells to transparent so the card’s CSS paper shows through.
 * Keeps dark and chromatic yarn/ink pixels (for multi-color patterns).
 */
export function remanilaThumbnail(src: string, _targetHex?: string): Promise<string> {
  if (typeof document === "undefined") return Promise.resolve(src);
  // Cache by src only — output is stock-agnostic (transparent empties).
  const cacheKey = `${src}::punch-alpha`;
  const cached = remanilaCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    // Allow canvas readback for remote storage URLs
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        if (canvas.width === 0 || canvas.height === 0) {
          resolve(src);
          return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          if (a === 0) continue;
          const r = d[i]!;
          const g = d[i + 1]!;
          const b = d[i + 2]!;
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          const chroma = Math.max(r, g, b) - Math.min(r, g, b);
          // Paper-like: light + low chroma → transparent. Keep ink / yarn colors.
          if (luminance > 70 && chroma < 28) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const out = canvas.toDataURL("image/png");
        remanilaCache.set(cacheKey, out);
        resolve(out);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
