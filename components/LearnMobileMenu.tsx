"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AuthModal } from "@/components/AuthModal";
import { MobileMenuOverlay } from "@/components/MobileMenuOverlay";

export function LearnMobileMenu() {
  const [open, setOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);

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

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/40 bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/30 md:hidden"
        aria-label="Menu"
      >
        ☰
      </button>
      <MobileMenuOverlay
        open={open}
        onClose={() => setOpen(false)}
        activePage="learn"
        user={user}
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
