"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AuthModal } from "@/components/AuthModal";
import { MobileMenuOverlay } from "@/components/MobileMenuOverlay";
import { fetchProfile } from "@/lib/profileHelpers";

export function LearnMobileMenu() {
  const [open, setOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
    if (!supabase || !user) {
      setDisplayName(null);
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    void fetchProfile(supabase, user.id).then(({ data }) => {
      if (!cancelled) {
        setDisplayName(data?.display_name ?? null);
        setAvatarUrl(data?.avatar_url ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOpen(false);
  };

  return (
    <>
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
          onClick={() => setOpen(true)}
          className="rounded-md border border-white/40 bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/30"
          aria-label="Menu"
        >
          ☰
        </button>
      </div>
      <MobileMenuOverlay
        open={open}
        onClose={() => setOpen(false)}
        activePage="learn"
        user={user}
        userDisplayName={displayName}
        userAvatarUrl={avatarUrl}
        onLogin={() => setAuthModalOpen(true)}
        onLogout={() => void handleLogout()}
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
