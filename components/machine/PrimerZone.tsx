"use client";

import { CrochetMark } from "@/components/CrochetMark";
import {
  C2C_PRIMER_SECTIONS,
  MOSAIC_PRIMER_SECTIONS,
  PRIMER_SECTIONS,
  TAPESTRY_PRIMER_SECTIONS,
} from "@/lib/primerContent";
import { useEffect, useState, type ReactNode, type TransitionEvent } from "react";

type PrimerZoneProps = {
  onStartTutorial?: () => void;
};

/** 0 = cover closed; 1 filet; 2 tapestry; 3 c2c; 4 mosaic */
const PAGE_MAX = 4;

type TechniqueLeaf = {
  id: string;
  leafClass: string;
  pageLabel: string;
  pageNum: string;
  sections: readonly { id: string; title: string; body: string }[];
  /** pageIndex when this leaf's front is the visible page */
  visibleAt: number;
  /** pageIndex at which this leaf is turned away */
  turnAt: number;
  prevLabel: string;
  nextLabel: string;
  betweenBlurb: string;
};

const TECHNIQUE_LEAVES: TechniqueLeaf[] = [
  {
    id: "filet",
    leafClass: "book-leaf-filet",
    pageLabel: "Filet crochet",
    pageNum: "01",
    sections: PRIMER_SECTIONS,
    visibleAt: 1,
    turnAt: 2,
    prevLabel: "← Cover",
    nextLabel: "Tapestry →",
    betweenBlurb: "Turning to tapestry crochet.",
  },
  {
    id: "tapestry",
    leafClass: "book-leaf-tapestry",
    pageLabel: "Tapestry crochet",
    pageNum: "02",
    sections: TAPESTRY_PRIMER_SECTIONS,
    visibleAt: 2,
    turnAt: 3,
    prevLabel: "← Filet",
    nextLabel: "C2C →",
    betweenBlurb: "Turning to corner-to-corner.",
  },
  {
    id: "c2c",
    leafClass: "book-leaf-c2c",
    pageLabel: "C2C crochet",
    pageNum: "03",
    sections: C2C_PRIMER_SECTIONS,
    visibleAt: 3,
    turnAt: 4,
    prevLabel: "← Tapestry",
    nextLabel: "Mosaic →",
    betweenBlurb: "Turning to mosaic.",
  },
];

