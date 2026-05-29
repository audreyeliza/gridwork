"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/editor" || pathname.startsWith("/print")) return null;

  return (
    <footer className="flex items-center justify-between py-4 px-8">
      <span className="font-sans text-xs text-white/40">© 2026 Gridwork</span>
      <nav className="flex items-center gap-5">
        <Link href="/privacy" className="font-sans text-xs text-white/40 transition-colors hover:text-white/70">
          Privacy
        </Link>
        <Link href="/terms" className="font-sans text-xs text-white/40 transition-colors hover:text-white/70">
          Terms
        </Link>
      </nav>
    </footer>
  );
}
