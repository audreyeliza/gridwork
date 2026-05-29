"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AuthModal } from "@/components/AuthModal";
import { MobileMenuOverlay, type MobileMenuPage } from "@/components/MobileMenuOverlay";
import { fetchProfile } from "@/lib/profileHelpers";

type Props = {
  activePage: MobileMenuPage | null;
  loginButtonId?: string;
};

export function NavUserSection({ activePage, loginButtonId }: Props) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = (attempt: number) => {
      if (cancelled) return;
      let client: SupabaseClient;
      try {
        client = getSupabaseBrowserClient();
      } catch {
        if (attempt < 1 && !cancelled) {
          resetSupabaseBrowserClient();
          setTimeout(() => run(attempt + 1), 50);
        }
        return;
      }
      if (cancelled) return;
      setSupabase(client);
      void client.auth.getSession().then(({ data: { session } }) => {
        if (!cancelled) setUser(session?.user ?? null);
      });
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        if (!cancelled) setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    };
    const cleanup = run(0);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user) { setDisplayName(null); setAvatarUrl(null); return; }
    let cancelled = false;
    void fetchProfile(supabase, user.id).then(({ data }) => {
      if (!cancelled) {
        setDisplayName(data?.display_name ?? null);
        setAvatarUrl(data?.avatar_url ?? null);
      }
    });
    return () => { cancelled = true; };
  }, [supabase, user]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setMenuOpen(false);
  };

  const label = displayName ? `@${displayName}` : (user?.email ?? "");

  return (
    <>
      {/* Desktop: user dropdown or login */}
      {user ? (
        <div ref={dropdownRef} className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setDropdownOpen((p) => !p)}
            className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/18 py-[5px] pl-[5px] pr-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25"
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-bold text-white"
              style={{
                background: avatarUrl ? undefined : "linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)",
                border: "1.5px solid rgba(255,255,255,0.55)",
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                : (displayName ?? user.email ?? "?").charAt(0).toUpperCase()
              }
            </span>
            {label}
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {dropdownOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.35)",
                backdropFilter: "blur(14px)",
                borderRadius: 14,
                boxShadow: "0 6px 24px rgba(40,20,30,0.18)",
              }}
            >
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.12)]"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full border-t border-white/20 px-4 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.12)]"
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
          className="hidden cursor-pointer rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-[#FBF7EF] shadow-sm hover:bg-brand-dark md:inline-flex"
        >
          Log in
        </button>
      )}

      {/* Mobile: avatar + menu */}
      <div className="flex items-center gap-3.5 md:hidden">
        {user ? (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-bold text-white"
            style={{
              background: avatarUrl ? undefined : "linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)",
              border: "1.5px solid rgba(255,255,255,0.55)",
            }}
            aria-hidden="true"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (displayName ?? user.email ?? "?").charAt(0).toUpperCase()
            )}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-md border border-white/40 bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/30"
          aria-label="Menu"
        >
          ☰
        </button>
      </div>

      <MobileMenuOverlay
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activePage={activePage}
        user={user}
        userDisplayName={displayName}
        userAvatarUrl={avatarUrl}
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
