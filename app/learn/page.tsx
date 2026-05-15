import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to filet crochet — Gridwork",
  description: "A beginner-friendly guide to filet crochet: slip knot, foundation chain, double crochet, mesh squares, block squares, and reading a grid pattern.",
};

export default function LearnPage() {
  return (
    <div className="min-h-screen text-stone-800">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-white/40 bg-white/80 px-4 py-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-serif text-xl font-bold text-brand hover:text-brand-dark">
            Gridwork
          </Link>
          <span className="text-sm font-medium text-gray-700">Learn</span>
        </div>
        <Link
          href="/editor"
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D4457F]"
        >
          Open editor
        </Link>
      </header>

      <div className="mx-auto max-w-2xl px-6 pb-32 pt-12">
        <div className="rounded-2xl bg-white/75 px-10 py-12 backdrop-blur-sm">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">
            How to make filet crochet
          </h1>
          <p className="mt-3 text-base leading-relaxed text-stone-600">
            Filet crochet uses double crochet and chain stitches to build a grid of solid and open squares. Once you can make those two squares, you can stitch any pattern you can draw on graph paper.
          </p>

          <div className="mt-10 flex flex-col gap-10">

            <section>
              <h2 className="text-xl font-semibold text-accent">What you'll need</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">
                A smooth cotton yarn (worsted or fingering weight are easiest to learn with), a crochet hook sized for your yarn (check the label), and scissors. No prior crochet experience is required beyond knowing how to hold a hook — filet is a great first project.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-accent">Slip knot</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">
                Make a small loop, then pull the tail end through the loop and place it on your hook. Pull the tail and the working yarn in opposite directions to snug it up. This is your first stitch and anchors everything that follows.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-accent">Foundation chain</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">
                Yarn over and pull through the loop on your hook — that's one chain stitch. Repeat until your chain is as long as your pattern requires, plus 3 extra turning chains (they count as the first double crochet of row 1). Each "v" on the chain is one stitch.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-accent">Double crochet (dc)</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">
                Yarn over → insert hook into the stitch → yarn over and pull up a loop (3 loops on hook) → yarn over and pull through 2 loops (2 loops remain) → yarn over and pull through 2 loops (1 loop remains). That's one double crochet. It's the only stitch you need for filet.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-accent">Open mesh square (empty square)</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">
                Chain 2, skip 2 stitches, work 1 dc into the next stitch. The chain-2 and the two surrounding dc posts form one open, airy square in your grid. In your pattern this is any empty cell.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-accent">Filled block square (filled square)</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">
                Work 3 dc into consecutive stitches (or into the chain-2 space from the row below). Those 3 dc fill the same footprint as one mesh square and create a solid block. In your pattern this is any filled cell.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-accent">Reading a filet crochet grid</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">
                Start at the bottom-left corner of your grid pattern and work right across row 1. At the end of the row, chain 3 (counts as 1 dc) and turn your work. Row 2 goes left to right again. A filled cell means 3 dc; an empty cell means ch 2, skip 2, dc. Follow the grid row by row until you reach the top.
              </p>
            </section>

          </div>

          <div className="mt-14 border-t border-brand/15 pt-8 text-center">
            <p className="text-stone-500">Ready to design your own pattern?</p>
            <Link
              href="/editor"
              className="mt-3 inline-block rounded-full bg-brand px-8 py-3 text-base font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#D4457F] hover:shadow-lg"
            >
              Open the editor →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
