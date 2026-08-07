/** Cut-corner punch-card mark — solid G holes only (no mesh outlines). */
export function CrochetMark({
  size = 22,
  variant = "onChassis",
}: {
  size?: number;
  variant?: "onChassis" | "onPaper" | "mono";
  /** @deprecated */
  color?: string;
}) {
  // Sparse G — fewer chunky square holes, inset clear of the cut corner
  const cells = [
    [0, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 0, 1, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
  ];
  const cols = 4;
  const rows = 5;
  const strokeW = 1;
  // Inset so stroke stays inside the viewBox — equal on all sides = square footprint
  const inset = strokeW / 2 + 0.5;
  const outer = size - inset;
  const cutSize = (outer - inset) * 0.22;
  const gridPad = size * 0.14;
  const gap = Math.max(0.7, size * 0.035);
  const gridInner = size - gridPad * 2;
  // One square cell size — fit both axes, then center the grid
  const cell = Math.min(
    (gridInner - gap * (cols - 1)) / cols,
    (gridInner - gap * (rows - 1)) / rows,
  );
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const originX = (size - gridW) / 2;
  const originY = (size - gridH) / 2;

  const fillCard = variant === "mono" ? "currentColor" : "#F2EDD3";
  const fillHole = variant === "mono" ? "currentColor" : "#2C2C2C";
  const stroke = variant === "mono" ? "currentColor" : "#D6CCA8";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Square card; cut corner is silhouette only — no gray fill triangle */}
      <path
        d={`M${inset + cutSize} ${inset} H${outer} V${outer} H${inset} V${inset + cutSize} Z`}
        fill={fillCard}
        stroke={stroke}
        strokeWidth={strokeW}
      />
      {cells.map((row, y) =>
        row.map((on, x) => {
          if (!on) return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={originX + x * (cell + gap)}
              y={originY + y * (cell + gap)}
              width={cell}
              height={cell}
              rx={Math.max(0.35, size * 0.018)}
              fill={fillHole}
            />
          );
        }),
      )}
    </svg>
  );
}
