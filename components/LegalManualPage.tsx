import Link from "next/link";
import { MachineKeyboardBar } from "@/components/machine/MachineKeyboardBar";

type Section = { id: string; title: string; body: string };

type Props = {
  title: string;
  updated: string;
  sections: readonly Section[];
  otherHref: string;
  otherLabel: string;
};

/** Privacy / Terms as a white operator-manual leaf (not manila punch card). */
export function LegalManualPage({ title, updated, sections, otherHref, otherLabel }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 md:px-8 md:py-10">
        <article
          className="flex flex-1 flex-col border border-[#3A3E44] bg-white shadow-[4px_8px_0_rgba(74,78,85,0.15)]"
          style={{ background: "#ffffff" }}
        >
          <div className="flex items-center justify-between border-b border-[#D6DCE4] bg-[#2F5F9E] px-5 py-3">
            <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-white uppercase">
              {title}
            </span>
            <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-white/70 uppercase">
              Gridwork
            </span>
          </div>

          <div className="flex flex-1 flex-col px-5 py-5 md:px-6">
            <h1 className="m-0 font-mono text-[clamp(26px,5vw,36px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-2 mb-8 font-mono text-[12px] text-muted">
              Last updated: {updated}
            </p>

            <div className="flex flex-col gap-5">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id}>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#2F5F9E]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="m-0 font-mono text-[16px] font-bold text-ink md:text-[17px]">
                      {s.title}
                    </h2>
                  </div>
                  <p className="m-0 pl-7 font-sans text-[15px] leading-snug text-[#4A4E55]">
                    {s.body}
                  </p>
                </section>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[#D6DCE4] bg-white px-5 py-4 md:px-6">
            <Link
              href="/?zone=primer"
              className="font-mono text-[12px] font-bold tracking-[0.12em] text-[#2F5F9E] uppercase no-underline hover:opacity-70"
            >
              ← Manual
            </Link>
            <Link
              href={otherHref}
              className="font-mono text-[12px] font-bold tracking-[0.12em] text-[#2F5F9E] uppercase no-underline hover:opacity-70"
            >
              {otherLabel} →
            </Link>
          </div>
        </article>
      </main>

      {/* Keep Privacy / Terms visible on the keyboard bar */}
      <MachineKeyboardBar />
    </div>
  );
}
