import { clamp } from "@/lib/mathUtils";

export const LABEL_SIZE = 28;
export const ROW_TRACKER_SIDEBAR_PX = 44;
/** Extra height below the grid for stacked diag checkbox + number. */
export const DIAG_STACK_SIDEBAR_PX = 52;
/** Extra width on the left/right for stacked diag marks. */
export const DIAG_EDGE_SIDEBAR_PX = 36;
export const MIN_CELL = 10;
export const MAX_CELL = 32;

export type GridCanvasLayoutOptions = {
  /** Extra width (px) reserved left of the grid for row tracker (checkbox + label). */
  rowSidebarPx?: number;
  /** Extra height (px) under column labels for column-tracker checkboxes. */
  colSidebarPx?: number;
  /** Extra height (px) below the grid for trailing diagonal checkboxes. */
  bottomSidebarPx?: number;
  /** Extra width (px) right of the grid for trailing diagonal checkboxes. */
  rightSidebarPx?: number;
  /** Skip fit-to-container calculation and use this exact cell size. */
  forcedCell?: number;
  /** When true with `forcedCell`, center the grid in the usable area instead of flush to gutters. */
  centerForcedCell?: boolean;
};

export type GridCanvasLayout = {
  /** Top gutter for column labels (+ optional col checkboxes). */
  topGutter: number;
  /** Total left inset before grid (corner + optional row sidebar). */
  leftGutter: number;
  /** Width reserved for checkbox column (0 if disabled). */
  rowSidebarPx: number;
  colSidebarPx: number;
  bottomSidebarPx: number;
  rightSidebarPx: number;
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
  const rowSidebarPx = options?.rowSidebarPx ?? 0;
  const colSidebarPx = options?.colSidebarPx ?? 0;
  const bottomSidebarPx = options?.bottomSidebarPx ?? 0;
  const rightSidebarPx = options?.rightSidebarPx ?? 0;
  const topGutter = LABEL_SIZE + colSidebarPx;
  const leftGutter = LABEL_SIZE + rowSidebarPx;
  const usableW = cssW - leftGutter - rightSidebarPx;
  const usableH = cssH - topGutter - bottomSidebarPx;
  const forcedCell = options?.forcedCell;
  const cell =
    forcedCell != null
      ? forcedCell
      : clamp(Math.floor(Math.min(usableW / gridWidth, usableH / gridHeight)), MIN_CELL, MAX_CELL);
  const gridWpx = cell * gridWidth;
  const gridHpx = cell * gridHeight;
  const flushForced = forcedCell != null && !options?.centerForcedCell;
  const offsetX = flushForced ? leftGutter : leftGutter + Math.max(0, (usableW - gridWpx) / 2);
  const offsetY = flushForced ? topGutter : topGutter + Math.max(0, (usableH - gridHpx) / 2);
  return {
    topGutter,
    leftGutter,
    rowSidebarPx,
    colSidebarPx,
    bottomSidebarPx,
    rightSidebarPx,
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
