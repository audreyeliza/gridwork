"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export type MobileMenuPage = "home" | "learn" | "gallery" | "editor" | "profile";

type NavItem = { label: string; href: string; page: MobileMenuPage; requiresAuth?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "Home",    href: "/",        page: "home"    },
  { label: "Learn",   href: "/learn",   page: "learn"   },
  { label: "Gallery", href: "/gallery", page: "gallery" },
  { label: "Editor",  href: "/editor",  page: "editor"  },
  { label: "Profile", href: "/profile", page: "profile", requiresAuth: true },
];

type Props = {
  open: boolean;
  onClose: () => void;
  activePage: MobileMenuPage | null;
  user: User | null;
  userDisplayName?: string | null;
  onLogin: () => void;
  onLogout: () => void;
  loginButtonId?: string;
};

function CrochetMark({ size = 20 }: { size?: number }) {
  const cells = [
    [0,1,0,1,0],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [0,0,1,0,0],
  ];
  const n = cells[0].length;
  const cell = (size - n) / n;
  const rx = Math.max(0.5, cell * 0.28);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      {cells.map((row, y) => row.map((on, x) =>
        on ? <rect key={`${x}-${y}`} x={x*(cell+1)+0.5} y={y*(cell+1)+0.5} width={cell} height={cell} rx={rx} fill="#fff"/> : null
      ))}
    </svg>
  );
}

export function MobileMenuOverlay({
  open,
  onClose,
  activePage,
  user,
  userDisplayName,
  onLogin,
  onLogout,
  loginButtonId,
}: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const visibleItems = NAV_ITEMS.filter(item => !item.requiresAuth || user);
  const avatarLetter = userDisplayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?";
  const displayLabel = userDisplayName ? `@${userDisplayName}` : (user?.email ?? "");

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)" }}
    >
      {/* Top nav bar */}
      <div className="flex h-[68px] items-center justify-between px-[18px]">
        <span
          className="inline-flex items-center gap-2 font-serif text-xl font-bold leading-none tracking-[-0.01em] text-white"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
        >
          <CrochetMark size={20} />
          Gridwork
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-white/40 bg-white/20 text-white backdrop-blur-sm"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Menu body */}
      <div className="px-7 pt-8">
        <div
          className="mb-[18px] font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white/85"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
        >
          Menu
        </div>

        {visibleItems.map((item, i) => {
          const isActive = item.page === activePage;
          const isLast = i === visibleItems.length - 1;
          return (
            <div
              key={item.page}
              className="flex items-center justify-between"
              style={{
                padding: "14px 0",
                borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.22)",
              }}
            >
              <Link
                href={item.href}
                onClick={onClose}
                className="inline-flex items-center text-white no-underline"
                style={{
                  gap: 14,
                  fontFamily: "var(--font-lora), Georgia, serif",
                  fontWeight: 700,
                  fontSize: "clamp(26px,8vw,34px)",
                  letterSpacing: "-0.02em",
                  textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                  lineHeight: 1,
                }}
              >
                {isActive && (
                  <span
                    className="inline-block shrink-0 rounded-full bg-white"
                    style={{ width: 9, height: 9, boxShadow: "0 0 0 4px rgba(255,255,255,0.18)" }}
                  />
                )}
                {item.label}
              </Link>
              {isActive && (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5"
                >
                  <span className="inline-block size-2 rounded-full bg-white/80" />
                  <span
                    className="hidden font-mono text-[10px] font-bold text-white sm:inline"
                    style={{ letterSpacing: "0.10em", opacity: 0.85, textShadow: "0 1px 2px rgba(0,0,0,0.18)" }}
                  >
                    HERE
                  </span>
                </span>
              )}
            </div>
          );
        })}

        {/* User card */}
        <div className="mt-[30px]">
          {user ? (
            <button
              type="button"
              onClick={() => { onLogout(); onClose(); }}
              className="flex w-full cursor-pointer items-center gap-3 text-left"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 14,
                padding: "12px 14px",
                backdropFilter: "blur(14px)",
                boxShadow: "0 6px 24px rgba(40,20,30,0.18)",
              }}
            >
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  width: 38, height: 38,
                  background: "linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)",
                  fontFamily: "var(--font-lora), Georgia, serif",
                  fontWeight: 700, fontSize: 17, lineHeight: 1,
                  border: "2px solid rgba(255,255,255,0.7)",
                }}
              >
                {avatarLetter}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-white"
                  style={{
                    fontFamily: "var(--font-lora), Georgia, serif",
                    fontWeight: 700, fontSize: 17,
                    textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                  }}
                >
                  {displayLabel}
                </div>
                <div
                  className="text-white/85"
                  style={{
                    fontFamily: "var(--font-nunito), sans-serif",
                    fontWeight: 600, fontSize: 12,
                    textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                  }}
                >
                  Tap to log out
                </div>
              </div>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" />
              </svg>
            </button>
          ) : (
            <button
              id={loginButtonId}
              type="button"
              onClick={() => { onLogin(); onClose(); }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 text-[#FBF7EF]"
              style={{
                background: "#A8466F",
                border: "none",
                borderRadius: 14,
                padding: "14px",
                boxShadow: "0 6px 24px rgba(168,70,111,0.35)",
                fontFamily: "var(--font-nunito), sans-serif",
                fontWeight: 700, fontSize: 15,
              }}
            >
              Log in to save patterns
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
