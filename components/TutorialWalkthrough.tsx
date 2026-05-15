"use client";

import { useCallback, useEffect, useState } from "react";

const TUTORIAL_KEY = "gridwork_tutorial_seen";

const STEPS = [
  {
    title: "Set your grid size",
    body: "Choose a preset (Pillow front, Bookmark, etc.) or type custom Width and Height values. The lock icon between them keeps the aspect ratio proportional as you resize.",
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
        <rect x="4" y="10" width="14" height="20" rx="2" stroke="#e11d48" strokeWidth="2" fill="#fff1f2" />
        <rect x="22" y="10" width="14" height="20" rx="2" stroke="#e11d48" strokeWidth="2" fill="#fff1f2" />
        <path d="M18 20h4" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2" fill="#e11d48" />
      </svg>
    ),
  },
  {
    title: "Draw with the pencil",
    body: "Click or drag on the grid to fill squares. Switch to the Eraser to clear them. Use Undo / Redo to step back through your changes.",
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
        <rect x="6" y="6" width="28" height="28" rx="3" stroke="#d97706" strokeWidth="2" fill="#fffbeb" />
        {[0,1,2].map((r) => [0,1,2].map((c) => (
          <rect key={`${r}-${c}`} x={9 + c*10} y={9 + r*10} width={8} height={8} rx="1"
            fill={(r===1&&c===1)||(r===0&&c===2) ? "#f472b6" : "#fdf4ff"} />
        )))}
        <path d="M30 10l2 2-8 8-2-2z" fill="#e11d48" opacity="0.7" />
      </svg>
    ),
  },
  {
    title: "Use an image reference",
    body: "Upload a photo or sketch as a reference. Use Underlay to trace it transparently, or Auto-convert to map it straight to the grid. Crop to focus on part of the image, and adjust X/Y offset to reposition it.",
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
        <rect x="4" y="8" width="22" height="18" rx="2" stroke="#7c3aed" strokeWidth="2" fill="#f5f3ff" />
        <circle cx="11" cy="15" r="3" fill="#a78bfa" />
        <path d="M4 22l6-6 5 5 4-4 7 7" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="18" y="20" width="18" height="14" rx="2" stroke="#7c3aed" strokeWidth="2" fill="white" opacity="0.9" />
        <path d="M22 24h10M22 28h6" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Track your rows",
    body: "The row tracker on the left of the grid lets you check off rows as you complete them. Use Prev row / Next row buttons to move the yellow highlight that marks your current position.",
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="3" stroke="#d97706" strokeWidth="2" fill="#fffbeb" />
        {[0,1,2,3].map((r) => (
          <rect key={r} x="4" y={4+r*8} width="32" height="8"
            fill={r===1 ? "rgba(253,224,71,0.5)" : "transparent"} />
        ))}
        <path d="M8 12l2.5 2.5L15 10" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 20l2.5 2.5L15 18" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {[0,1,2,3].map((r) => (
          <line key={r} x1="4" y1={4+r*8} x2="36" y2={4+r*8} stroke="#d97706" strokeWidth="0.5" />
        ))}
      </svg>
    ),
  },
  {
    title: "Print your pattern",
    body: "Save your pattern first (you need to be logged in), then click Print to open a print-ready view. You can print or save it as a PDF to take to your yarn project.",
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
        <rect x="6" y="14" width="28" height="16" rx="2" stroke="#0284c7" strokeWidth="2" fill="#f0f9ff" />
        <rect x="10" y="6" width="20" height="12" rx="1" stroke="#0284c7" strokeWidth="2" fill="white" />
        <rect x="10" y="26" width="20" height="10" rx="1" stroke="#0284c7" strokeWidth="2" fill="white" />
        <path d="M14 30h12M14 33h8" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="29" cy="20" r="2" fill="#0284c7" />
      </svg>
    ),
  },
  {
    title: "Log in to save",
    body: "Guest patterns aren't saved when you close the tab. Click Log in in the top-right corner to create a free account. Your work saves automatically every few seconds once you're signed in.",
    icon: (
      <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
        <circle cx="20" cy="14" r="6" stroke="#e11d48" strokeWidth="2" fill="#fff1f2" />
        <path d="M6 34c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 26l4 4-4 4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 30h12" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function TutorialWalkthrough() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) setVisible(true);
  }, []);

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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]"
        aria-label="Dismiss tutorial"
        onClick={dismiss}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-rose-100 bg-white shadow-2xl">
        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-rose-400" : "bg-stone-100"
              }`}
            />
          ))}
        </div>

        <div className="p-6">
          {/* Icon + step label */}
          <div className="mb-4 flex items-start gap-4">
            <div className="shrink-0">{current.icon}</div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-rose-400">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-stone-800">{current.title}</h2>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-stone-600">{current.body}</p>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-sm text-stone-400 hover:text-stone-600"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-rose-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-600"
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
