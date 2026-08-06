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
  // Compact G inset from the cut — only solid holes, rest is plain manila
  const cells = [
    [0, 0, 1, 1, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 1, 1],
    [0, 1, 0, 0, 1],
    [0, 0, 1, 1, 0],
  ];
  const n = 5;
  const pad = 3;
  const gap = 1.1;
  const inner = size - pad * 2;
  const cell = (inner - gap * (n - 1)) / n;
  const cutSize = 6;

  const fillCard = variant === "mono" ? "currentColor" : "#F2EDD3";
  const fillHole = variant === "mono" ? "currentColor" : "#2C2C2C";
  const stroke = variant === "mono" ? "currentColor" : "#D6CCA8";
  const cut = variant === "mono" ? "currentColor" : variant === "onChassis" ? "#62676E" : "#B2B7BC";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d={`M${pad + cutSize} ${pad} H${size - pad} V${size - pad} H${pad} V${pad + cutSize} Z`}
        fill={fillCard}
        stroke={stroke}
        strokeWidth={1}
      />
      <path
        d={`M${pad} ${pad + cutSize} L${pad + cutSize} ${pad} L${pad + cutSize} ${pad + cutSize} Z`}
        fill={cut}
      />
      {cells.map((row, y) =>
        row.map((on, x) => {
          if (!on) return null;
          // Never draw in/near the cut triangle
          if (x === 0 || (x === 1 && y === 0)) return null;
          const cx = pad + x * (cell + gap);
          const cy = pad + y * (cell + gap);
          return (
            <rect
              key={`${x}-${y}`}
              x={cx}
              y={cy}
              width={cell}
              height={cell * 0.82}
              rx={0.5}
              fill={fillHole}
            />
          );
        }),
      )}
    </svg>
  );
}
