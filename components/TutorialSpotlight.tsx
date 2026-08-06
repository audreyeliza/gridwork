"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TUTORIAL_KEY = "gridwork_tutorial_seen";

const STEPS = [
  {
    targetId: "tutorial-grid-size",
    title: "Set your grid size",
    body: "Pick a preset or enter Width and Height. The lock keeps the aspect ratio.",
  },
  {
    targetId: "tutorial-pencil",
    title: "Choose your draw mode",
    body: "Block fills a square; Mesh leaves it open. Click or drag to draw. Double-click a cell to flip modes.",
  },
  {
    targetId: "tutorial-image-tools",
    title: "Yarn or import",
    body: "Estimate yarn for your grid, or upload an image to trace or auto-convert.",
  },
  {
    targetId: "tutorial-row-progress",
    title: "Track your rows",
    body: "Step through rows with ← Row / Row →. Check them off below the grid as you stitch.",
  },
  {
    targetId: "tutorial-print",
    title: "Print your pattern",
    body: "Save first, then Print opens a print-ready view.",
  },
  {
    targetId: "tutorial-login",
    title: "Log in to save",
    body: "Guests lose work when the tab closes. Log in for autosave.",
  },
];

type Rect = { x: number; y: number; w: number; h: number };

const PAD = 8;
const TOOLTIP_W = 300;

export function TutorialSpotlight() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) setVisible(true);
  }, []);

  const updateRect = useCallback((stepIndex: number) => {
    const current = STEPS[stepIndex];
    if (!current) return;
    const el = document.getElementById(current.targetId);
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    } else {
      setTargetRect(null);
    }
    setVp({ w: window.innerWidth, h: window.innerHeight });
  }, []);

  useEffect(() => {
    if (!visible) return;
    updateRect(step);
    window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => updateRect(step), 150);
    return () => window.clearInterval(intervalRef.current);
  }, [visible, step, updateRect]);

  useEffect(() => {
    if (!visible) return;
    const onResize = () => updateRect(step);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [visible, step, updateRect]);

  const dismiss = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, "1");
    setVisible(false);
  }, []);

  const restart = useCallback(() => {
    setStep(0);
    setVisible(true);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const isLastStep = step === STEPS.length - 1;

  if (!visible) {
    return (
      <button
        type="button"
        onClick={restart}
        title="Restart tutorial"
        className="fixed bottom-6 right-6 z-[199] flex h-9 w-9 items-center justify-center rounded-full border border-brand/15 bg-white text-sm font-bold text-brand shadow-md transition-colors hover:bg-brand/10"
      >
        ?
      </button>
    );
  }

  const current = STEPS[step]!;

  let overlayPath = `M 0 0 H ${vp.w} V ${vp.h} H 0 Z`;
  if (targetRect && targetRect.w > 0) {
    const rx = Math.max(0, targetRect.x - PAD);
    const ry = Math.max(0, targetRect.y - PAD);
    const rw = targetRect.w + PAD * 2;
    const rh = targetRect.h + PAD * 2;
    overlayPath += ` M ${rx} ${ry} H ${rx + rw} V ${ry + rh} H ${rx} Z`;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      <svg
        width={vp.w}
        height={vp.h}
        className="absolute inset-0"
        aria-hidden
      >
        <path d={overlayPath} fillRule="evenodd" fill="rgba(12, 7, 3, 0.52)" />
      </svg>

      <div
        className="pointer-events-auto absolute bottom-8 left-8 w-80 rounded-2xl border border-brand/15 bg-white shadow-2xl"
      >
        <div className="flex gap-1 p-4 pb-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-brand" : "bg-stone-100"
              }`}
            />
          ))}
        </div>

        <div className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-stone-800">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{current.body}</p>

          {isLastStep && (
            <p className="mt-3 text-xs leading-relaxed text-stone-400">
              You can restart this tutorial anytime using the ? button in the bottom corner.
            </p>
          )}

          <div className={`mt-4 flex gap-2 ${isLastStep ? "justify-end" : "items-center justify-between"}`}>
            {!isLastStep && (
              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
              >
                Skip tour
              </button>
            )}
            <div className="flex flex-wrap justify-end gap-1.5">
              {step > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-full border border-brand px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10"
                >
                  Back
                </button>
              )}
              {isLastStep && (
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-full border border-brand px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10"
                >
                  Take the tour again
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-brand-dark"
              >
                {step < STEPS.length - 1 ? "Next →" : "Get started"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
