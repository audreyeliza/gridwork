"use client";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  /** Color for the stamped control label / value text. */
  accent?: string;
  /** Dial indicator line color. */
  pointer?: string;
  /** Dial face fill (css color). Defaults to metal gray. */
  dial?: string;
  size?: number;
};

const DEFAULT_DIAL =
  "radial-gradient(circle at 35% 28%, #d4d8dc 0%, #8A8F96 45%, #4A4E55 100%)";

/** IBM 129-style rotary selector — click dial to cycle options. */
export function RotaryKnob<T extends string>({
  label,
  value,
  options,
  onChange,
  accent = "#5B7EC9",
  pointer,
  dial,
  size = 36,
}: Props<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const angle = options.length > 1 ? (idx / (options.length - 1 || 1)) * 240 - 120 : 0;
  const current = options[idx] ?? options[0];
  const pointerColor = pointer ?? accent;
  const dialFill = dial
    ? `radial-gradient(circle at 35% 28%, color-mix(in srgb, ${dial} 75%, white) 0%, ${dial} 48%, color-mix(in srgb, ${dial} 70%, black) 100%)`
    : DEFAULT_DIAL;

  const cycle = () => {
    const next = options[(idx + 1) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className="punch-knob-metal group relative z-[2] w-[4.75rem] cursor-pointer border-0 bg-transparent p-0"
      title={`${label}: ${current?.label ?? ""} (click to change)`}
      aria-label={`${label}: ${current?.label ?? ""}`}
    >
      <span
        className="punch-knob-metal-dial knob-live relative mx-auto block"
        style={{
          width: size,
          height: size,
          background: dialFill,
          ...(dial ? { borderColor: dial } : null),
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
            background: pointerColor,
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
      <span
        className="block w-full truncate text-center font-mono text-[8px] font-bold tracking-[0.06em] uppercase"
        style={{ color: accent }}
      >
        {current?.label}
      </span>
    </button>
  );
}
