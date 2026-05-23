"use client";

import { CrochetMark } from "@/components/CrochetMark";
import { NavUserSection } from "@/components/NavUserSection";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <header className="z-20 flex h-[68px] items-center justify-between px-8">
        <div className="flex items-center gap-9">
          <span className="inline-flex items-center gap-[9px] font-serif text-2xl font-bold leading-none tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
            <CrochetMark size={22} color="#fff" />
            Gridwork
          </span>
          <nav className="hidden items-center gap-7 md:flex">
            <span className="inline-flex items-center gap-[7px] text-sm font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="inline-block size-[6px] rounded-full bg-white" />
              Home
            </span>
            <Link href="/learn" className="text-sm font-semibold text-white/85 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">Learn</Link>
            <Link href="/gallery" className="text-sm font-semibold text-white/85 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">Gallery</Link>
            <Link href="/editor" className="text-sm font-semibold text-white/85 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">Editor</Link>
          </nav>
        </div>
        <NavUserSection activePage="home" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="text-center" style={{ maxWidth: 720 }}>
          <h1
            className="font-serif font-bold tracking-[-0.025em] text-text-strong"
            style={{ fontSize: 112, lineHeight: 0.95, margin: 0 }}
          >
            Gridwork
          </h1>

          <p
            className="mx-auto mt-5 font-serif italic text-white"
            style={{ fontSize: 24, lineHeight: 1.4, maxWidth: 540, textShadow: "0 1px 2px rgba(40,20,40,0.18)" }}
          >
            Design filet crochet patterns by tapping squares on a grid.
          </p>

          <p
            className="mx-auto mt-[14px] font-sans font-medium text-white/95"
            style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 480, marginBottom: 40, textShadow: "0 1px 2px rgba(40,20,40,0.18)" }}
          >
            Save them, share them, stitch them. A browser tool for charting filet — no signup needed for your first save.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-[14px]">
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 rounded-full bg-[#A8466F] px-[30px] py-[15px] text-[15px] font-bold text-[#FBF7EF] transition-colors hover:bg-[#8B345A]"
              style={{ boxShadow: "0 8px 26px rgba(168,70,111,0.40)" }}
            >
              Start a pattern
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/gallery"
              className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.6)] bg-[rgba(255,255,255,0.85)] px-[26px] py-[14px] text-[15px] font-bold text-[#1F1410] backdrop-blur-sm transition-colors hover:bg-white"
              style={{ boxShadow: "0 4px 18px rgba(40,20,30,0.10)" }}
            >
              Browse gallery
            </Link>
          </div>

          <Link
            href="/learn"
            className="mt-[30px] inline-block border-b border-[rgba(255,255,255,0.5)] pb-[2px] font-sans text-[14px] font-semibold text-white/95 transition-colors hover:border-white hover:text-white"
            style={{ textShadow: "0 1px 2px rgba(40,20,40,0.18)" }}
          >
            New to filet crochet? Read the primer →
          </Link>
        </div>
      </main>
    </div>
  );
}
