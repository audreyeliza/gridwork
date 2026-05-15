export const LABEL_SIZE = 28;
export const ROW_TRACKER_SIDEBAR_PX = 44;
export const MIN_CELL = 10;
export const MAX_CELL = 32;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type GridCanvasLayoutOptions = {
  /** Extra width (px) reserved left of the grid for row tracker (checkbox + label). */
  rowSidebarPx?: number;
  /** Skip fit-to-container calculation and use this exact cell size. Offsets are flush to gutters (no centering). */
  forcedCell?: number;
};

export type GridCanvasLayout = {
  /** Top gutter for column labels. */
  topGutter: number;
  /** Total left inset before grid (corner + optional row sidebar). */
  leftGutter: number;
  /** Width reserved for checkbox column (0 if disabled). */
  rowSidebarPx: number;
  /** @deprecated use topGutter */
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
  options?: GridCanvasLayoutOptions,
): GridCanvasLayout {
  const topGutter = LABEL_SIZE;
  const rowSidebarPx = options?.rowSidebarPx ?? 0;
  const leftGutter = LABEL_SIZE + rowSidebarPx;
  const usableW = cssW - leftGutter;
  const usableH = cssH - topGutter;
  const forcedCell = options?.forcedCell;
  const cell =
    forcedCell != null
      ? forcedCell
      : clamp(Math.floor(Math.min(usableW / gridWidth, usableH / gridHeight)), MIN_CELL, MAX_CELL);
  const gridWpx = cell * gridWidth;
  const gridHpx = cell * gridHeight;
  const offsetX = forcedCell != null ? leftGutter : leftGutter + Math.max(0, (usableW - gridWpx) / 2);
  const offsetY = forcedCell != null ? topGutter : topGutter + Math.max(0, (usableH - gridHpx) / 2);
  return {
    topGutter,
    leftGutter,
    rowSidebarPx,
    label: topGutter,
    cell,
    offsetX,
    offsetY,
    gridWpx,
    gridHpx,
    areaW: usableW,
    areaH: usableH,
  };
}
