"use client";

import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import { useCallback, useEffect, useRef, useState } from "react";

const TUTORIAL_KEY = "gridwork_tutorial_seen";

type StepDef = {
  targetId: string;
  title: string;
  body: string;
};

const BASE_STEPS: StepDef[] = [
  {
    targetId: "tutorial-grid-size",
    title: "Set card size",
    body: "Use Stock and Size dials. Switch Size to Custom for W·H; Ratio locks proportions.",
  },
  {
    targetId: "tutorial-pencil",
    title: "Edit or lock",
    body: "Edit to draw on the grid. Lock to prevent changes while you stitch.",
  },
  {
    targetId: "tutorial-image-tools",
    title: "Import a reference",
    body: "Upload an image to trace or auto-convert onto the grid.",
  },
  {
    targetId: "tutorial-row-progress",
    title: "Track rows",
    body: "Step with ← Row / Row → and check off rows as you go.",
  },
  {
    targetId: "tutorial-print",
    title: "Print",
    body: "Save first, then Print opens a print-ready view.",
  },
];

const LOGIN_STEP: StepDef = {
  targetId: "tutorial-login",
  title: "Log in to save",
  body: "Guests lose work when the tab closes. Sign in for autosave.",
};

const SAVE_STEP: StepDef = {
  targetId: "tutorial-save",
  title: "Save your card",
  body: "Save keeps this program. Autosave runs once it’s stored.",
};

type Rect = { x: number; y: number; w: number; h: number };

const PAD = 8;
const CARD_W = 300;
const CARD_H_EST = 220;

function resolveSteps(): StepDef[] {
  const steps = BASE_STEPS.filter((s) => document.getElementById(s.targetId));
  if (document.getElementById(SAVE_STEP.targetId)) {
    steps.push(SAVE_STEP);
  } else if (document.getElementById(LOGIN_STEP.targetId)) {
    steps.push(LOGIN_STEP);
  }
  return steps;
}

function cardPosition(
  target: Rect | null,
  vp: { w: number; h: number },
): { left: number; top: number } {
  const margin = 16;
  if (!target || target.w <= 0) {
    return { left: margin, top: Math.max(margin, vp.h - CARD_H_EST - margin) };
  }

  const below = target.y + target.h + PAD + 12;
  const above = target.y - CARD_H_EST - 12;
  let top = below + CARD_H_EST <= vp.h - margin ? below : above >= margin ? above : margin;
  let left = target.x;
  if (left + CARD_W > vp.w - margin) left = vp.w - CARD_W - margin;
  if (left < margin) left = margin;
  if (top < margin) top = margin;
  if (top + CARD_H_EST > vp.h - margin) top = Math.max(margin, vp.h - CARD_H_EST - margin);
  return { left, top };
}

export type TutorialSpotlightProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TutorialSpotlight({ open, onOpenChange }: TutorialSpotlightProps) {
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const intervalRef = useRef<number | undefined>(undefined);

  const current = steps[step] ?? null;
  const isLastStep = steps.length > 0 && step === steps.length - 1;

  useEffect(() => {
    if (!open) return;
    const next = resolveSteps();
    setSteps(next);
    setStep(0);
  }, [open]);

  const updateRect = useCallback((stepIndex: number, list: StepDef[]) => {
    const currentStep = list[stepIndex];
    if (!currentStep) {
      setTargetRect(null);
      setVp({ w: window.innerWidth, h: window.innerHeight });
      return;
    }
    const el = document.getElementById(currentStep.targetId);
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    } else {
      setTargetRect(null);
    }
    setVp({ w: window.innerWidth, h: window.innerHeight });
  }, []);

  useEffect(() => {
    if (!open || steps.length === 0) return;
    updateRect(step, steps);
    window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => updateRect(step, steps), 150);
    return () => window.clearInterval(intervalRef.current);
  }, [open, step, steps, updateRect]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updateRect(step, steps);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, step, steps, updateRect]);

  const dismiss = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, "1");
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  const next = useCallback(() => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, steps.length, dismiss]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  if (!open || !current || steps.length === 0) return null;

  let overlayPath = `M 0 0 H ${vp.w} V ${vp.h} H 0 Z`;
  if (targetRect && targetRect.w > 0) {
    const rx = Math.max(0, targetRect.x - PAD);
    const ry = Math.max(0, targetRect.y - PAD);
    const rw = targetRect.w + PAD * 2;
    const rh = targetRect.h + PAD * 2;
    overlayPath += ` M ${rx} ${ry} H ${rx + rw} V ${ry + rh} H ${rx} Z`;
  }

  const pos = cardPosition(targetRect, vp);
  const colLabel = `Col ${String(step + 1).padStart(2, "0")}-${String(steps.length).padStart(2, "0")}`;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      <svg width={vp.w} height={vp.h} className="absolute inset-0" aria-hidden>
        <path d={overlayPath} fillRule="evenodd" fill="rgba(12, 7, 3, 0.52)" />
      </svg>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={current.title}
        className="pointer-events-auto punch-card absolute flex w-[300px] flex-col px-5 py-4"
        style={{
          left: pos.left,
          top: pos.top,
          ["--manila-stock" as string]: "#E8E2D0",
        }}
      >
        <OperatorCardHeader title="Tutorial card" colLabel={colLabel} />

        <div className="mt-3 flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-[3px] flex-1 transition-colors duration-300"
              style={{
                background:
                  i <= step
                    ? "var(--print-ink)"
                    : "color-mix(in srgb, var(--print-ink) 18%, transparent)",
              }}
            />
          ))}
        </div>

        <p className="mt-3 font-mono text-[9px] font-bold tracking-[0.14em] uppercase punch-print-faint">
          Step {step + 1} of {steps.length}
        </p>
        <h2 className="mt-0.5 font-mono text-[14px] font-bold tracking-[0.06em] uppercase punch-print-ink">
          {current.title}
        </h2>
        <p className="mt-2 font-mono text-[11px] leading-relaxed punch-print-ink opacity-80">
          {current.body}
        </p>

        {isLastStep && (
          <p className="mt-2 font-mono text-[10px] leading-relaxed punch-print-faint">
            Restart anytime with ? on the console.
          </p>
        )}

        <div className={`mt-4 flex gap-2 ${isLastStep ? "justify-end" : "items-center justify-between"}`}>
          {!isLastStep && (
            <button type="button" onClick={dismiss} className="punch-print text-[11px] opacity-70">
              Skip
            </button>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            {step > 0 && (
              <button type="button" onClick={prev} className="punch-print text-[11px] opacity-70">
                Back
              </button>
            )}
            <button type="button" onClick={next} className="punch-print text-[12px] tracking-[0.1em]">
              {step < steps.length - 1 ? "Next →" : "Get started"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** True when the user has not completed/skipped the tour yet. */
export function shouldAutoOpenTutorial(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(TUTORIAL_KEY);
}
