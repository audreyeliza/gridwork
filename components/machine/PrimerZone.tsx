"use client";

import { CrochetMark } from "@/components/CrochetMark";
import { PRIMER_SECTIONS } from "@/lib/primerContent";
import { useEffect, useState, type TransitionEvent } from "react";

/**
 * Two-leaf IBM manual: cover overview → open spread (4 steps left, 4 right).
 * CSS 3D cover flip with two-sided leaf and under-spread reveal.
 */
type PrimerZoneProps = {
  /** Navigate to Program and start the interactive console tour. */
  onStartTutorial?: () => void;
};

export function PrimerZone({ onStartTutorial }: PrimerZoneProps) {
  const [open, setOpen] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const left = PRIMER_SECTIONS.slice(0, 4);
  const right = PRIMER_SECTIONS.slice(4, 8);

  // Safety net if transitionend is skipped (reduced motion, tab switch)
  useEffect(() => {
    if (!flipping) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : 1300;
    const t = window.setTimeout(() => setFlipping(false), ms);
    return () => window.clearTimeout(t);
  }, [flipping]);

  function startFlip(next: boolean) {
    if (flipping || open === next) return;
    setFlipping(true);
    setOpen(next);
  }

  function onLeafTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    setFlipping(false);
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-paper px-3 py-4 md:px-8 md:py-6">
      <div
        className={`book-stage relative w-full max-w-5xl lg:max-w-6xl${open ? " is-open" : ""}${flipping ? " is-flipping" : ""}`}
      >
        {/* Instruction spread — always under the cover leaf */}
        <div
          className="book-spread absolute inset-0 flex flex-col border border-[#3A3E44] bg-white"
          style={{ background: "#ffffff", minHeight: "min(78vh, 680px)" }}
          aria-hidden={!open}
        >
          <div className="book-spread-shade" aria-hidden />
          <div className="flex items-center justify-between border-b border-[#D6DCE4] bg-[#2F5F9E] px-5 py-3">
            <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-white uppercase">
              Operator menu
            </span>
            <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-white/70 uppercase">
              Gridwork
            </span>
          </div>
          <div className="grid min-h-0 flex-1 md:grid-cols-2">
            <div className="flex min-h-0 flex-col border-b border-[#D6DCE4] md:border-b-0">
              <div className="flex flex-1 flex-col gap-5 overflow-hidden bg-white px-5 py-5 md:px-6">
                {left.map((s, i) => (
                  <section key={s.id} className="min-h-0">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#2F5F9E]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="m-0 font-mono text-[16px] font-bold text-ink md:text-[17px]">{s.title}</h2>
                    </div>
                    <p className="m-0 pl-7 font-sans text-[15px] leading-snug text-[#4A4E55]">{s.body}</p>
                  </section>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="flex flex-1 flex-col gap-5 overflow-hidden bg-white px-5 py-5 md:px-6">
                {right.map((s, i) => (
                  <section key={s.id} className="min-h-0">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#2F5F9E]">
                        {String(i + 5).padStart(2, "0")}
                      </span>
                      <h2 className="m-0 font-mono text-[16px] font-bold text-ink md:text-[17px]">{s.title}</h2>
                    </div>
                    <p className="m-0 pl-7 font-sans text-[15px] leading-snug text-[#4A4E55]">{s.body}</p>
                  </section>
                ))}
              </div>
            </div>
          </div>

          <div className="book-footer flex items-center justify-between gap-3 border-t border-[#D6DCE4] bg-white px-5 md:px-6">
            <button
              type="button"
              onClick={() => startFlip(false)}
              disabled={flipping || !open}
              className="font-mono text-[12px] font-bold tracking-[0.12em] text-[#2F5F9E] uppercase transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-40"
            >
              ← Cover
            </button>
            <button
              type="button"
              onClick={() => onStartTutorial?.()}
              disabled={flipping || !open || !onStartTutorial}
              className="font-mono text-[12px] font-bold tracking-[0.12em] text-[#2F5F9E] uppercase transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-40"
            >
              Go to tutorial →
            </button>
          </div>
        </div>

        {/* Two-sided cover leaf */}
        <div
          className="book-leaf absolute inset-0 origin-left"
          onTransitionEnd={onLeafTransitionEnd}
        >
          <div className="book-leaf-front absolute inset-0 flex flex-col overflow-hidden">
            <div className="flex flex-1 flex-col justify-between px-8 py-10 md:px-12 md:py-12">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="m-0 font-mono text-[10px] font-bold tracking-[0.22em] text-white/65 uppercase">
                    Gridwork · Operator manual
                  </p>
                  <h1 className="mt-4 m-0 font-mono text-[clamp(32px,5.5vw,52px)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
                    Punch cards
                    <br />
                    for filet crochet.
                  </h1>
                  <p className="mt-4 max-w-[42ch] font-sans text-[17px] leading-relaxed text-white/85">
                    Design mesh patterns on manila stock and stitch them by hand.
                    Use <span className="font-semibold text-white">Hopper</span> on the
                    keyboard to browse community cards. Use{" "}
                    <span className="font-semibold text-white">Program</span> to punch a
                    new pattern.
                  </p>
                </div>
                <CrochetMark size={40} variant="onChassis" />
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-white/20 bg-white book-footer px-8 md:px-12">
              <button
                type="button"
                onClick={() => startFlip(true)}
                disabled={flipping || open}
                className="font-mono text-[12px] font-bold tracking-[0.12em] text-[#2F5F9E] uppercase transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-40"
              >
                Open manual →
              </button>
            </div>
            <span className="book-leaf-spine" aria-hidden />
            <span className="book-leaf-edge" aria-hidden />
          </div>

          <div className="book-leaf-back absolute inset-0 flex flex-col overflow-hidden" aria-hidden>
            <div className="flex flex-1 flex-col px-8 py-10 md:px-12 md:py-12">
              <p className="m-0 font-mono text-[10px] font-bold tracking-[0.2em] text-[#2F5F9E]/65 uppercase">
                Gridwork · Inside cover
              </p>
              <div className="mt-6 h-px w-16 bg-[#2F5F9E]/35" />
              <p className="mt-6 max-w-[36ch] font-sans text-[15px] leading-relaxed text-[#4A4E55]">
                Operator notes. Keep this leaf closed when feeding punch cards into the
                hopper.
              </p>
            </div>
            <div className="book-footer flex items-center border-t border-[#D6DCE4]/80 px-8 md:px-12">
              <span className="font-mono text-[12px] font-bold tracking-[0.14em] text-[#2F5F9E]/70 uppercase">
                Form GW-01
              </span>
            </div>
            <span className="book-leaf-spine book-leaf-spine-back" aria-hidden />
            <span className="book-leaf-thickness" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
