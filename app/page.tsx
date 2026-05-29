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
            <span className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full bg-white" />
              Home
            </span>
            <Link href="/learn" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Learn</Link>
            <Link href="/gallery" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Gallery</Link>
            <Link href="/editor" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Editor</Link>
          </nav>
        </div>
        <NavUserSection activePage="home" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 sm:px-6">
        <div className="w-full text-center" style={{ maxWidth: 720 }}>
          <h1
            className="font-serif font-bold tracking-[-0.025em] text-text-strong"
            style={{ fontSize: "clamp(44px,14vw,112px)", lineHeight: 0.95, margin: 0 }}
          >
            Gridwork
          </h1>

          <p
            className="mx-auto mt-5 w-full font-serif italic text-white"
            style={{ fontSize: "clamp(17px,5vw,24px)", lineHeight: 1.4, maxWidth: 540, textShadow: "0 1px 2px rgba(40,20,40,0.18)" }}
          >
            A grid tool built for filet crochet.
          </p>

          <p
            className="mx-auto mt-[14px] w-full font-sans font-medium text-white/95"
            style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 480, marginBottom: 40, textShadow: "0 1px 2px rgba(40,20,40,0.18)" }}
          >
            Sketch, share, stitch. Free to try, sign up to save.
          </p>

          <div className="flex flex-col items-stretch gap-[14px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Link
              href="/editor"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#A8466F] px-[30px] py-[15px] text-[15px] font-bold text-[#FBF7EF] transition-colors hover:bg-[#8B345A]"
              style={{ boxShadow: "0 8px 26px rgba(168,70,111,0.40)" }}
            >
              Start a pattern
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/gallery"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.6)] bg-[rgba(255,255,255,0.85)] px-[26px] py-[14px] text-[15px] font-bold text-[#1F1410] backdrop-blur-sm transition-colors hover:bg-white"
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
