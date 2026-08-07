import type { ReactNode } from "react";

/** Sparse punch-hole row for operator-style manila cards. */
export function HoleRow() {
  const holes = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0];
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {holes.map((filled, i) => (
        <span
          key={i}
          className="inline-block h-[7px] w-[7px]"
          style={{
            background: filled ? "var(--hole)" : "transparent",
            border: filled ? "none" : "1px solid color-mix(in srgb, var(--print-ink) 28%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

export type OperatorCardHeaderProps = {
  /** Left title, e.g. "Yarn card" — always `{Function} card`. */
  title: string;
  /** Right label: job code (`JOB YARN`) or tutorial step cols (`Col 01-05`). */
  colLabel: string;
  /** Extra content under the hole row (e.g. sr-only heading). */
  children?: ReactNode;
  className?: string;
};

/** Shared operator popup header: function title · job/col · hole row. */
export function OperatorCardHeader({
  title,
  colLabel,
  children,
  className,
}: OperatorCardHeaderProps) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase punch-print-faint">
          {title}
        </p>
        <p className="font-mono text-[9px] font-bold tracking-[0.12em] uppercase punch-print-faint">
          {colLabel}
        </p>
      </div>
      <div className="mt-2">
        <HoleRow />
        {children}
      </div>
    </div>
  );
}
