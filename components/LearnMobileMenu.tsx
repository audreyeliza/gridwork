"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AuthModal } from "@/components/AuthModal";

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
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="rounded-md border border-stone-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          aria-label="Menu"
        >
          {open ? "✕" : "☰"}
        </button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
            <Link
              href="/gallery"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
            >
              Gallery
            </Link>
            <Link
              href="/editor"
              onClick={() => setOpen(false)}
              className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
            >
              Editor
            </Link>
            {user ? (
              <>
                <div className="border-t border-stone-100 px-4 py-2 text-xs text-stone-500 truncate">{user.email}</div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="w-full border-t border-stone-100 px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setAuthModalOpen(true); setOpen(false); }}
                className="w-full border-t border-stone-100 px-4 py-3 text-left text-sm font-medium text-brand hover:bg-pink-50"
              >
                Log in
              </button>
            )}
          </div>
        )}
      </div>
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
