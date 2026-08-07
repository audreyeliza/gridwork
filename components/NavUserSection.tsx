"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { MobileMenuOverlay, type MobileMenuPage } from "@/components/MobileMenuOverlay";
import {
  resolveNavInitial,
  resolveNavLabel,
  useNavAuth,
} from "@/components/NavAuthProvider";

type Props = {
  activePage: MobileMenuPage | null;
  loginButtonId?: string;
};

export function NavUserSection({ activePage, loginButtonId }: Props) {
  const {
    supabase,
    user,
    displayName,
    avatarUrl,
    profileLoading,
    signOut,
  } = useNavAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await signOut();
    setDropdownOpen(false);
    setMenuOpen(false);
  };

  const label = resolveNavLabel(user, displayName, profileLoading);
  const initial = resolveNavInitial(user, displayName, profileLoading);

  return (
    <>
      {user ? (
        <div ref={dropdownRef} className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setDropdownOpen((p) => !p)}
            className="inline-flex items-center gap-2 rounded-sm border border-chassis-dark bg-chassis-dark/40 py-[4px] pl-[4px] pr-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-card uppercase hover:bg-chassis-dark/70"
          >
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-key-blue text-[11px] font-bold text-white"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                : initial
              }
            </span>
            {label || (
              <span className="inline-block h-3 w-14 animate-pulse rounded bg-card/20" aria-hidden="true" />
            )}
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-[100] mt-1 w-40 overflow-hidden rounded-sm border border-chassis-dark bg-chassis-dark shadow-lg">
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="block px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-card uppercase transition-colors hover:bg-recess"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full border-t border-recess px-3 py-2.5 text-left font-mono text-[11px] font-bold tracking-[0.1em] text-card uppercase transition-colors hover:bg-recess"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          id={loginButtonId}
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="punch-key punch-key-blue hidden md:inline-flex"
        >
          Log in
        </button>
      )}

      <div className="flex items-center gap-3 md:hidden">
        {user ? (
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-key-blue text-[11px] font-bold text-white"
            aria-hidden="true"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="punch-key text-[10px]"
          aria-label="Menu"
        >
          Menu
        </button>
      </div>

      <MobileMenuOverlay
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activePage={activePage}
        user={user}
        userDisplayName={displayName}
        userAvatarUrl={avatarUrl}
        profileLoading={profileLoading}
        onLogin={() => setAuthModalOpen(true)}
        onLogout={() => void handleLogout()}
        loginButtonId={loginButtonId}
      />

      <AuthModal
        key={authModalOpen ? "auth-open" : "auth-closed"}
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        supabase={supabase}
        supabaseReady={Boolean(supabase)}
      />
    </>
  );
}
