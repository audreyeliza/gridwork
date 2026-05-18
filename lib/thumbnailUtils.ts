/**
 * Generate a PNG thumbnail from grid cells with per-cell sizing and optional grid lines.
 * PNG is lossless so sharp black/white grids render without JPEG artifacts.
 */
export function generateGridThumbnail(cells: boolean[][], maxDim = 300): string {
  if (typeof document === "undefined") return "";
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

  // Grid line color fills the background when gap > 0
  ctx.fillStyle = gap ? "#d6d3d1" : "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = cells[r][c] ? "#1c1917" : "#ffffff";
      ctx.fillRect(c * stride, r * stride, cellPx, cellPx);
    }
  }

  return canvas.toDataURL("image/png");
}
