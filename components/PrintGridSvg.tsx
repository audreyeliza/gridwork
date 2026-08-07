export type PrintGridSvgProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  rowComplete: boolean[];
  /** Unused for drawing — kept for call-site compat. */
  currentRow?: number;
  /** Logical pixel size of one cell inside the SVG viewBox (scaled by CSS). */
  cellPx?: number;
};

/**
 * Print-oriented SVG grid: dense B&W cells, col/row labels, row checkboxes.
 * Scales to the page via width/height 100% + viewBox.
 */
export function PrintGridSvg({
  gridWidth,
  gridHeight,
  cells,
  rowComplete,
  cellPx = 14,
}: PrintGridSvgProps) {
  const checkSize = Math.max(8, Math.min(12, cellPx - 2));
  const checkCol = 18;
  const numCol = 28;
  const rowPad = checkCol + numCol;
  const colPad = 22;
  const gridW = gridWidth * cellPx;
  const gridH = gridHeight * cellPx;
  const w = rowPad + gridW + 4;
  const h = colPad + gridH + 4;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      preserveAspectRatio="xMidYMin meet"
      className="block h-auto max-h-full w-full bg-white text-black"
      role="img"
      aria-label="Pattern grid"
    >
      {/* Dense B&W cells — abutting, no gaps */}
      {cells.flatMap((row, r) =>
        row.map((filled, c) => (
          <rect
            key={`cell-${r}-${c}`}
            x={rowPad + c * cellPx}
            y={colPad + r * cellPx}
            width={cellPx}
            height={cellPx}
            fill={filled ? "#000000" : "#FFFFFF"}
          />
        )),
      )}

      {/* Hairline grid */}
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

      {/* Column numbers */}
      {Array.from({ length: gridWidth }, (_, c) => (
        <text
          key={`cn-${c}`}
          x={rowPad + c * cellPx + cellPx / 2}
          y={colPad - 6}
          fontSize={9}
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
          fill="#000000"
        >
          {c + 1}
        </text>
      ))}

      {/* Row checkboxes + numbers */}
      {Array.from({ length: gridHeight }, (_, r) => {
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
              {r + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
