"use client";

type Props = {
  /** Short stamped label under the toggle (e.g. CLEAR). Omit when unlabeled. */
  label?: string;
  /** Fixed label above the housing (vertical dual-label mode). */
  topLabel?: string;
  /** Fixed label below the housing (vertical dual-label mode). */
  bottomLabel?: string;
  /** When true, knob sits on the "on" side (bottom for vertical). */
  on?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** Compact housing for dense control bars. */
  size?: "md" | "sm";
  /** Slide axis — hopper search uses vertical. */
  orientation?: "horizontal" | "vertical";
};

/** IBM-style metal rocker / sliding toggle. */
export function FlipSwitch({
  label,
  topLabel,
  bottomLabel,
  on = false,
  onClick,
  disabled,
  title,
  size = "md",
  orientation = "horizontal",
}: Props) {
  const dualLabel = Boolean(topLabel && bottomLabel);
  const activeLabel = dualLabel ? (on ? bottomLabel : topLabel) : label;
  const accessibleName = title ?? activeLabel ?? "Toggle";
  const classes = [
    "flip-switch",
    size === "sm" ? "flip-switch-sm" : "",
    orientation === "vertical" ? "flip-switch-vertical" : "",
    dualLabel ? "flip-switch-dual" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={accessibleName}
      aria-label={accessibleName}
      aria-pressed={on}
      className={classes}
    >
      {dualLabel && (
        <span
          className={`flip-switch-label ${on ? "is-inactive" : ""}`}
          aria-hidden
        >
          {topLabel}
        </span>
      )}
      <span className="flip-switch-housing" aria-hidden>
        <span className={`flip-switch-knob ${on ? "is-on" : ""}`} />
      </span>
      {dualLabel ? (
        <span
          className={`flip-switch-label ${on ? "" : "is-inactive"}`}
          aria-hidden
        >
          {bottomLabel}
        </span>
      ) : (
        /* Always reserve label row so the housing doesn’t jump when Clear appears */
        <span className="flip-switch-label" aria-hidden={!label}>
          {label || "\u00A0"}
        </span>
      )}
    </button>
  );
}
