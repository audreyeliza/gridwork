import { DEFAULT_HOLE_INK, DEFAULT_PALETTE, isCellFilled, type CellGrid } from "@/lib/gridFormat";
import {
  crochetRowLabel,
  diagonalAnchor,
  isDiagTrack,
  type TrackMode,
} from "@/lib/progressData";

export type PrintGridSvgProps = {
  gridWidth: number;
  gridHeight: number;
  cells: CellGrid;
  /** Hex colors for palette indices. */
  palette?: string[];
  rowComplete: boolean[];
  trackMode?: TrackMode;
  /** Unused for drawing — kept for call-site compat. */
  currentRow?: number;
  /** Logical pixel size of one cell inside the SVG viewBox (scaled by CSS). */
  cellPx?: number;
};

/**
 * Print-oriented SVG grid: dense cells (palette colors), col/row labels, tracker checkboxes.
 * Row 1 is the top of the chart. Scales to the page via width/height 100% + viewBox.
 */
export function PrintGridSvg({
  gridWidth,
  gridHeight,
  cells,
  palette = DEFAULT_PALETTE,
  rowComplete,
  trackMode = "row",
  cellPx = 14,
}: PrintGridSvgProps) {
  const checkSize = Math.max(8, Math.min(12, cellPx - 2));
  const checkCol = 18;
  const numCol = 28;
  const rowPad = trackMode === "diagUp" ? 22 : checkCol + numCol;
  const rightPad = trackMode === "diagUp" ? 36 : 4;
  const colPad = trackMode === "col" ? 40 : 22;
  const bottomPad = isDiagTrack(trackMode) ? 40 : 4;
  const gridW = gridWidth * cellPx;
  const gridH = gridHeight * cellPx;
  const w = rowPad + gridW + rightPad;
  const h = colPad + gridH + bottomPad;
  const colors = palette.length > 0 ? palette : DEFAULT_PALETTE;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      preserveAspectRatio="xMidYMin meet"
      className="block h-auto max-h-full w-full bg-white text-black"
      role="img"
      aria-label="Pattern grid"
    >
      {cells.flatMap((row, r) =>
        row.map((value, c) => (
          <rect
            key={`cell-${r}-${c}`}
            x={rowPad + c * cellPx}
            y={colPad + r * cellPx}
            width={cellPx}
            height={cellPx}
            fill={isCellFilled(value) ? (colors[value!] ?? DEFAULT_HOLE_INK) : "#FFFFFF"}
          />
        )),
      )}

      <g stroke="#000000" strokeWidth={0.6} fill="none">
        {Array.from({ length: gridWidth + 1 }, (_, i) => (
          <line
            key={`vl-${i}`}
            x1={rowPad + i * cellPx}
            y1={colPad}
            x2={rowPad + i * cellPx}
            y2={colPad + gridH}
          />
        ))}
        {Array.from({ length: gridHeight + 1 }, (_, i) => (
          <line
            key={`hl-${i}`}
            x1={rowPad}
            y1={colPad + i * cellPx}
            x2={rowPad + gridW}
            y2={colPad + i * cellPx}
          />
        ))}
      </g>

      {Array.from({ length: gridWidth }, (_, c) => (
        <text
          key={`cn-${c}`}
          x={rowPad + c * cellPx + cellPx / 2}
          y={trackMode === "col" ? 11 : colPad - 6}
          fontSize={9}
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
          fill="#000000"
        >
          {c + 1}
        </text>
      ))}

      {trackMode === "row"
        ? Array.from({ length: gridHeight }, (_, r) => {
            const done = Boolean(rowComplete[r]);
            const cy = colPad + r * cellPx + cellPx / 2;
            const cx = checkCol / 2;
            const half = checkSize / 2;
            return (
              <g key={`rn-${r}`}>
                <rect
                  x={cx - half}
                  y={cy - half}
                  width={checkSize}
                  height={checkSize}
                  fill="#FFFFFF"
                  stroke="#000000"
                  strokeWidth={1.25}
                  rx={1}
                />
                {done ? (
                  <path
                    d={`M ${cx - half + 2.2} ${cy} L ${cx - 0.5} ${cy + half - 2.5} L ${cx + half - 2} ${cy - half + 2.5}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                <text
                  x={checkCol + numCol / 2}
                  y={cy + 3.5}
                  fontSize={9}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                  fill="#000000"
                >
                  {crochetRowLabel(r, gridHeight)}
                </text>
              </g>
            );
          })
        : null}

      {trackMode === "col"
        ? Array.from({ length: gridWidth }, (_, c) => {
            const done = Boolean(rowComplete[c]);
            const cx = rowPad + c * cellPx + cellPx / 2;
            const cy = 28;
            const half = checkSize / 2;
            return (
              <g key={`cnc-${c}`}>
                <rect
                  x={cx - half}
                  y={cy - half}
                  width={checkSize}
                  height={checkSize}
                  fill="#FFFFFF"
                  stroke="#000000"
                  strokeWidth={1.25}
                  rx={1}
                />
                {done ? (
                  <path
                    d={`M ${cx - half + 2.2} ${cy} L ${cx - 0.5} ${cy + half - 2.5} L ${cx + half - 2} ${cy - half + 2.5}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </g>
            );
          })
        : null}

      {trackMode === "col"
        ? Array.from({ length: gridHeight }, (_, r) => (
            <text
              key={`rn-col-${r}`}
              x={rowPad / 2}
              y={colPad + r * cellPx + cellPx / 2 + 3.5}
              fontSize={9}
              fontFamily="ui-monospace, monospace"
              textAnchor="middle"
              fill="#000000"
            >
              {crochetRowLabel(r, gridHeight)}
            </text>
          ))
        : null}

      {isDiagTrack(trackMode)
        ? rowComplete.map((done, i) => {
            const anchor = diagonalAnchor(i, gridWidth, gridHeight, trackMode);
            const half = checkSize / 2;
            if (anchor.edge === "left" || anchor.edge === "right") {
              const cy = colPad + anchor.row * cellPx + cellPx / 2;
              const cx = anchor.edge === "left" ? checkCol / 2 : rowPad + gridW + rightPad / 2;
              return (
                <g key={`dg-${i}`}>
                  <rect
                    x={cx - half}
                    y={cy - half - 6}
                    width={checkSize}
                    height={checkSize}
                    fill="#FFFFFF"
                    stroke="#000000"
                    strokeWidth={1.25}
                    rx={1}
                  />
                  {done ? (
                    <path
                      d={`M ${cx - half + 2.2} ${cy - 6} L ${cx - 0.5} ${cy - 6 + half - 2.5} L ${cx + half - 2} ${cy - 6 - half + 2.5}`}
                      fill="none"
                      stroke="#000000"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  <text
                    x={cx}
                    y={cy + half + 6}
                    fontSize={8}
                    fontFamily="ui-monospace, monospace"
                    textAnchor="middle"
                    fill="#000000"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            }
            const cx = rowPad + anchor.col * cellPx + cellPx / 2;
            const cy = colPad + gridH + 12;
            return (
              <g key={`dg-${i}`}>
                <rect
                  x={cx - half}
                  y={cy - half}
                  width={checkSize}
                  height={checkSize}
                  fill="#FFFFFF"
                  stroke="#000000"
                  strokeWidth={1.25}
                  rx={1}
                />
                {done ? (
                  <path
                    d={`M ${cx - half + 2.2} ${cy} L ${cx - 0.5} ${cy + half - 2.5} L ${cx + half - 2} ${cy - half + 2.5}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                <text
                  x={cx}
                  y={cy + half + 10}
                  fontSize={8}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                  fill="#000000"
                >
                  {i + 1}
                </text>
              </g>
            );
          })
        : null}
    </svg>
  );
}
