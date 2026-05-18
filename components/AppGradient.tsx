"use client";

import dynamic from "next/dynamic";

const GradientInner = dynamic(() => import("./AppGradientInner"), { ssr: false });

export function AppGradient({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none overflow-hidden print:hidden ${className ?? ""}`}
      aria-hidden
    >
      <GradientInner />
    </div>
  );
}
