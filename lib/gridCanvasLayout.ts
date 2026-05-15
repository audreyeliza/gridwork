export const LABEL_SIZE = 28;
export const MIN_CELL = 6;
export const MAX_CELL = 32;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type GridCanvasLayout = {
  label: number;
  cell: number;
  offsetX: number;
  offsetY: number;
  gridWpx: number;
  gridHpx: number;
  areaW: number;
  areaH: number;
};

export function computeGridCanvasLayout(
  cssW: number,
  cssH: number,
  gridWidth: number,
  gridHeight: number,
): GridCanvasLayout {
  const label = LABEL_SIZE;
  const areaW = cssW - label;
  const areaH = cssH - label;
  const cell = clamp(Math.floor(Math.min(areaW / gridWidth, areaH / gridHeight)), MIN_CELL, MAX_CELL);
  const gridWpx = cell * gridWidth;
  const gridHpx = cell * gridHeight;
  const offsetX = label + Math.max(0, (areaW - gridWpx) / 2);
  const offsetY = label + Math.max(0, (areaH - gridHpx) / 2);
  return { label, cell, offsetX, offsetY, gridWpx, gridHpx, areaW, areaH };
}
