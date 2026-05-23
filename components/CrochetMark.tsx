export function CrochetMark({ size = 22, color = "#fff" }: { size?: number; color?: string }) {
  const cells = [
    [0,1,0,1,0],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [0,0,1,0,0],
  ];
  const n = cells[0].length;
  const cell = (size - n) / n;
  const rx = Math.max(0.5, cell * 0.28);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      {cells.map((row, y) => row.map((on, x) =>
        on ? <rect key={`${x}-${y}`} x={x*(cell+1)+0.5} y={y*(cell+1)+0.5} width={cell} height={cell} rx={rx} fill={color}/> : null
      ))}
    </svg>
  );
}
