"use client";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  /** Accent ring when active — css color */
  accent?: string;
  size?: number;
};

/** IBM 129-style rotary selector — click dial to cycle options. */
export function RotaryKnob<T extends string>({
  label,
  value,
  options,
  onChange,
  accent = "#5B7EC9",
  size = 36,
}: Props<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const angle = options.length > 1 ? (idx / (options.length - 1 || 1)) * 240 - 120 : 0;
  const current = options[idx] ?? options[0];

  const cycle = () => {
    const next = options[(idx + 1) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className="punch-knob-metal group relative z-[2] cursor-pointer border-0 bg-transparent p-0"
      title={`${label}: ${current?.label ?? ""} (click to change)`}
      aria-label={`${label}: ${current?.label ?? ""}`}
    >
      <span
        className="punch-knob-metal-dial knob-live relative block"
        style={{
          width: size,
          height: size,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: 2,
            height: size * 0.32,
            marginLeft: -1,
            marginTop: -size * 0.32,
            background: accent,
            borderRadius: 1,
            transform: `rotate(${angle}deg)`,
            boxShadow: "0 0 2px rgba(0,0,0,0.5)",
            transition: "transform 0.1s ease-out, background 0.25s ease",
          }}
        />
      </span>
      <span className="punch-knob-metal-label mt-0.5 block text-center" style={{ color: accent, fontSize: 7 }}>
        {label}
      </span>
      <span className="block max-w-[4.5rem] truncate text-center font-mono text-[8px] font-bold tracking-[0.06em] text-card uppercase">
        {current?.label}
      </span>
    </button>
  );
}
