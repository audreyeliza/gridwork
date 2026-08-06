/**
 * Generate a PNG thumbnail from grid cells with per-cell sizing and optional grid lines.
 * PNG is lossless so sharp black/white grids render without JPEG artifacts.
 */

import { DEFAULT_MANILA_STOCK, MANILA_STOCKS, manilaHex, type ManilaStockId } from "@/lib/manilaStock";

export const MANILA_STOCK = "#E8E2D0";
export const MANILA_EDGE = "#E8E2D0";
export const HOLE_INK = "#2C2C2C";

/** Keep thumbnail edge the same sheet color as the paper fill. */
function edgeFromPaper(paper: string): string {
  return paper;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Known paper fills from current + legacy thumbnails (for remapping empty cells). */
const PAPER_RGBS: [number, number, number][] = [
  ...MANILA_STOCKS.map((s) => parseHexRgb(s.hex)!).filter(Boolean),
  [0xf2, 0xed, 0xd3], // legacy remanila cream
  [0xed, 0xe8, 0xd5], // --paper
];

function isPaperPixel(r: number, g: number, b: number, a: number): boolean {
  if (a === 0) return false;
  // Pure / near-white legacy empty cells
  if (r >= 245 && g >= 245 && b >= 245) return true;
  for (const [pr, pg, pb] of PAPER_RGBS) {
    if (Math.abs(r - pr) <= 18 && Math.abs(g - pg) <= 18 && Math.abs(b - pb) <= 18) {
      return true;
    }
  }
  return false;
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
 * Remap empty-cell / paper pixels in a thumbnail to the card's current stock hex
 * so the grid matches the frame for every manila color.
 */
export function remanilaThumbnail(src: string, targetHex?: string): Promise<string> {
  if (typeof document === "undefined") return Promise.resolve(src);
  const paper = targetHex ?? manilaHex(DEFAULT_MANILA_STOCK);
  const rgb = parseHexRgb(paper);
  if (!rgb) return Promise.resolve(src);
  const cacheKey = `${src}::${paper.toLowerCase()}`;
  const cached = remanilaCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const [tr, tg, tb] = rgb;

  return new Promise((resolve) => {
    const img = new Image();
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
          if (isPaperPixel(d[i], d[i + 1], d[i + 2], d[i + 3])) {
            d[i] = tr;
            d[i + 1] = tg;
            d[i + 2] = tb;
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
