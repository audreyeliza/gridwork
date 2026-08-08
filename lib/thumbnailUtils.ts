/**
 * Generate a PNG thumbnail from grid cells with per-cell sizing and optional grid lines.
 * PNG is lossless so sharp black/white grids render without JPEG artifacts.
 */

import { DEFAULT_MANILA_STOCK, manilaHex, type ManilaStockId } from "@/lib/manilaStock";

export const HOLE_INK = "#2C2C2C";

/** Keep thumbnail edge the same sheet color as the paper fill. */
function edgeFromPaper(paper: string): string {
  return paper;
}

export type ThumbnailOptions = {
  maxDim?: number;
  paper?: string;
  stockId?: ManilaStockId;
};

export function generateGridThumbnail(
  cells: boolean[][],
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

  const rows = cells.length;
  const cols = rows > 0 ? cells[0].length : 0;
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

  ctx.fillStyle = gap ? edge : paper;
  ctx.fillRect(0, 0, cw, ch);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = cells[r][c] ? HOLE_INK : paper;
      ctx.fillRect(c * stride, r * stride, cellPx, cellPx);
    }
  }

  return canvas.toDataURL("image/png");
}

const remanilaCache = new Map<string, string>();

/**
 * Punch empty cells to transparent so the card’s CSS paper shows through.
 * Keeps dark hole-ink pixels; clears everything else (any stock / legacy cream).
 * This is more reliable than remapping known paper hexes.
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
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          // Hole ink is near-black; keep those, clear paper / cream / tinted empty cells
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luminance > 70) {
            d[i + 3] = 0;
          } else {
            // Normalize holes to solid ink for consistency
            d[i] = 0x2c;
            d[i + 1] = 0x2c;
            d[i + 2] = 0x2c;
            d[i + 3] = 255;
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
