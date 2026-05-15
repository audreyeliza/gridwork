"use client";

import { AuthModal } from "@/components/AuthModal";
import { PatternSidebar } from "@/components/PatternSidebar";
import {
  fetchPatternsForUser,
  type Pattern,
  upsertPattern,
} from "@/lib/patternHelpers";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
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
  const [{ supabase, configError }] = useState<SupabaseInit>(initSupabaseClient);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const loadPatterns = useCallback(async (client: SupabaseClient, uid: string) => {
    setPatternsLoading(true);
    const { data, error } = await fetchPatternsForUser(client, uid);
    setPatternsLoading(false);
    if (error) {
      console.error(error);
      setPatterns([]);
      return;
    }
    setPatterns(data ?? []);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const sync = (s: Session | null) => {
      setSession(s);
      const u = s?.user ?? null;
      setUser(u);
      if (!u) {
        setPatterns([]);
        setSelectedPatternId(null);
      }
    };

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      sync(s);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      sync(newSession);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    const id = window.setTimeout(() => {
      void loadPatterns(supabase, user.id);
    }, 0);
    return () => window.clearTimeout(id);
  }, [supabase, user, loadPatterns]);

  const handleCreateNew = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await upsertPattern(supabase, {
      user_id: user.id,
      name: "Untitled",
      grid_data: {},
      grid_width: 10,
      grid_height: 10,
      progress_data: {},
      yarn_settings: {},
    });
    if (error) {
      console.error(error);
      return;
    }
    await loadPatterns(supabase, user.id);
    if (data?.id) setSelectedPatternId(data.id);
  }, [supabase, user, loadPatterns]);

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Gridwork</span>
        {user ? (
          <span className="max-w-[50%] truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</span>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Log in
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <PatternSidebar
          user={user}
          patterns={patterns}
          patternsLoading={patternsLoading}
          selectedPatternId={selectedPatternId}
          onSelectPattern={setSelectedPatternId}
          onCreateNew={handleCreateNew}
          onOpenAuth={() => setAuthModalOpen(true)}
        />

        <main className="flex min-w-0 flex-1 flex-col p-6">
          {configError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {configError}
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Session: {session ? "signed in" : "guest"}
                {selectedPatternId ? ` · pattern ${selectedPatternId.slice(0, 8)}…` : ""}
              </p>
              <div className="mt-8 flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                Editor placeholder
              </div>
            </>
          )}
        </main>
      </div>

      <AuthModal
        key={authModalOpen ? "auth-open" : "auth-closed"}
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        supabase={supabase}
      />
    </div>
  );
}
