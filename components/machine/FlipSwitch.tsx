"use client";

type Props = {
  /** Short stamped label under the toggle (e.g. SEARCH / NEW). */
  label: string;
  /** When true, knob sits on the "on" side. */
  on?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** Compact housing for dense control bars. */
  size?: "md" | "sm";
};

/** IBM-style metal rocker / sliding toggle. */
export function FlipSwitch({ label, on = false, onClick, disabled, title, size = "md" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={on}
      className={`flip-switch${size === "sm" ? " flip-switch-sm" : ""}`}
    >
      <span className="flip-switch-housing" aria-hidden>
        <span className={`flip-switch-knob ${on ? "is-on" : ""}`} />
      </span>
      <span className="flip-switch-label">{label}</span>
    </button>
  );
}
