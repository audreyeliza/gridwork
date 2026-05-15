export type PrintGridSvgProps = {
  gridWidth: number;
  gridHeight: number;
  cells: boolean[][];
  rowComplete: boolean[];
  currentRow: number;
  /** Pixel size of one cell (screen + print). */
  cellPx?: number;
};

/**
 * Print-oriented SVG grid with row/column labels, completed-row markers, and current-row tint.
 */
export function PrintGridSvg({
  gridWidth,
  gridHeight,
  cells,
  rowComplete,
  currentRow,
  cellPx = 11,
}: PrintGridSvgProps) {
  const rowPad = 40;
  const colPad = 24;
  const w = rowPad + gridWidth * cellPx + 12;
  const h = colPad + gridHeight * cellPx + 12;

  const safeRow = Math.min(gridHeight - 1, Math.max(0, currentRow));

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="max-w-full border border-zinc-400 bg-white text-black print:border-zinc-900"
      role="img"
      aria-label="Pattern grid"
    >
      {currentRow >= 0 && currentRow < gridHeight ? (
        <rect
          x={rowPad - 0.5}
          y={colPad + safeRow * cellPx}
          width={gridWidth * cellPx + 1}
          height={cellPx}
          fill="rgba(253, 224, 71, 0.5)"
        />
      ) : null}

      {cells.flatMap((row, r) =>
        row.map((filled, c) => (
          <rect
            key={`cell-${r}-${c}`}
            x={rowPad + c * cellPx + 0.5}
            y={colPad + r * cellPx + 0.5}
            width={cellPx - 1}
            height={cellPx - 1}
            fill={filled ? "#27272a" : "#ffffff"}
            stroke="#a3a3a3"
            strokeWidth={0.6}
          />
        )),
      )}

      {Array.from({ length: gridWidth }, (_, c) => (
        <text
          key={`cn-${c}`}
          x={rowPad + c * cellPx + cellPx / 2}
          y={16}
          fontSize={10}
          textAnchor="middle"
          fill="#171717"
        >
          {c + 1}
        </text>
      ))}

      {Array.from({ length: gridHeight }, (_, r) => (
        <g key={`rn-${r}`}>
          <text
            x={rowPad / 2}
            y={colPad + r * cellPx + cellPx / 2 + 4}
            fontSize={10}
            textAnchor="middle"
            fill={rowComplete[r] ? "#15803d" : "#171717"}
            fontWeight={rowComplete[r] ? 700 : 400}
          >
            {rowComplete[r] ? "✓ " : ""}
            {r + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
