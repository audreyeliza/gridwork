"use client";

import { AuthModal } from "@/components/AuthModal";
import { ImageTools } from "@/components/ImageTools";
import { PatternSidebar } from "@/components/PatternSidebar";
import { useAutoSave } from "@/hooks/useAutoSave";
import { usePatternHistory } from "@/hooks/usePatternHistory";
import {
  fetchPatternById,
  fetchPatternsForUser,
  type Pattern,
  upsertPattern,
} from "@/lib/patternHelpers";
import {
  createEmptyGrid,
  parseGridData,
  resizeGridPreserve,
  serializeGridCells,
} from "@/lib/gridFormat";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function clampGridSize(n: number): number {
  if (Number.isNaN(n) || n < 5) return 5;
  if (n > 100) return 100;
  return Math.floor(n);
}

export default function Home() {
  const [{ supabase, configError }] = useState<SupabaseInit>(initSupabaseClient);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [gridW, setGridW] = useState(10);
  const [gridH, setGridH] = useState(10);
  const { cells, commit, replace, reset, undo, redo, canUndo, canRedo } = usePatternHistory(gridW, gridH);

  const activePattern = useMemo(
    () => patterns.find((p) => p.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId],
  );

  const patternsRef = useRef(patterns);
  useEffect(() => {
    patternsRef.current = patterns;
  }, [patterns]);

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

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (!selectedPatternId) {
        setGridW(10);
        setGridH(10);
        reset(createEmptyGrid(10, 10));
        return;
      }

      if (!supabase || !user) return;

      const fromList = patternsRef.current.find((p) => p.id === selectedPatternId);
      if (fromList) {
        const w = clampGridSize(fromList.grid_width);
        const h = clampGridSize(fromList.grid_height);
        setGridW(w);
        setGridH(h);
        reset(parseGridData(fromList.grid_data, w, h));
        return;
      }

      void fetchPatternById(supabase, selectedPatternId, user.id).then(({ data }) => {
        if (cancelled || !data) return;
        const w = clampGridSize(data.grid_width);
        const h = clampGridSize(data.grid_height);
        setGridW(w);
        setGridH(h);
        reset(parseGridData(data.grid_data, w, h));
        setPatterns((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]));
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selectedPatternId, supabase, user, reset]);

  const handleCreateNew = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await upsertPattern(supabase, {
      user_id: user.id,
      name: "Untitled",
      grid_data: serializeGridCells(createEmptyGrid(10, 10)),
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

  const handleCommitGrid = useCallback(
    (next: boolean[][]) => {
      commit(next);
    },
    [commit],
  );

  const handleWidthChange = useCallback(
    (raw: number) => {
      const w = clampGridSize(raw);
      setGridW(w);
      replace(resizeGridPreserve(cells, w, gridH));
    },
    [replace, cells, gridH],
  );

  const handleHeightChange = useCallback(
    (raw: number) => {
      const h = clampGridSize(raw);
      setGridH(h);
      replace(resizeGridPreserve(cells, gridW, h));
    },
    [replace, cells, gridW],
  );

  const dirtyKey = useMemo(() => JSON.stringify({ gridW, gridH, cells }), [gridW, gridH, cells]);

  const persistPattern = useCallback(async () => {
    if (!supabase || !user || !selectedPatternId || !activePattern) return;
    const { error } = await upsertPattern(supabase, {
      id: selectedPatternId,
      user_id: user.id,
      name: activePattern.name,
      grid_width: gridW,
      grid_height: gridH,
      grid_data: serializeGridCells(cells),
      progress_data: activePattern.progress_data ?? {},
      yarn_settings: activePattern.yarn_settings ?? {},
    });
    if (error) console.error(error);
  }, [supabase, user, selectedPatternId, activePattern, gridW, gridH, cells]);

  useAutoSave({
    enabled: Boolean(supabase && user && selectedPatternId && activePattern),
    delayMs: 2000,
    dirtyKey,
    onSave: persistPattern,
  });

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

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
          {configError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {configError}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
                Session: {session ? "signed in" : "guest"}
                {selectedPatternId ? ` · pattern ${selectedPatternId.slice(0, 8)}…` : ""}
                {user && selectedPatternId ? " · autosave ~2s" : ""}
              </p>

              <div className="flex shrink-0 flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Width
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={gridW}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Height
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={gridH}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={() => undo()}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    disabled={!canRedo}
                    onClick={() => redo()}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    Redo
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ImageTools
                  gridWidth={gridW}
                  gridHeight={gridH}
                  cells={cells}
                  onCommit={handleCommitGrid}
                  onApplyConvertedGrid={(g) => commit(g)}
                  className="min-h-0"
                />
              </div>
            </div>
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
