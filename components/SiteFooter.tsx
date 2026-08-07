"use client";

import { CrochetMark } from "@/components/CrochetMark";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (
    pathname === "/" ||
    pathname === "/editor" ||
    pathname.startsWith("/print") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/u/")
  ) {
    return null;
  }

  return (
    <footer
      className="punch-metal relative mt-auto flex items-center justify-between border-t-2 border-chassis-dark px-6 py-3.5 md:px-8"
      style={{ background: "#8A8F96" }}
    >
      <div className="relative z-[2] flex items-center gap-2.5">
        <CrochetMark size={18} variant="onChassis" />
        <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-card uppercase">
          © 2026 Gridwork
        </span>
      </div>
      <nav className="relative z-[2] flex items-center gap-5">
        <Link
          href="/privacy"
          className="font-mono text-[10px] font-bold tracking-[0.12em] text-card/80 uppercase transition-colors hover:text-card"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="font-mono text-[10px] font-bold tracking-[0.12em] text-card/80 uppercase transition-colors hover:text-card"
        >
          Terms
        </Link>
      </nav>
    </footer>
  );
}
