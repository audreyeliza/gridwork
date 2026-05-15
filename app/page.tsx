"use client";

import { AuthModal } from "@/components/AuthModal";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SupabaseInit = {
  supabase: SupabaseClient | null;
  configError: string | null;
};

function initSupabaseClient(): SupabaseInit {
  try {
    return { supabase: getSupabaseBrowserClient(), configError: null };
  } catch (e) {
    return {
      supabase: null,
      configError: e instanceof Error ? e.message : "Supabase is not configured.",
    };
  }
}

export default function Home() {
  const [supabaseInit, setSupabaseInit] = useState<SupabaseInit>(() => ({
    supabase: null,
    configError: null,
  }));

  useEffect(() => {
    let cancelled = false;
    let initialTimer: number | undefined;
    let retryTimer: number | undefined;
    const run = (attempt: number) => {
      if (cancelled) return;
      const next = initSupabaseClient();
      if (cancelled) return;
      setSupabaseInit(next);
      const missing =
        next.configError?.includes("Missing NEXT_PUBLIC_SUPABASE_URL") ||
        next.configError?.includes("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
      if (missing && attempt < 1 && !cancelled) {
        resetSupabaseBrowserClient();
        retryTimer = window.setTimeout(() => run(attempt + 1), 50) as unknown as number;
      }
    };
    initialTimer = window.setTimeout(() => run(0), 0) as unknown as number;
    return () => {
      cancelled = true;
      if (initialTimer !== undefined) window.clearTimeout(initialTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  const { supabase, configError } = supabaseInit;
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setUser(s?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setUser(newSession?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  return (
    <div className="flex h-screen flex-col text-stone-800">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-white/40 bg-white/80 px-4 py-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-5">
          <span className="font-serif text-xl font-bold text-brand">Gridwork</span>
          <Link href="/learn" className="text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700">
            Learn
          </Link>
        </div>
        {user ? (
          <div className="flex items-center gap-2">
            <span className="max-w-[160px] truncate text-xs text-stone-500">{user.email}</span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="cursor-pointer rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50"
            >
              Log out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="cursor-pointer rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            Log in
          </button>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-stone-800">Gridwork</h1>
          <p className="mt-4 text-lg text-stone-600">
            Design filet crochet patterns in your browser.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href="/editor"
              className="rounded-full border border-white/60 bg-white/85 px-8 py-3 text-base font-semibold text-[#D4457F] shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white hover:text-[#B03570] hover:shadow-md"
            >
              Get Started
            </Link>
            <Link
              href="/learn"
              className="group text-sm font-medium text-white/90 underline-offset-4 transition-all duration-150 hover:text-white hover:underline"
            >
              How to filet crochet <span className="inline-block transition-transform duration-150 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </main>

      <AuthModal
        key={authModalOpen ? "auth-open" : "auth-closed"}
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        supabase={supabase}
        supabaseReady={Boolean(supabase || configError)}
      />
    </div>
  );
}
