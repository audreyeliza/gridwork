"use client";

import { AuthModal } from "@/components/AuthModal";
import { ImageTools } from "@/components/ImageTools";
import { YarnEstimator } from "@/components/YarnEstimator";
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
import {
  clampCurrentRow,
  defaultProgressState,
  parseProgressData,
  resizeRowComplete,
  serializeProgressData,
  type PatternProgressState,
} from "@/lib/progressData";
import {
  DEFAULT_PATTERN_YARN_SETTINGS,
  parsePatternYarnSettings,
  serializePatternYarnSettings,
  type PatternYarnSettings,
} from "@/lib/yarnSettings";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [gridW, setGridW] = useState(10);
  const [gridH, setGridH] = useState(10);
  const [sizeMax, setSizeMax] = useState(80);
  const [yarnSettings, setYarnSettings] = useState<PatternYarnSettings>(DEFAULT_PATTERN_YARN_SETTINGS);
  const [progress, setProgress] = useState<PatternProgressState>(() => defaultProgressState(10));
  const { cells, commit, replace, reset, undo, redo, canUndo, canRedo } = usePatternHistory(gridW, gridH);

  const activePattern = useMemo(
    () => patterns.find((p) => p.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId],
  );

  const { filledCellCount, emptyCellCount } = useMemo(() => {
    let filled = 0;
    let empty = 0;
    for (const row of cells) {
      for (const cell of row) {
        if (cell) filled += 1;
        else empty += 1;
      }
    }
    return { filledCellCount: filled, emptyCellCount: empty };
  }, [cells]);

  const handleYarnSettingsChange = useCallback((next: PatternYarnSettings) => {
    setYarnSettings(next);
  }, []);

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

  /** Local blank canvas when nothing is selected — must NOT re-run when `supabase` hydrates or yarn/toggles reset. */
  useEffect(() => {
    if (selectedPatternId !== null) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      setGridW(10);
      setGridH(10);
      reset(createEmptyGrid(10, 10));
      setYarnSettings({ ...DEFAULT_PATTERN_YARN_SETTINGS });
      setProgress(defaultProgressState(10));
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selectedPatternId, reset]);

  /** Load a saved pattern once auth + selection are ready. */
  useEffect(() => {
    if (!selectedPatternId || !supabase || !user) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      const fromList = patternsRef.current.find((p) => p.id === selectedPatternId);
      if (fromList) {
        const w = clampGridSize(fromList.grid_width);
        const h = clampGridSize(fromList.grid_height);
        setGridW(w);
        setGridH(h);
        reset(parseGridData(fromList.grid_data, w, h));
        setYarnSettings(parsePatternYarnSettings(fromList.yarn_settings));
        setProgress(parseProgressData(fromList.progress_data, h));
        return;
      }

      void fetchPatternById(supabase, selectedPatternId, user.id).then(({ data }) => {
        if (cancelled || !data) return;
        const w = clampGridSize(data.grid_width);
        const h = clampGridSize(data.grid_height);
        setGridW(w);
        setGridH(h);
        reset(parseGridData(data.grid_data, w, h));
        setYarnSettings(parsePatternYarnSettings(data.yarn_settings));
        setProgress(parseProgressData(data.progress_data, h));
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
      progress_data: serializeProgressData(defaultProgressState(10)),
      yarn_settings: serializePatternYarnSettings(DEFAULT_PATTERN_YARN_SETTINGS),
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

  const handleApplyConvertedGrid = useCallback(
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
      setProgress((p) => ({
        ...p,
        rowComplete: resizeRowComplete(p.rowComplete, h),
        currentRow: clampCurrentRow(p.currentRow, h),
      }));
    },
    [replace, cells, gridW],
  );

  const handleToggleRowComplete = useCallback((row: number) => {
    setProgress((p) => {
      if (row < 0 || row >= p.rowComplete.length) return p;
      const next = [...p.rowComplete];
      next[row] = !next[row];
      return { ...p, rowComplete: next };
    });
  }, []);

  const handleBestFitGrid = useCallback(
    (w: number, h: number) => {
      const cw = clampGridSize(w);
      const ch = clampGridSize(h);
      setGridW(cw);
      setGridH(ch);
      replace(resizeGridPreserve(cells, cw, ch));
      setProgress((p) => ({
        ...p,
        rowComplete: resizeRowComplete(p.rowComplete, ch),
        currentRow: clampCurrentRow(p.currentRow, ch),
      }));
    },
    [replace, cells],
  );

  const handleRenamePattern = useCallback(
    async (id: string, newName: string) => {
      if (!supabase || !user) return;
      setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
      const pattern = patterns.find((p) => p.id === id);
      if (!pattern) return;
      const { error } = await upsertPattern(supabase, {
        id,
        user_id: user.id,
        name: newName,
        grid_data: pattern.grid_data,
        grid_width: pattern.grid_width,
        grid_height: pattern.grid_height,
        progress_data: pattern.progress_data,
        yarn_settings: pattern.yarn_settings,
      });
      if (error) console.error(error);
    },
    [supabase, user, patterns],
  );

  const handleStepCurrentRow = useCallback((delta: number) => {
    setProgress((p) => ({
      ...p,
      currentRow: clampCurrentRow(p.currentRow + delta, gridH),
    }));
  }, [gridH]);

  const dirtyKey = useMemo(
    () => JSON.stringify({ gridW, gridH, cells, yarnSettings, progress }),
    [gridW, gridH, cells, yarnSettings, progress],
  );

  const persistPattern = useCallback(async () => {
    if (!supabase || !user || !selectedPatternId || !activePattern) return;
    const { error } = await upsertPattern(supabase, {
      id: selectedPatternId,
      user_id: user.id,
      name: activePattern.name,
      grid_width: gridW,
      grid_height: gridH,
      grid_data: serializeGridCells(cells),
      progress_data: serializeProgressData(progress),
      yarn_settings: serializePatternYarnSettings(yarnSettings),
    });
    if (error) console.error(error);
  }, [supabase, user, selectedPatternId, activePattern, gridW, gridH, cells, yarnSettings, progress]);

  useAutoSave({
    enabled: Boolean(supabase && user && selectedPatternId && activePattern),
    delayMs: 2000,
    dirtyKey,
    onSave: persistPattern,
  });

  return (
    <div className="flex h-screen flex-col bg-[#fffbf5] text-stone-800">
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-rose-100/80 bg-white/90 px-4 py-2.5 shadow-sm">
        <span className="text-sm font-semibold tracking-tight text-rose-800">Gridwork</span>
        {user ? (
          <span className="max-w-[50%] truncate text-xs text-stone-500">{user.email}</span>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="cursor-pointer rounded-full bg-rose-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-rose-600"
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
          onRenamePattern={handleRenamePattern}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
          {configError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {configError}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <p className="shrink-0 text-sm text-stone-500">
                Session: {session ? "signed in" : "guest"}
                {selectedPatternId ? ` · pattern ${selectedPatternId.slice(0, 8)}…` : ""}
                {user && selectedPatternId ? " · autosave ~2s" : ""}
              </p>

              <div className="flex shrink-0 flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                  Width
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={gridW}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    className="w-20 rounded-lg border border-rose-100 bg-white px-2 py-1 text-sm text-stone-900 shadow-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                  Height
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={gridH}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="w-20 rounded-lg border border-rose-100 bg-white px-2 py-1 text-sm text-stone-900 shadow-sm"
                  />
                </label>
                {/* Single locked slider: sets W and H to the same value simultaneously */}
                <div className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                  <span className="flex items-center gap-1">
                    Size
                    <span className="rounded bg-stone-100 px-1 py-0.5 text-[10px] font-normal text-stone-500">W = H</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={5}
                      max={Math.max(5, sizeMax)}
                      step={1}
                      value={Math.min(Math.round((gridW + gridH) / 2), Math.max(5, sizeMax))}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        handleBestFitGrid(s, s);
                      }}
                      className="w-32"
                    />
                    <span className="w-8 tabular-nums text-stone-500">{Math.round((gridW + gridH) / 2)}</span>
                    <label className="flex items-center gap-1 font-normal text-stone-400">
                      Max
                      <input
                        type="number"
                        min={5}
                        max={100}
                        value={sizeMax}
                        onChange={(e) => setSizeMax(Math.min(100, Math.max(5, Number(e.target.value) || 5)))}
                        className="w-14 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-700 shadow-sm"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={() => undo()}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    disabled={!canRedo}
                    onClick={() => redo()}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40"
                  >
                    Redo
                  </button>
                  <button
                    type="button"
                    disabled={progress.currentRow <= 0}
                    onClick={() => handleStepCurrentRow(-1)}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40"
                  >
                    Prev row
                  </button>
                  <button
                    type="button"
                    disabled={progress.currentRow >= gridH - 1}
                    onClick={() => handleStepCurrentRow(1)}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40"
                  >
                    Next row
                  </button>
                  <button
                    type="button"
                    disabled={!selectedPatternId}
                    onClick={() => {
                      if (!selectedPatternId) return;
                      window.open(`/print/${selectedPatternId}`, "_blank", "noopener,noreferrer");
                    }}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40"
                  >
                    Print
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
                <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
                  <ImageTools
                    gridWidth={gridW}
                    gridHeight={gridH}
                    cells={cells}
                    onCommit={handleCommitGrid}
                    onApplyConvertedGrid={handleApplyConvertedGrid}
                    onBestFitGrid={handleBestFitGrid}
                    progress={progress}
                    onToggleRowComplete={handleToggleRowComplete}
                    className="min-h-0"
                  />
                </div>
                <YarnEstimator
                  gridWidth={gridW}
                  gridHeight={gridH}
                  filledCellCount={filledCellCount}
                  emptyCellCount={emptyCellCount}
                  value={yarnSettings}
                  onChange={handleYarnSettingsChange}
                  className="w-full shrink-0 lg:z-10 lg:w-80"
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
        supabaseReady={Boolean(supabase || configError)}
      />
    </div>
  );
}
