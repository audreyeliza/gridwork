"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TUTORIAL_KEY = "gridwork_tutorial_seen";

const STEPS = [
  {
    targetId: "tutorial-grid-size",
    title: "Set your grid size",
    body: "Choose a preset or type custom Width and Height values. The lock icon between them keeps the aspect ratio proportional.",
  },
  {
    targetId: "tutorial-pencil",
    title: "Draw with the pencil",
    body: "Click or drag on the grid to fill squares. Switch to Eraser to clear them. Undo / Redo step through your changes.",
  },
  {
    targetId: "tutorial-image-tools",
    title: "Use an image reference",
    body: "Upload a photo as a reference. Underlay traces it transparently, Auto-convert maps it straight to the grid.",
  },
  {
    targetId: "tutorial-row-progress",
    title: "Track your rows",
    body: "Check off rows as you complete them. Use Prev row / Next row to move the yellow highlight to your current position.",
  },
  {
    targetId: "tutorial-print",
    title: "Print your pattern",
    body: "Save your pattern first (requires login), then Print opens a print-ready view you can save as a PDF.",
  },
  {
    targetId: "tutorial-login",
    title: "Log in to save",
    body: "Guest patterns disappear when you close the tab. Log in to save automatically every few seconds.",
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

  if (!visible) return null;

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
        className="pointer-events-auto absolute bottom-8 left-8 w-80 rounded-2xl border border-rose-100 bg-white shadow-2xl"
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

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-full border border-brand px-4 py-1.5 text-sm font-medium text-brand hover:bg-pink-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-brand px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
              >
                {step < STEPS.length - 1 ? "Next" : "Get started"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
