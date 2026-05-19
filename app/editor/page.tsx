"use client";

import { AuthModal } from "@/components/AuthModal";
import { DisplayNameModal } from "@/components/DisplayNameModal";
import { ImageTools } from "@/components/ImageTools";
import { YarnEstimator } from "@/components/YarnEstimator";
import { PatternSidebar } from "@/components/PatternSidebar";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { useAutoSave } from "@/hooks/useAutoSave";
import { usePatternHistory } from "@/hooks/usePatternHistory";
import {
  fetchPatternById,
  deletePattern,
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
import {
  DEFAULT_PATTERN_IMAGE_SETTINGS,
  parseImageSettings,
  serializeImageSettings,
  type PatternImageSettings,
} from "@/lib/imageSettings";
import { setPatternPublic } from "@/lib/galleryHelpers";
import { fetchProfile, upsertProfile } from "@/lib/profileHelpers";
import { generateGridThumbnail } from "@/lib/thumbnailUtils";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import Link from "next/link";
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

const GRID_PRESETS = [
  { label: "Pillow front (40×40)", w: 40, h: 40 },
  { label: "Curtain panel (60×80)", w: 60, h: 80 },
  { label: "Curtain trim (80×20)", w: 80, h: 20 },
  { label: "Table runner (30×80)", w: 30, h: 80 },
  { label: "Bookmark (10×40)", w: 10, h: 40 },
] as const;

function clampGridSize(n: number): number {
  if (Number.isNaN(n) || n < 5) return 5;
  if (n > 200) return 200;
  return Math.floor(n);
}

export default function EditorPage() {
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
  const [aspectLocked, setAspectLocked] = useState(false);
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const [yarnOpen, setYarnOpen] = useState(false);
  const [imageCropExpanded, setImageCropExpanded] = useState(false);
  const [gridFullscreen, setGridFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayNameModalOpen, setDisplayNameModalOpen] = useState(false);
  const [displayNameModalMsg, setDisplayNameModalMsg] = useState<string | undefined>(undefined);
  const skippedDisplayNameRef = useRef(false);

  const [gridW, setGridW] = useState(10);
  const [gridH, setGridH] = useState(10);
  const [yarnSettings, setYarnSettings] = useState<PatternYarnSettings>(DEFAULT_PATTERN_YARN_SETTINGS);
  const [progress, setProgress] = useState<PatternProgressState>(() => defaultProgressState(10));
  const [imageSettings, setImageSettings] = useState<PatternImageSettings>(DEFAULT_PATTERN_IMAGE_SETTINGS);
  /** Incremented each time a pattern's data is fully loaded from the DB, triggering ImageTools reinit. */
  const [imageSettingsLoadKey, setImageSettingsLoadKey] = useState("");
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

  const handleImageSettingsChange = useCallback((next: PatternImageSettings) => {
    setImageSettings(next);
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

  useEffect(() => {
    if (!supabase || !user) {
      setDisplayName(null);
      skippedDisplayNameRef.current = false;
      return;
    }
    void fetchProfile(supabase, user.id).then(({ data }) => {
      if (data) {
        setDisplayName(data.display_name);
      } else if (!skippedDisplayNameRef.current) {
        setDisplayNameModalMsg(undefined);
        setDisplayNameModalOpen(true);
      }
    });
  }, [supabase, user]);

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
      setImageSettings({ ...DEFAULT_PATTERN_IMAGE_SETTINGS });
      setImageSettingsLoadKey("unsaved-" + Date.now());
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selectedPatternId, reset]);

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
        setImageSettings(parseImageSettings(fromList.image_settings));
        setImageSettingsLoadKey(fromList.id + "-" + fromList.updated_at);
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
        setImageSettings(parseImageSettings(data.image_settings));
        setImageSettingsLoadKey(data.id + "-" + data.updated_at);
        setPatterns((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]));
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selectedPatternId, supabase, user, reset]);

  useEffect(() => {
    if (user || filledCellCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Log in to save your pattern before leaving.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user, filledCellCount]);

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

  const handleSaveCurrentAsPattern = useCallback(async () => {
    if (!supabase || !user) return;
    const thumbnail = generateGridThumbnail(cells);
    const { data, error } = await upsertPattern(supabase, {
      user_id: user.id,
      name: "Untitled",
      grid_data: serializeGridCells(cells),
      grid_width: gridW,
      grid_height: gridH,
      progress_data: serializeProgressData(progress),
      yarn_settings: serializePatternYarnSettings(yarnSettings),
      image_settings: serializeImageSettings(imageSettings),
      thumbnail: thumbnail || null,
    });
    if (error) {
      console.error(error);
      return;
    }
    await loadPatterns(supabase, user.id);
    if (data?.id) setSelectedPatternId(data.id);
  }, [supabase, user, cells, gridW, gridH, progress, yarnSettings, imageSettings, loadPatterns]);

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
      if (aspectLocked && lockedRatio !== null) {
        const h = clampGridSize(Math.round(w / lockedRatio));
        setGridW(w);
        setGridH(h);
        replace(resizeGridPreserve(cells, w, h));
        setProgress((p) => ({
          ...p,
          rowComplete: resizeRowComplete(p.rowComplete, h),
          currentRow: clampCurrentRow(p.currentRow, h),
        }));
      } else {
        setGridW(w);
        replace(resizeGridPreserve(cells, w, gridH));
      }
    },
    [aspectLocked, lockedRatio, replace, cells, gridH],
  );

  const handleHeightChange = useCallback(
    (raw: number) => {
      const h = clampGridSize(raw);
      if (aspectLocked && lockedRatio !== null) {
        const w = clampGridSize(Math.round(h * lockedRatio));
        setGridW(w);
        setGridH(h);
        replace(resizeGridPreserve(cells, w, h));
        setProgress((p) => ({
          ...p,
          rowComplete: resizeRowComplete(p.rowComplete, h),
          currentRow: clampCurrentRow(p.currentRow, h),
        }));
      } else {
        setGridH(h);
        replace(resizeGridPreserve(cells, gridW, h));
        setProgress((p) => ({
          ...p,
          rowComplete: resizeRowComplete(p.rowComplete, h),
          currentRow: clampCurrentRow(p.currentRow, h),
        }));
      }
    },
    [aspectLocked, lockedRatio, replace, cells, gridW],
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

  const handleToggleAspectLock = useCallback(() => {
    if (!aspectLocked) {
      setLockedRatio(gridW / gridH);
    }
    setAspectLocked((prev) => !prev);
  }, [aspectLocked, gridW, gridH]);

  const handleImageLoad = useCallback((naturalWidth: number, naturalHeight: number) => {
    setLockedRatio(naturalWidth / naturalHeight);
    setAspectLocked(true);
  }, []);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

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

  const handleDeletePattern = useCallback(
    async (id: string) => {
      if (!supabase || !user) return;
      // Optimistic removal
      setPatterns((prev) => prev.filter((p) => p.id !== id));
      if (selectedPatternId === id) setSelectedPatternId(null);
      const { error } = await deletePattern(supabase, id, user.id);
      if (error) {
        console.error(error);
        // Reload on failure to restore the list
        await loadPatterns(supabase, user.id);
      }
    },
    [supabase, user, selectedPatternId, loadPatterns],
  );

  const handleStepCurrentRow = useCallback((delta: number) => {
    setProgress((p) => ({
      ...p,
      currentRow: clampCurrentRow(p.currentRow + delta, gridH),
    }));
  }, [gridH]);

  const dirtyKey = useMemo(
    () => JSON.stringify({
      gridW, gridH, cells, yarnSettings, progress,
      imageMode: imageSettings.mode,
      imageUrlSig: imageSettings.imageDataUrl?.length ?? 0,
      imageUnderlayOpacity: imageSettings.underlayOpacityPct,
      imageCropRect: imageSettings.cropRect,
      imageAppliedCrop: imageSettings.appliedCrop,
      imagePanX: imageSettings.panX,
      imagePanY: imageSettings.panY,
      imageThreshold: imageSettings.threshold,
      imageDarkIsFilled: imageSettings.darkIsFilled,
      imagePositionLocked: imageSettings.positionLocked,
    }),
    [gridW, gridH, cells, yarnSettings, progress, imageSettings],
  );

  const handleSaveDisplayName = useCallback(
    async (name: string) => {
      if (!supabase || !user) return;
      const { error } = await upsertProfile(supabase, user.id, name);
      if (!error) setDisplayName(name);
    },
    [supabase, user],
  );

  const handleTogglePublic = useCallback(
    async (id: string, isPublic: boolean) => {
      if (!supabase || !user) return;
      if (isPublic && !displayName) {
        setDisplayNameModalMsg("You need a display name before sharing patterns publicly.");
        setDisplayNameModalOpen(true);
        return;
      }
      setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, is_public: isPublic } : p)));
      const { error } = await setPatternPublic(supabase, id, user.id, isPublic);
      if (error) {
        console.error(error);
        setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, is_public: !isPublic } : p)));
      }
    },
    [supabase, user, displayName],
  );

  const persistPattern = useCallback(async () => {
    if (!supabase || !user || !selectedPatternId || !activePattern) return;
    const thumbnail = generateGridThumbnail(cells);
    const { error } = await upsertPattern(supabase, {
      id: selectedPatternId,
      user_id: user.id,
      name: activePattern.name,
      grid_width: gridW,
      grid_height: gridH,
      grid_data: serializeGridCells(cells),
      progress_data: serializeProgressData(progress),
      yarn_settings: serializePatternYarnSettings(yarnSettings),
      image_settings: serializeImageSettings(imageSettings),
      thumbnail: thumbnail || null,
    });
    if (error) console.error(error);
  }, [supabase, user, selectedPatternId, activePattern, gridW, gridH, cells, yarnSettings, progress, imageSettings]);

  const [saveIndicator, setSaveIndicator] = useState<"idle" | "pending" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<number | undefined>(undefined);
  const dirtyKeyMountRef = useRef(false);

  // Mark pending whenever the user changes something (skip initial mount)
  useEffect(() => {
    if (!dirtyKeyMountRef.current) { dirtyKeyMountRef.current = true; return; }
    setSaveIndicator((prev) => (prev === "saving" ? prev : "pending"));
  }, [dirtyKey]);

  // Shared save handler — used by both autosave and the manual Save button
  const handleSave = useCallback(async () => {
    if (!supabase || !user || !selectedPatternId || !activePattern) return;
    setSaveIndicator("saving");
    await persistPattern();
    setSaveIndicator("saved");
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(
      () => setSaveIndicator("idle"),
      2500,
    ) as unknown as number;
  }, [supabase, user, selectedPatternId, activePattern, persistPattern]);

  useAutoSave({
    enabled: Boolean(supabase && user && selectedPatternId && activePattern),
    delayMs: 2000,
    dirtyKey,
    onSave: handleSave,
  });

  return (
    <div className="flex h-screen flex-col bg-white/65 text-stone-800 max-md:h-auto max-md:min-h-screen">
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/40 bg-white/80 px-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3 md:gap-5">
          <Link
            href="/"
            className="font-serif text-xl font-bold text-brand hover:text-brand-dark"
          >
            Gridwork
          </Link>
          {/* Patterns drawer toggle — narrow only */}
          <button
            type="button"
            onClick={() => setSidebarOpen((p) => !p)}
            className="rounded-md border border-stone-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 md:hidden"
          >
            {sidebarOpen ? "✕ Close" : "Patterns"}
          </button>
          {/* Learn / Gallery links — desktop only */}
          <Link href="/learn" className="hidden text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700 md:inline">
            Learn
          </Link>
          <Link href="/gallery" className="hidden text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700 md:inline">
            Gallery
          </Link>
        </div>

        {/* Desktop right side */}
        {user ? (
          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/profile"
              className="text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700"
            >
              Profile
            </Link>
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
            id="tutorial-login"
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="hidden cursor-pointer rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark md:inline-flex"
          >
            Log in
          </button>
        )}

        {/* Narrow: hamburger + dropdown */}
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="rounded-md border border-stone-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            aria-label="Menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
              <Link
                href="/learn"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
              >
                Learn
              </Link>
              <Link
                href="/gallery"
                onClick={() => setMenuOpen(false)}
                className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
              >
                Gallery
              </Link>
              {user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => { void handleLogout(); setMenuOpen(false); }}
                    className="w-full border-t border-stone-100 px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <button
                  id="tutorial-login"
                  type="button"
                  onClick={() => { setAuthModalOpen(true); setMenuOpen(false); }}
                  className="w-full border-t border-stone-100 px-4 py-3 text-left text-sm font-medium text-brand hover:bg-pink-50"
                >
                  Log in
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
          {/* Narrow backdrop — closes drawer when tapping outside */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar: always inline on md+; slide-in drawer on narrow */}
          <div
            className={`max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl max-md:transition-transform max-md:duration-200 md:flex md:shrink-0 ${
              sidebarOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
            }`}
          >
            <PatternSidebar
              user={user}
              supabase={supabase}
              displayName={displayName}
              onSaveDisplayName={handleSaveDisplayName}
              patterns={patterns}
              patternsLoading={patternsLoading}
              selectedPatternId={selectedPatternId}
              onSelectPattern={(id) => { setSelectedPatternId(id); setSidebarOpen(false); }}
              onCreateNew={handleCreateNew}
              onOpenAuth={() => setAuthModalOpen(true)}
              onRenamePattern={handleRenamePattern}
              onDeletePattern={handleDeletePattern}
              onTogglePublic={handleTogglePublic}
            />
          </div>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-6 max-md:p-3">
            {configError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {configError}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4 max-md:flex-none">
                <div className="flex shrink-0 items-center gap-1.5 text-xs">
                  {user && selectedPatternId ? (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        saveIndicator === "saving"
                          ? "animate-pulse bg-amber-400"
                          : saveIndicator === "saved"
                            ? "bg-teal-500"
                            : saveIndicator === "pending"
                              ? "bg-amber-400"
                              : "bg-stone-300"
                      }`} />
                      <span className={
                        saveIndicator === "saved" ? "text-teal-600" :
                        saveIndicator === "pending" ? "text-stone-500" :
                        "text-stone-400"
                      }>
                        {saveIndicator === "saving" ? "Saving…" :
                         saveIndicator === "saved" ? "Saved" :
                         saveIndicator === "pending" ? "Unsaved changes" :
                         "Autosave on"}
                      </span>
                    </>
                  ) : !user ? (
                    <span className="text-stone-400">Sign in to save your work</span>
                  ) : null}
                </div>

                {user && !selectedPatternId && (
                  <div className="flex shrink-0 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span>This pattern isn't saved yet.</span>
                    <button
                      type="button"
                      onClick={() => void handleSaveCurrentAsPattern()}
                      className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-brand-dark"
                    >
                      Save pattern
                    </button>
                  </div>
                )}

                <div
                  id="tutorial-grid-size"
                  className="flex shrink-0 flex-wrap items-end gap-3"
                >
                  {/* Presets */}
                  <div className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                    <span>Presets</span>
                    <select
                      value=""
                      onChange={(e) => {
                        const label = e.target.value;
                        const preset = GRID_PRESETS.find((p) => p.label === label);
                        if (!preset) return;
                        setAspectLocked(false);
                        handleBestFitGrid(preset.w, preset.h);
                        e.target.value = "";
                      }}
                      className="rounded-lg border border-brand/15 bg-white px-2 py-1 text-sm text-stone-900 shadow-sm"
                    >
                      <option value="" disabled>
                        Choose…
                      </option>
                      {GRID_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Width / aspect-lock / Height */}
                  <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                    Width
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={gridW}
                      onChange={(e) => handleWidthChange(Number(e.target.value))}
                      className="w-20 rounded-lg border border-rose-100 bg-white px-2 py-1 text-sm text-stone-900 shadow-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleToggleAspectLock}
                    title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    className={`mt-4 rounded-md border border-gray-300 bg-white/80 p-1.5 transition-colors hover:bg-pink-50 ${
                      aspectLocked ? "text-brand" : "text-gray-400"
                    }`}
                  >
                    {aspectLocked ? (
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="12" height="8" rx="1.5" />
                        <path d="M5 7V5a3 3 0 016 0v2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="12" height="8" rx="1.5" />
                        <path d="M5 7V5a3 3 0 016 0V2" />
                      </svg>
                    )}
                  </button>
                  <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
                    Height
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={gridH}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                      className="w-20 rounded-lg border border-rose-100 bg-white px-2 py-1 text-sm text-stone-900 shadow-sm"
                    />
                  </label>

                  <div id="tutorial-row-progress" className="flex flex-wrap gap-2 max-md:w-full">
                    {/* Yarn drawer toggle: only shown below xl breakpoint */}
                    <button
                      type="button"
                      onClick={() => setYarnOpen((p) => !p)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 xl:hidden max-md:px-2 max-md:py-1 max-md:text-xs"
                    >
                      {yarnOpen ? "Hide Yarn Estimate" : "Yarn Estimate"}
                    </button>
                    <button
                      type="button"
                      disabled={!canUndo}
                      onClick={() => undo()}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40 max-md:px-2 max-md:py-1 max-md:text-xs"
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      disabled={!canRedo}
                      onClick={() => redo()}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40 max-md:px-2 max-md:py-1 max-md:text-xs"
                    >
                      Redo
                    </button>
                    <button
                      type="button"
                      disabled={progress.currentRow <= 0}
                      onClick={() => handleStepCurrentRow(-1)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40 max-md:px-2 max-md:py-1 max-md:text-xs"
                    >
                      Prev row
                    </button>
                    <button
                      type="button"
                      disabled={progress.currentRow >= gridH - 1}
                      onClick={() => handleStepCurrentRow(1)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40 max-md:px-2 max-md:py-1 max-md:text-xs"
                    >
                      Next row
                    </button>
                    {user && selectedPatternId && (
                      <button
                        type="button"
                        disabled={saveIndicator === "saving"}
                        onClick={() => void handleSave()}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 max-md:px-2 max-md:py-1 max-md:text-xs ${
                          saveIndicator === "saved"
                            ? "border border-teal-200 bg-teal-50 text-teal-700"
                            : "border border-brand/30 bg-brand/8 text-brand hover:bg-brand/15"
                        }`}
                      >
                        {saveIndicator === "saving" ? "Saving…" : saveIndicator === "saved" ? "Saved ✓" : "Save"}
                      </button>
                    )}
                    <button
                      id="tutorial-print"
                      type="button"
                      disabled={!selectedPatternId}
                      onClick={() => {
                        if (!selectedPatternId) return;
                        window.open(`/print/${selectedPatternId}`, "_blank", "noopener,noreferrer");
                      }}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-40 max-md:px-2 max-md:py-1 max-md:text-xs"
                    >
                      Print
                    </button>
                  </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 xl:flex-row xl:items-stretch max-md:flex-none">
                  <div className={`relative flex min-h-0 min-w-0 flex-1 flex-col max-md:flex-none transition-all duration-200 ${gridFullscreen ? "z-30 pointer-events-none" : ""}`}>
                    <ImageTools
                      gridWidth={gridW}
                      gridHeight={gridH}
                      cells={cells}
                      onCommit={handleCommitGrid}
                      onApplyConvertedGrid={handleApplyConvertedGrid}
                      onBestFitGrid={handleBestFitGrid}
                      onImageLoad={handleImageLoad}
                      onCropExpandedChange={setImageCropExpanded}
                      onGridFullscreenChange={setGridFullscreen}
                      onUndo={undo}
                      onRedo={redo}
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onStepRow={handleStepCurrentRow}
                      progress={progress}
                      onToggleRowComplete={handleToggleRowComplete}
                      savedImageSettings={imageSettings}
                      imageSettingsLoadKey={imageSettingsLoadKey}
                      onImageSettingsChange={handleImageSettingsChange}
                      className="min-h-0 max-md:flex-none"
                    />
                  </div>

                  {/* Yarn estimator: always visible on xl+, drawer toggle on narrower; blurred when crop or grid is fullscreen */}
                  <div
                    className={`xl:flex xl:w-80 xl:shrink-0 xl:flex-col ${
                      yarnOpen ? "flex flex-col" : "hidden xl:flex"
                    } ${
                      imageCropExpanded || gridFullscreen
                        ? "pointer-events-none"
                        : ""
                    }`}
                  >
                    <YarnEstimator
                      gridWidth={gridW}
                      gridHeight={gridH}
                      filledCellCount={filledCellCount}
                      emptyCellCount={emptyCellCount}
                      value={yarnSettings}
                      onChange={handleYarnSettingsChange}
                      className="w-full xl:z-10"
                    />
                  </div>
                </div>
              </div>
            )}
          </main>
      </div>

      {supabase && user && (
        <DisplayNameModal
          open={displayNameModalOpen}
          userId={user.id}
          supabase={supabase}
          message={displayNameModalMsg}
          onSaved={(name) => {
            setDisplayName(name);
            setDisplayNameModalOpen(false);
            setDisplayNameModalMsg(undefined);
          }}
          onSkip={() => {
            skippedDisplayNameRef.current = true;
            setDisplayNameModalOpen(false);
            setDisplayNameModalMsg(undefined);
          }}
        />
      )}

      <TutorialSpotlight />

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