function PrimerSpread({
  sections,
  startIndex,
}: {
  sections: readonly { id: string; title: string; body: string }[];
  startIndex: number;
}) {
  const mid = Math.ceil(sections.length / 2);
  const left = sections.slice(0, mid);
  const right = sections.slice(mid);

  return (
    <div className="grid min-h-0 flex-1 md:grid-cols-2">
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-white px-5 py-5 md:px-6">
          {left.map((s, i) => (
            <section key={s.id} className="min-h-0">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-[11px] font-bold text-[#2F5F9E]">
                  {String(startIndex + i).padStart(2, "0")}
                </span>
                <h2 className="m-0 font-mono text-[16px] font-bold text-ink md:text-[17px]">{s.title}</h2>
              </div>
              <p className="m-0 pl-7 font-sans text-[15px] leading-snug text-[#4A4E55]">{s.body}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-white px-5 py-5 md:px-6">
          {right.map((s, i) => (
            <section key={s.id} className="min-h-0">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-[11px] font-bold text-[#2F5F9E]">
                  {String(startIndex + mid + i).padStart(2, "0")}
                </span>
                <h2 className="m-0 font-mono text-[16px] font-bold text-ink md:text-[17px]">{s.title}</h2>
              </div>
              <p className="m-0 pl-7 font-sans text-[15px] leading-snug text-[#4A4E55]">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManualPageChrome({
  pageLabel,
  pageNum,
  children,
  footerLeft,
  footerRight,
}: {
  pageLabel: string;
  pageNum: string;
  children: ReactNode;
  footerLeft: ReactNode;
  footerRight: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[#D6DCE4] bg-[#2F5F9E] px-5 py-3">
        <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-white uppercase">
          Manual · {pageLabel}
        </span>
        <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-white/70 uppercase">
          Gridwork · p.{pageNum}
        </span>
      </div>
      {children}
      <div className="book-footer flex items-center justify-between gap-3 border-t border-[#D6DCE4] bg-white px-5 md:px-6">
        {footerLeft}
        {footerRight}
      </div>
    </div>
  );
}

function TechniqueLeafFace({
  leaf,
  pageIndex,
  flipping,
  navBtnClass,
  onPrev,
  onNext,
  onTransitionEnd,
}: {
  leaf: TechniqueLeaf;
  pageIndex: number;
  flipping: boolean;
  navBtnClass: string;
  onPrev: () => void;
  onNext: () => void;
  onTransitionEnd: (e: TransitionEvent<HTMLDivElement>) => void;
}) {
  const active = pageIndex === leaf.visibleAt;
  return (
    <div
      className={`book-leaf book-leaf-inner ${leaf.leafClass} absolute inset-0 origin-left`}
      onTransitionEnd={onTransitionEnd}
      aria-hidden={pageIndex < leaf.visibleAt || pageIndex >= leaf.turnAt}
    >
      <div className="book-leaf-front book-leaf-inner-front absolute inset-0 flex flex-col overflow-hidden">
        <ManualPageChrome
          pageLabel={leaf.pageLabel}
          pageNum={leaf.pageNum}
          footerLeft={
            <button
              type="button"
              onClick={onPrev}
              disabled={flipping || !active}
              className={navBtnClass}
            >
              {leaf.prevLabel}
            </button>
          }
          footerRight={
            <button
              type="button"
              onClick={onNext}
              disabled={flipping || !active}
              className={navBtnClass}
            >
              {leaf.nextLabel}
            </button>
          }
        >
          <PrimerSpread sections={leaf.sections} startIndex={1} />
        </ManualPageChrome>
        <span className="book-leaf-spine" aria-hidden />
        <span className="book-leaf-edge" aria-hidden />
      </div>
      <div className="book-leaf-back absolute inset-0 flex flex-col overflow-hidden" aria-hidden>
        <div className="flex flex-1 flex-col bg-white px-8 py-10 md:px-12 md:py-12">
          <p className="m-0 font-mono text-[10px] font-bold tracking-[0.2em] text-[#2F5F9E]/65 uppercase">
            Gridwork · Between pages
          </p>
          <div className="mt-6 h-px w-16 bg-[#2F5F9E]/35" />
          <p className="mt-6 max-w-[36ch] font-sans text-[15px] leading-relaxed text-[#4A4E55]">
            {leaf.betweenBlurb}
          </p>
        </div>
        <span className="book-leaf-spine book-leaf-spine-back" aria-hidden />
        <span className="book-leaf-thickness" aria-hidden />
      </div>
    </div>
  );
}

export function PrimerZone({ onStartTutorial }: PrimerZoneProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (!flipping) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : 1300;
    const t = window.setTimeout(() => setFlipping(false), ms);
    return () => window.clearTimeout(t);
  }, [flipping]);

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(PAGE_MAX, next));
    if (flipping || clamped === pageIndex) return;
    setFlipping(true);
    setPageIndex(clamped);
  }

  function onLeafTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    setFlipping(false);
  }

  const navBtnClass =
    "font-mono text-[12px] font-bold tracking-[0.12em] text-[#2F5F9E] uppercase transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-40";

  const stageClass = [
    "book-stage relative w-full max-w-5xl lg:max-w-6xl",
    pageIndex >= 1 ? " is-open" : "",
    pageIndex >= 2 ? " is-p2" : "",
    pageIndex >= 3 ? " is-p3" : "",
    pageIndex >= 4 ? " is-p4" : "",
    flipping ? " is-flipping" : "",
  ].join("");

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-paper px-3 py-4 md:px-8 md:py-6">
      <div className={stageClass}>
        {/* Base — mosaic (page 4) */}
        <div
          className="book-spread absolute inset-0 flex flex-col border border-[#3A3E44] bg-white"
          style={{ background: "#ffffff", minHeight: "min(78vh, 680px)" }}
          aria-hidden={pageIndex !== 4}
        >
          <div className="book-spread-shade" aria-hidden />
          <ManualPageChrome
            pageLabel="Mosaic crochet"
            pageNum="04"
            footerLeft={
              <button
                type="button"
                onClick={() => goTo(3)}
                disabled={flipping || pageIndex !== 4}
                className={navBtnClass}
              >
                ← C2C
              </button>
            }
            footerRight={
              <button
                type="button"
                onClick={() => onStartTutorial?.()}
                disabled={flipping || pageIndex !== 4 || !onStartTutorial}
                className={navBtnClass}
              >
                Go to tutorial →
              </button>
            }
          >
            <PrimerSpread sections={MOSAIC_PRIMER_SECTIONS} startIndex={1} />
          </ManualPageChrome>
        </div>

        {/* Technique leaves: C2C (inner-most), tapestry, filet — reverse DOM so outer stacks on top */}
        {[...TECHNIQUE_LEAVES].reverse().map((leaf) => (
          <TechniqueLeafFace
            key={leaf.id}
            leaf={leaf}
            pageIndex={pageIndex}
            flipping={flipping}
            navBtnClass={navBtnClass}
            onPrev={() => goTo(leaf.visibleAt - 1)}
            onNext={() => goTo(leaf.visibleAt + 1)}
            onTransitionEnd={onLeafTransitionEnd}
          />
        ))}

        {/* Cover */}
        <div
          className="book-leaf book-leaf-cover absolute inset-0 origin-left"
          onTransitionEnd={onLeafTransitionEnd}
        >
          <div className="book-leaf-front absolute inset-0 flex flex-col overflow-hidden">
            <div className="flex flex-1 flex-col justify-between px-8 py-10 md:px-12 md:py-12">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="m-0 font-mono text-[10px] font-bold tracking-[0.22em] text-white/65 uppercase">
                    Gridwork · Manual
                  </p>
                  <h1 className="mt-4 m-0 font-mono text-[clamp(32px,5.5vw,52px)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
                    Punch cards
                    <br />
                    for crochet charts.
                  </h1>
                  <p className="mt-5 max-w-[40ch] font-sans text-[16px] leading-relaxed text-white/85">
                    Filet, tapestry, C2C, and mosaic—open this{" "}
                    <span className="font-semibold text-white">Manual</span> for each technique.
                    New to the console? Go to <span className="font-semibold text-white">Program</span>, then{" "}
                    <span className="font-semibold text-white">?</span>.
                  </p>
                </div>
                <CrochetMark size={72} variant="onChassis" />
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-white/20 bg-white book-footer px-8 md:px-12">
              <button
                type="button"
                onClick={() => goTo(1)}
                disabled={flipping || pageIndex !== 0}
                className={navBtnClass}
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
                Pages: filet · tapestry · C2C · mosaic. Flip through for stitch guides and how to use Tracker.
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
