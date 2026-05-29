import type { Metadata } from "next";
import Link from "next/link";
import { CrochetMark } from "@/components/CrochetMark";
import { NavUserSection } from "@/components/NavUserSection";

export const metadata: Metadata = {
  title: "How to filet crochet — Gridwork",
  description: "A beginner-friendly guide to filet crochet: slip knot, foundation chain, double crochet, mesh squares, block squares, and reading a grid pattern.",
};

const SECTIONS = [
  {
    id: "needs",
    title: "What you'll need",
    body: "Smooth cotton yarn (worsted or fingering weight), a hook sized for your yarn, and scissors. No experience needed — filet is a great first project.",
  },
  {
    id: "slip",
    title: "Slip knot",
    body: "Make a small loop, pull the tail through, and place it on your hook. Tug both ends to snug it up. This anchors your whole piece.",
  },
  {
    id: "chain",
    title: "Foundation chain",
    body: "Count your grid squares, multiply by 2, then add 4. That's your starting chain. (A 10-square pattern = chain 24.) The 4 extra chains act as your first dc and first chain-1 space — your first double crochet goes into the 5th chain from the hook.",
  },
  {
    id: "dc",
    title: "Double crochet (dc)",
    body: "Yarn over → insert hook → yarn over and pull up a loop (3 loops on hook) → pull through 2 loops → pull through 2 loops. One dc. It's the only stitch filet uses. The height of a dc matches the width of a chain-1 space, so your grid squares will be perfectly square.",
  },
  {
    id: "mesh",
    title: "Open mesh square (empty cell)",
    body: "Dc into the next post, chain 1, skip 1, dc into the following post. That chain-1 gap is one open square on your grid.",
  },
  {
    id: "block",
    title: "Filled block square (filled cell)",
    body: "Dc into the next post, dc into the chain-1 space below, dc into the following post. Three dc in a row fill that square solid.",
  },
  {
    id: "turn",
    title: "Turning and working rows",
    body: "At the end of every row, chain 4 and turn. The chain-4 counts as your first dc plus first chain-1 space. Then work across: filled cell = dc into the chain space, empty cell = chain 1, skip 1. Repeat row by row from bottom to top.",
  },
  {
    id: "read",
    title: "Reading the grid",
    body: "Start bottom-left and work right. At the end of each row, chain 4 and turn — so every other row travels right to left. The chart doesn't flip, just your direction does. Work up row by row until you reach the top.",
  },
];

export default function LearnPage() {
  return (
    <div className="min-h-screen">
      {/* Transparent navbar */}
      <header className="z-20 flex h-[68px] items-center justify-between px-8">
        <div className="flex items-center gap-9">
          <Link
            href="/"
            className="inline-flex items-center gap-[9px] font-serif text-2xl font-bold leading-none tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"
          >
            <CrochetMark size={22} color="#fff" />
            Gridwork
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Home
            </Link>
            <span className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full bg-white" />
              Learn
            </span>
            <Link href="/gallery" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Gallery
            </Link>
            <Link href="/editor" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Editor
            </Link>
          </nav>
        </div>
        <NavUserSection activePage="learn" />
      </header>

      {/* Two-column layout: sticky TOC left + article card right */}
      <div
        className="mx-auto w-full max-w-[1080px] px-5 pb-16 pt-8 md:grid md:gap-12 md:px-12 md:[grid-template-columns:220px_1fr]"
      >
        {/* Sticky TOC */}
        <aside className="hidden md:block" style={{ paddingTop: 8, position: "sticky", top: 88, alignSelf: "flex-start" }}>
          <div
            className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white/85"
            style={{ marginBottom: 14, textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
          >
            On this page
          </div>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] font-semibold text-white/55" style={{ minWidth: 20 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <a
                  href={`#${s.id}`}
                  className="font-sans text-[13px] font-medium text-white/80 transition-colors hover:text-white"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        {/* Article card */}
        <article
          className="rounded-none px-5 py-8 md:rounded-[18px] md:px-12 md:py-10"
          style={{
            background: "#FBF7EF",
            boxShadow: "0 10px 40px rgba(40,20,30,0.12), 0 0 0 1px rgba(255,255,255,0.5)",
          }}
        >
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand" style={{ marginBottom: 12 }}>
            Primer · 8 sections
          </div>
          <h1
            className="font-serif font-bold tracking-[-0.02em] text-text-strong"
            style={{ fontSize: "clamp(28px,7vw,46px)", lineHeight: 1.05, margin: 0 }}
          >
            How to filet crochet
          </h1>
          <p
            className="font-serif italic font-normal text-foreground"
            style={{ fontSize: 18, lineHeight: 1.5, margin: "12px 0 32px", maxWidth: "60ch" }}
          >
            With just two squares you can stitch anything you can draw.
          </p>

          <div className="flex flex-col gap-8">
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id}>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="font-mono text-[11px] font-semibold tracking-[0.10em] text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2
                    className="font-serif font-bold tracking-[-0.01em] text-text-strong"
                    style={{ fontSize: 22, lineHeight: 1.2, margin: 0 }}
                  >
                    {s.title}
                  </h2>
                </div>
                <p className="font-sans font-medium text-foreground" style={{ fontSize: 15.5, lineHeight: 1.65, margin: 0 }}>
                  {s.body}
                </p>
              </section>
            ))}
          </div>

          {/* CTA */}
          <div
            className="mt-11 border-t pt-8 text-center"
            style={{ borderColor: "rgba(61,42,30,0.10)" }}
          >
            <p className="font-sans text-sm font-medium text-muted">Ready to design your own pattern?</p>
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3 text-sm font-bold text-[#FBF7EF] transition-colors hover:bg-brand-dark"
              style={{ boxShadow: "0 6px 20px rgba(168,70,111,0.30)", marginTop: 14 }}
            >
              Open the editor
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
