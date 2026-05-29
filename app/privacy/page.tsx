import type { Metadata } from "next";
import Link from "next/link";
import { CrochetMark } from "@/components/CrochetMark";
import { NavUserSection } from "@/components/NavUserSection";

export const metadata: Metadata = {
  title: "Gridwork",
  description: "How Gridwork collects, uses, and stores your data.",
};

const SECTIONS = [
  {
    id: "collect",
    title: "What we collect",
    body: "When you create an account, we collect your email address through Supabase Auth. We also store the patterns you create, including grid data, pattern names, yarn settings, and any thumbnail images. We store a display name and optional avatar you choose for your public profile. We do not collect payment information, physical addresses, or any sensitive personal data.",
  },
  {
    id: "use",
    title: "How we use it",
    body: "Your email is used only to authenticate your account. We do not send marketing emails. Your patterns are stored so you can access them across devices. Patterns you mark as public are visible to other users in the gallery.",
  },
  {
    id: "stored",
    title: "How it's stored",
    body: "All data is stored on Supabase, a hosted PostgreSQL database service, in the United States. You can read Supabase's privacy policy at supabase.com/privacy.",
  },
  {
    id: "visible",
    title: "What others can see",
    body: "Your display name, avatar, and any patterns you mark as public are visible to anyone. Your email address is never shown publicly.",
  },
  {
    id: "rights",
    title: "Your rights",
    body: "You can delete your account and all associated patterns by contacting us at gridworkapp@gmail.com. If you are in the EU or UK, you have the right to request a copy of your data or ask us to delete it.",
  },
  {
    id: "children",
    title: "Children",
    body: "Gridwork is not directed at children under 13 and we do not knowingly collect data from anyone under 13. If you believe a child has created an account, contact us at gridworkapp@gmail.com and we will delete it.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "gridworkapp@gmail.com",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
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
            <Link href="/learn" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Learn
            </Link>
            <Link href="/gallery" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Gallery
            </Link>
            <Link href="/editor" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Editor
            </Link>
          </nav>
        </div>
        <NavUserSection activePage={null} />
      </header>

      <div className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-8 md:px-12">
        <article
          className="rounded-[18px] px-5 py-8 md:px-12 md:py-10"
          style={{
            background: "#FBF7EF",
            boxShadow: "0 10px 40px rgba(40,20,30,0.12), 0 0 0 1px rgba(255,255,255,0.5)",
          }}
        >
          <h1
            className="font-serif font-bold tracking-[-0.02em] text-text-strong"
            style={{ fontSize: "clamp(28px,7vw,40px)", lineHeight: 1.1, margin: 0 }}
          >
            Privacy Policy
          </h1>
          <p
            className="font-sans font-medium text-muted"
            style={{ fontSize: 14, margin: "8px 0 32px" }}
          >
            Last updated: May 29, 2026
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
        </article>
      </div>
    </div>
  );
}
