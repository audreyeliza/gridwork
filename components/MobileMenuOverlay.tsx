"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { CrochetMark } from "@/components/CrochetMark";

export type MobileMenuPage = "home" | "learn" | "gallery" | "editor" | "profile";

type NavItem = { label: string; href: string; page: MobileMenuPage; requiresAuth?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "Hopper", href: "/?zone=hopper", page: "gallery" },
  { label: "Manual", href: "/?zone=primer", page: "home" },
  { label: "Program", href: "/?zone=reader", page: "editor" },
  { label: "Maker", href: "/?zone=maker", page: "profile", requiresAuth: true },
];

type Props = {
  open: boolean;
  onClose: () => void;
  activePage: MobileMenuPage | null;
  user: User | null;
  userDisplayName?: string | null;
  userAvatarUrl?: string | null;
  profileLoading?: boolean;
  onLogin: () => void;
  onLogout: () => void;
  loginButtonId?: string;
};

export function MobileMenuOverlay({
  open,
  onClose,
  activePage,
  user,
  userDisplayName,
  userAvatarUrl,
  profileLoading = false,
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

  const visibleItems = NAV_ITEMS.filter((item) => !item.requiresAuth || user);
  const avatarLetter =
    userDisplayName?.[0]?.toUpperCase() ??
    (profileLoading ? "?" : user?.email?.[0]?.toUpperCase()) ??
    "?";
  const displayLabel = userDisplayName
    ? `@${userDisplayName}`
    : profileLoading
      ? ""
      : (user?.email ?? "");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-chassis">
      <div className="flex h-[60px] items-center justify-between border-b border-chassis-dark px-4">
        <span className="inline-flex items-center gap-2 font-mono text-lg font-bold tracking-[0.06em] text-card uppercase">
          <CrochetMark size={22} variant="onChassis" />
          Gridwork
        </span>
        <button type="button" onClick={onClose} aria-label="Close menu" className="punch-key text-[10px]">
          Close
        </button>
      </div>

      <div className="px-6 pt-8">
        <div className="mb-4 font-mono text-[10px] font-bold tracking-[0.18em] text-chassis-light uppercase">
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
                borderBottom: isLast ? "none" : "1px solid rgba(74,78,85,0.6)",
              }}
            >
              <Link
                href={item.href}
                onClick={onClose}
                className={`font-mono text-[28px] font-bold tracking-[-0.02em] no-underline ${
                  isActive ? "text-card" : "text-card/70"
                }`}
              >
                {item.label}
              </Link>
              {isActive && (
                <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-key-blue uppercase">
                  Here
                </span>
              )}
            </div>
          );
        })}

        <div className="mt-8">
          {user ? (
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex w-full cursor-pointer items-center gap-3 border border-chassis-dark bg-chassis-dark/50 px-3 py-3 text-left"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-key-blue text-sm font-bold text-white">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  avatarLetter
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm font-bold text-card">
                  {displayLabel || (
                    <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-card/20" aria-hidden="true" />
                  )}
                </div>
                <div className="font-mono text-[10px] tracking-[0.1em] text-chassis-light uppercase">
                  Tap to log out
                </div>
              </div>
            </button>
          ) : (
            <button
              id={loginButtonId}
              type="button"
              onClick={() => {
                onLogin();
                onClose();
              }}
              className="punch-key punch-key-blue w-full min-h-[44px]"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
