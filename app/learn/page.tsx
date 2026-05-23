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
    body: "A smooth cotton yarn (worsted or fingering weight are easiest to learn with), a crochet hook sized for your yarn (check the label), and scissors. No prior crochet experience is required beyond knowing how to hold a hook — filet is a great first project.",
  },
  {
    id: "slip",
    title: "Slip knot",
    body: "Make a small loop, then pull the tail end through the loop and place it on your hook. Pull the tail and the working yarn in opposite directions to snug it up. This is your first stitch and anchors everything that follows.",
  },
  {
    id: "chain",
    title: "Foundation chain",
    body: "Yarn over and pull through the loop on your hook — that's one chain stitch. Repeat until your chain is as long as your pattern requires, plus 3 extra turning chains (they count as the first double crochet of row 1). Each “v” on the chain is one stitch.",
  },
  {
    id: "dc",
    title: "Double crochet (dc)",
    body: "Yarn over → insert hook into the stitch → yarn over and pull up a loop (3 loops on hook) → yarn over and pull through 2 loops (2 loops remain) → yarn over and pull through 2 loops (1 loop remains). That's one double crochet. It's the only stitch you need for filet.",
  },
  {
    id: "mesh",
    title: "Open mesh square",
    body: "Chain 2, skip 2 stitches, work 1 dc into the next stitch. The chain-2 and the two surrounding dc posts form one open, airy square in your grid. In your pattern this is any empty cell.",
  },
  {
    id: "block",
    title: "Filled block square",
    body: "Work 3 dc into consecutive stitches (or into the chain-2 space from the row below). Those 3 dc fill the same footprint as one mesh square and create a solid block. In your pattern this is any filled cell.",
  },
  {
    id: "read",
    title: "Reading the grid",
    body: "Start at the bottom-left corner of your grid pattern and work right across row 1. At the end of the row, chain 3 (counts as 1 dc) and turn your work. Row 2 goes left to right again. A filled cell means 3 dc; an empty cell means ch 2, skip 2, dc. Follow the grid row by row until you reach the top.",
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
            <Link href="/" className="text-sm font-semibold text-white/85 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              Home
            </Link>
            <span className="inline-flex items-center gap-[7px] text-sm font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="inline-block size-[6px] rounded-full bg-white" />
              Learn
            </span>
            <Link href="/gallery" className="text-sm font-semibold text-white/85 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              Gallery
            </Link>
            <Link href="/editor" className="text-sm font-semibold text-white/85 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              Editor
            </Link>
          </nav>
        </div>
        <NavUserSection activePage="learn" />
      </header>

      {/* Two-column layout: sticky TOC left + article card right */}
      <div
        className="mx-auto w-full px-12 pb-16 pt-8"
        style={{ maxWidth: 1080, display: "grid", gridTemplateColumns: "220px 1fr", gap: 48 }}
      >
        {/* Sticky TOC */}
        <aside style={{ paddingTop: 8, position: "sticky", top: 88, alignSelf: "flex-start" }}>
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
          className="rounded-[18px]"
          style={{
            background: "#FBF7EF",
            padding: "40px 48px 48px",
            boxShadow: "0 10px 40px rgba(40,20,30,0.12), 0 0 0 1px rgba(255,255,255,0.5)",
          }}
        >
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand" style={{ marginBottom: 12 }}>
            Primer · 7 sections
          </div>
          <h1
            className="font-serif font-bold tracking-[-0.02em] text-text-strong"
            style={{ fontSize: 46, lineHeight: 1.05, margin: 0 }}
          >
            How to make filet crochet
          </h1>
          <p
            className="font-serif italic font-normal text-foreground"
            style={{ fontSize: 18, lineHeight: 1.5, margin: "12px 0 32px", maxWidth: "60ch" }}
          >
            Two squares — open and filled — and you can stitch anything you can draw on graph paper.
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
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
