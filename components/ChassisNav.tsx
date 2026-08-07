"use client";

import { CrochetMark } from "@/components/CrochetMark";
import { NavUserSection } from "@/components/NavUserSection";
import type { MobileMenuPage } from "@/components/MobileMenuOverlay";
import Link from "next/link";

const NAV: { href: string; label: string; page: MobileMenuPage }[] = [
  { href: "/", label: "Home", page: "home" },
  { href: "/hopper", label: "Gallery", page: "gallery" },
  { href: "/program", label: "Editor", page: "editor" },
];

type Props = {
  activePage: MobileMenuPage | null;
  loginButtonId?: string;
  leading?: React.ReactNode;
};

export function ChassisNav({ activePage, loginButtonId, leading }: Props) {
  return (
    <header
      className="punch-metal relative z-40 flex h-[60px] items-center justify-between px-4 md:px-8"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 45%, rgba(0,0,0,0.1) 100%), repeating-linear-gradient(90deg, transparent 0 2px, rgba(255,255,255,0.03) 2px 3px), #8A8F96",
        borderBottom: "2px solid #62676E",
      }}
    >
      <div className="relative z-[2] flex min-w-0 items-center gap-4 md:gap-8">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2.5 font-mono text-lg font-bold tracking-[0.06em] uppercase no-underline"
          style={{ color: "#F2EDD3" }}
        >
          <CrochetMark size={24} variant="onChassis" />
          Gridwork
        </Link>
        {leading}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) =>
            item.page === activePage ? (
              <span
                key={item.page}
                className="rounded-sm px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.12em] uppercase"
                style={{ background: "#62676E", color: "#F2EDD3" }}
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.page}
                href={item.href}
                className="rounded-sm px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.12em] uppercase no-underline transition-colors"
                style={{ color: "#F2EDD3" }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>
      <div className="relative z-[2] flex items-center gap-3">
        <NavUserSection activePage={activePage} loginButtonId={loginButtonId} />
      </div>
    </header>
  );
}
