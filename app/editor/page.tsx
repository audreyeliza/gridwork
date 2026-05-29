"use client";

import { AuthModal } from "@/components/AuthModal";
import { CrochetMark } from "@/components/CrochetMark";
import { DisplayNameModal } from "@/components/DisplayNameModal";
import { NavUserSection } from "@/components/NavUserSection";
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

function loadLocalImageSettings(key: string): PatternImageSettings | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const parsed = parseImageSettings(JSON.parse(raw));
    return parsed.imageDataUrl ? parsed : null;
  } catch {
    return null;
  }
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
  const [imageCropExpanded, setImageCropExpanded] = useState(false);
  const [gridFullscreen, setGridFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"draw" | "import">("draw");
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [drawMode, setDrawMode] = useState<"block" | "mesh">("block");
  const [importPanelEl, setImportPanelEl] = useState<HTMLDivElement | null>(null);
  const [wDraft, setWDraft] = useState<string>("10");
  const [hDraft, setHDraft] = useState<string>("10");

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

  const drawTool = drawMode === "block" ? "pencil" as const : "eraser" as const;

  // Keep draft inputs in sync when gridW/gridH are changed externally (preset picker, DB load)
  useEffect(() => { setWDraft(String(gridW)); }, [gridW]);
  useEffect(() => { setHDraft(String(gridH)); }, [gridH]);

  const activePattern = useMemo(
    () => patterns.find((p) => p.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId],
  );

  const completedCount = useMemo(
    () => progress.rowComplete.filter(Boolean).length,
    [progress.rowComplete],
  );
  const completedPct = gridH > 0 ? Math.round((completedCount / gridH) * 100) : 0;

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

  // Back up image settings to localStorage so they survive refresh / logout.
  // Debounced 800ms to avoid rapid writes during slider drags.
  useEffect(() => {
    const key = selectedPatternId ? `gridwork:imgset:${selectedPatternId}` : "gridwork:imgset:draft";
    if (!imageSettings.imageDataUrl) {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    const timerId = window.setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(imageSettings)); } catch {}
    }, 800);
    return () => window.clearTimeout(timerId);
  }, [imageSettings, selectedPatternId]);

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
      isLoadingRef.current = true;
      setGridW(10);
      setGridH(10);
      reset(createEmptyGrid(10, 10));
      setYarnSettings({ ...DEFAULT_PATTERN_YARN_SETTINGS });
      setProgress(defaultProgressState(10));
      setImageSettings(loadLocalImageSettings("gridwork:imgset:draft") ?? { ...DEFAULT_PATTERN_IMAGE_SETTINGS });
      setImageSettingsLoadKey("unsaved-" + Date.now());
      window.setTimeout(() => { isLoadingRef.current = false; }, 0);
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
        isLoadingRef.current = true;
        setGridW(w);
        setGridH(h);
        reset(parseGridData(fromList.grid_data, w, h));
        setYarnSettings(parsePatternYarnSettings(fromList.yarn_settings));
        setProgress(parseProgressData(fromList.progress_data, h));
        const dbImgA = parseImageSettings(fromList.image_settings);
        setImageSettings(dbImgA.imageDataUrl ? dbImgA : (loadLocalImageSettings(`gridwork:imgset:${fromList.id}`) ?? dbImgA));
        setImageSettingsLoadKey(fromList.id + "-" + fromList.updated_at);
        window.setTimeout(() => { isLoadingRef.current = false; }, 0);
        return;
      }

      void fetchPatternById(supabase, selectedPatternId, user.id).then(({ data }) => {
        if (cancelled || !data) return;
        const w = clampGridSize(data.grid_width);
        const h = clampGridSize(data.grid_height);
        isLoadingRef.current = true;
        setGridW(w);
        setGridH(h);
        reset(parseGridData(data.grid_data, w, h));
        setYarnSettings(parsePatternYarnSettings(data.yarn_settings));
        setProgress(parseProgressData(data.progress_data, h));
        const dbImgB = parseImageSettings(data.image_settings);
        setImageSettings(dbImgB.imageDataUrl ? dbImgB : (loadLocalImageSettings(`gridwork:imgset:${data.id}`) ?? dbImgB));
        setImageSettingsLoadKey(data.id + "-" + data.updated_at);
        setPatterns((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]));
        window.setTimeout(() => { isLoadingRef.current = false; }, 0);
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
      imageZoom: imageSettings.imageZoom,
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
  const isLoadingRef = useRef(false);

  // Reset the mount guard on pattern switch so the load's dirtyKey change is skipped
  useEffect(() => {
    dirtyKeyMountRef.current = false;
  }, [selectedPatternId]);

  // Mark pending whenever the user changes something (skip initial mount)
  useEffect(() => {
    if (!dirtyKeyMountRef.current) { dirtyKeyMountRef.current = true; return; }
    setSaveIndicator((prev) => (prev === "saving" ? prev : "pending"));
  }, [dirtyKey]);

  // Shared save handler — used by both autosave and the manual Save button
  const handleSave = useCallback(async () => {
    if (!supabase || !user || !selectedPatternId || !activePattern) return;
    if (isLoadingRef.current) return;
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
    <div className="relative flex h-screen flex-col max-md:h-auto max-md:min-h-screen">
      {/* Transparent navbar — absolute over gradient */}
      <header className="absolute left-0 right-0 top-0 z-20 flex h-[68px] items-center justify-between gap-4 px-5 max-md:px-4 md:gap-6 md:px-8">
        <div className="flex min-w-0 items-center gap-4 md:gap-9">
          <Link href="/" className="inline-flex shrink-0 items-center gap-[9px] font-serif text-2xl font-bold leading-none tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
            <CrochetMark size={22} color="#fff" />
            Gridwork
          </Link>
          {/* Patterns drawer toggle — narrow only */}
          <button type="button" onClick={() => setSidebarOpen((p) => !p)} className="shrink-0 rounded-md border border-white/40 bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/30 md:hidden">
            {sidebarOpen ? "✕" : "Patterns"}
          </button>
          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Home</Link>
            <Link href="/learn" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Learn</Link>
            <Link href="/gallery" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Gallery</Link>
            <span className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full bg-white" />
              Editor
            </span>
          </nav>
        </div>
        <div className="max-md:ml-3 shrink-0 md:ml-0">
          <NavUserSection activePage="editor" loginButtonId="tutorial-login" />
        </div>
      </header>

      {/* Floating cream app panel — inset from viewport edges, sits on gradient */}
      <div
        className="absolute inset-x-3 bottom-3 top-[80px] flex flex-col overflow-hidden rounded-[18px] max-md:static max-md:mt-[68px] max-md:h-auto max-md:rounded-none max-md:inset-x-0 max-md:bottom-0"
        style={{
          background: "#FBF7EF",
          boxShadow: "0 10px 40px rgba(40,20,30,0.12), 0 0 0 1px rgba(255,255,255,0.5)",
        }}
      >
        {/* ── Toolbar ── */}
        <div
          className="flex shrink-0 flex-col gap-2 px-4 py-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-2.5 md:px-5 md:py-2.5"
          style={{ borderBottom: "1px solid rgba(61,42,30,0.10)" }}
        >
          {/* Left: pattern name + save indicator */}
          <div className="min-w-0 md:flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Editing</div>
            <div className="flex flex-wrap items-center gap-2">
              {isRenamingTitle ? (
                <input
                  autoFocus
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    if (selectedPatternId && titleDraft.trim()) {
                      void handleRenamePattern(selectedPatternId, titleDraft.trim());
                    }
                    setIsRenamingTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (selectedPatternId && titleDraft.trim()) {
                        void handleRenamePattern(selectedPatternId, titleDraft.trim());
                      }
                      setIsRenamingTitle(false);
                    } else if (e.key === "Escape") {
                      setIsRenamingTitle(false);
                    }
                  }}
                  className="font-serif text-[22px] font-bold leading-none tracking-[-0.01em] text-text-strong bg-transparent border-b-2 border-brand focus:outline-none min-w-[120px]"
                  style={{ padding: "0 2px" }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedPatternId) return;
                    setTitleDraft(activePattern?.name ?? "");
                    setIsRenamingTitle(true);
                  }}
                  title={selectedPatternId ? "Click to rename" : undefined}
                  className={`group/ptitle inline-flex items-center gap-1.5 font-serif text-[22px] font-bold leading-none tracking-[-0.01em] text-text-strong text-left ${selectedPatternId ? "cursor-pointer" : "cursor-default"}`}
                >
                  {activePattern?.name ?? "Unsaved pattern"}
                  {selectedPatternId && (
                    <svg
                      viewBox="0 0 14 14" width="15" height="15"
                      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      className="mb-[-2px] shrink-0 text-muted opacity-0 transition-opacity group-hover/ptitle:opacity-100"
                    >
                      <path d="M10 2l2 2-7 7-2.5.5.5-2.5 7-7z" />
                    </svg>
                  )}
                </button>
              )}
              {/* Save indicator */}
              {user && selectedPatternId && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.05em] ${
                  saveIndicator === "saving"
                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                    : saveIndicator === "saved"
                      ? "border border-green-200 bg-green-50 text-green-700"
                      : saveIndicator === "pending"
                        ? "border border-orange-200 bg-orange-50 text-orange-700"
                        : "border border-[rgba(61,42,30,0.10)] text-muted"
                }`}>
                  <span className={`size-[6px] rounded-full ${
                    saveIndicator === "saving" ? "animate-pulse bg-amber-400"
                    : saveIndicator === "saved" ? "bg-green-600"
                    : saveIndicator === "pending" ? "bg-orange-400"
                    : "bg-stone-300"
                  }`}/>
                  {saveIndicator === "saving" ? "Saving…" : saveIndicator === "saved" ? "Saved a moment ago" : saveIndicator === "pending" ? "Unsaved changes" : "Autosave on"}
                </span>
              )}
              {!user && <span className="font-sans text-[11px] font-medium text-muted">Sign in to save</span>}
            </div>
          </div>

          {/* Middle: grid size — tutorial-grid-size */}
          <div id="tutorial-grid-size" className="flex flex-wrap items-center gap-2">
            {/* Preset selector — hidden on mobile */}
            <div
              className="hidden items-center gap-1.5 rounded-full px-3 py-1 md:inline-flex"
              style={{ background: "#fff", border: "1px solid rgba(61,42,30,0.10)" }}
            >
              <span className="font-sans text-[11px] font-semibold text-muted">Preset</span>
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
                className="max-w-[130px] bg-transparent font-sans text-[12px] font-bold text-text-strong focus:outline-none"
              >
                <option value="" disabled>Choose…</option>
                {GRID_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>{p.label}</option>
                ))}
              </select>
            </div>
            {/* Preset — hidden on mobile */}
            {/* W / aspect-lock / H pill */}
            <div
              className="inline-flex items-center rounded-full"
              style={{ background: "#fff", border: "1px solid rgba(61,42,30,0.10)", padding: "2px" }}
            >
              <span className="px-2.5 font-sans text-[11px] font-bold text-muted">W</span>
              <input
                type="text"
                inputMode="numeric"
                value={wDraft}
                onChange={(e) => setWDraft(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  const n = parseInt(wDraft, 10);
                  if (Number.isNaN(n)) { setWDraft(String(gridW)); } else { handleWidthChange(n); }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = parseInt(wDraft, 10);
                    if (!Number.isNaN(n)) handleWidthChange(n);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-12 rounded-full bg-white px-2 py-1 font-mono text-[12px] font-bold text-text-strong focus:outline-none"
                style={{ border: "1px solid rgba(61,42,30,0.10)" }}
              />
              <button
                type="button"
                onClick={handleToggleAspectLock}
                title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                className={`px-1.5 transition-colors ${aspectLocked ? "text-brand" : "text-muted"}`}
              >
                {aspectLocked ? (
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="12" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="12" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 016 0V2"/></svg>
                )}
              </button>
              <span className="px-2.5 font-sans text-[11px] font-bold text-muted">H</span>
              <input
                type="text"
                inputMode="numeric"
                value={hDraft}
                onChange={(e) => setHDraft(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  const n = parseInt(hDraft, 10);
                  if (Number.isNaN(n)) { setHDraft(String(gridH)); } else { handleHeightChange(n); }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = parseInt(hDraft, 10);
                    if (!Number.isNaN(n)) handleHeightChange(n);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-12 rounded-full bg-white px-2 py-1 font-mono text-[12px] font-bold text-text-strong focus:outline-none"
                style={{ border: "1px solid rgba(61,42,30,0.10)" }}
              />
            </div>
            {/* Undo/Redo — shown inline with W/H on mobile only */}
            <div className="ml-2 flex items-center gap-1 md:hidden">
              <button type="button" disabled={!canUndo} onClick={() => undo()} className="inline-flex items-center rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-text-strong hover:bg-[rgba(61,42,30,0.05)] disabled:opacity-40">Undo</button>
              <button type="button" disabled={!canRedo} onClick={() => redo()} className="inline-flex items-center rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-muted hover:bg-[rgba(61,42,30,0.05)] disabled:opacity-40">Redo</button>
            </div>
          </div>

          {/* Right: actions */}
          <div id="tutorial-row-progress" className="flex flex-wrap items-center gap-1.5">
            <button type="button" disabled={!canUndo} onClick={() => undo()} className="hidden items-center rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-text-strong hover:bg-[rgba(61,42,30,0.05)] disabled:opacity-40 md:inline-flex">Undo</button>
            <button type="button" disabled={!canRedo} onClick={() => redo()} className="hidden items-center rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-muted hover:bg-[rgba(61,42,30,0.05)] disabled:opacity-40 md:inline-flex">Redo</button>
            <span className="mx-1 hidden h-5 w-px md:inline-block" style={{ background: "rgba(61,42,30,0.10)" }}/>
            <button type="button" disabled={progress.currentRow <= 0} onClick={() => handleStepCurrentRow(-1)} className="inline-flex items-center rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-text-strong hover:bg-[rgba(61,42,30,0.05)] disabled:opacity-40">← Row</button>
            <button type="button" disabled={progress.currentRow >= gridH - 1} onClick={() => handleStepCurrentRow(1)} className="inline-flex items-center rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-text-strong hover:bg-[rgba(61,42,30,0.05)] disabled:opacity-40">Row →</button>
            <span className="mx-1 h-5 w-px" style={{ background: "rgba(61,42,30,0.10)" }}/>
            <button id="tutorial-print" type="button" disabled={!selectedPatternId} onClick={() => { if (!selectedPatternId) return; window.open(`/print/${selectedPatternId}`, "_blank", "noopener,noreferrer"); }} className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-text-strong hover:bg-[rgba(61,42,30,0.05)] disabled:opacity-40">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="8" height="10" rx="1.5"/><path d="M3 11V3a1 1 0 011-1h8"/></svg>
              Print
            </button>
            {user && !selectedPatternId && (
              <button type="button" onClick={() => void handleSaveCurrentAsPattern()} className="rounded-full bg-brand px-3 py-1.5 font-sans text-[12px] font-bold text-[#FBF7EF] hover:bg-brand-dark" style={{ boxShadow: "0 4px 14px rgba(168,70,111,0.30)" }}>
                Save
              </button>
            )}
            {user && selectedPatternId && (
              <button type="button" disabled={saveIndicator === "saving"} onClick={() => void handleSave()} className="rounded-full bg-brand px-3 py-1.5 font-sans text-[12px] font-bold text-[#FBF7EF] hover:bg-brand-dark disabled:opacity-50" style={{ boxShadow: "0 4px 14px rgba(168,70,111,0.30)" }}>
                {saveIndicator === "saving" ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>

        {/* ── Mode bar ── */}
        <div
          id="tutorial-image-tools"
          className="flex shrink-0 items-center justify-between gap-3 px-4 py-1.5 md:px-5"
          style={{ borderBottom: "1px solid rgba(61,42,30,0.10)", background: "rgba(168,70,111,0.04)" }}
        >
          <div
            className="inline-flex items-center rounded-full p-1"
            style={{ background: "rgba(31,20,16,0.06)" }}
          >
            {([
              { key: "draw" as const, label: "Yarn estimator", icon: (
                <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 2.5l1 1-7 7-1.5.5.5-1.5 7-7z"/></svg>
              )},
              { key: "import" as const, label: "Import image", icon: (
                <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="12" height="10" rx="1.5"/><path d="M1 8l3-3 3 3 2-2 4 4"/></svg>
              )},
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setEditorMode(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-sans text-[13px] font-bold transition-colors ${
                  editorMode === key
                    ? "bg-[#1F1410] text-[#FBF7EF]"
                    : "text-[#7A6A5F] hover:text-[#3D2A1E]"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <span className="hidden font-mono text-[11px] text-muted sm:inline">
            Row <span className="font-bold text-brand">{progress.currentRow + 1}</span> of {gridH}
          </span>
        </div>

        {/* ── Body: sidebar | canvas | right panel ── */}
        <div className="relative flex min-h-0 flex-1">
          {sidebarOpen && (
            <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}
          <div className={`max-md:fixed max-md:top-0 max-md:bottom-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl max-md:transition-transform max-md:duration-200 md:flex md:shrink-0 ${sidebarOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"}`}>
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

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-5 max-md:p-3">
            {configError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 font-sans text-sm text-amber-900">
                {configError}
              </div>
            ) : (
              <div className="flex flex-col gap-4 xl:flex-1 xl:min-h-0">
                <div className="flex flex-col gap-4 xl:flex-row xl:flex-1 xl:min-h-0 xl:min-w-0 xl:items-stretch">
                  {/* ── Center: tool toggle + canvas + progress ── */}
                  <div className={`relative flex flex-col gap-2 xl:flex-1 xl:min-h-0 xl:min-w-0 transition-all duration-200 ${gridFullscreen ? "z-30 pointer-events-none" : ""}`}>

                    {/* Block / Mesh / Preset — above grid */}
                    <div id="tutorial-pencil" className="flex shrink-0 flex-wrap items-center justify-center gap-3 md:justify-start">
                      <div
                        className="inline-flex items-center rounded-full p-1"
                        style={{ background: "#1F1410" }}
                      >
                        {([
                          { mode: "block" as const, label: "■ Block" },
                          { mode: "mesh" as const, label: "□ Mesh" },
                        ] as const).map(({ mode, label }) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setDrawMode(mode)}
                            className={`rounded-full px-3 py-1 font-sans text-[13px] font-semibold transition-colors ${
                              drawMode === mode
                                ? "bg-white text-[#1F1410]"
                                : "text-white/65 hover:text-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <span className="font-mono text-[11px] text-muted hidden sm:inline">
                        ■ block &nbsp; □ mesh &nbsp; ▬ current row
                      </span>
                    </div>

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
                      sidePanelTarget={editorMode === "import" ? importPanelEl : null}
                      toolOverride={drawTool}
                      onToolOverrideChange={(t) => setDrawMode(t === "pencil" ? "block" : "mesh")}
                      className="xl:flex-1 xl:min-h-0"
                    />

                    {/* Progress bar + cell counts — below grid */}
                    <div className="shrink-0">
                      <div className="mb-1.5 flex items-center justify-between font-sans text-[12px] text-muted">
                        <span>
                          <span className="font-bold" style={{ color: "#A8466F" }}>{completedCount}</span>
                          {" / "}{gridH} rows complete
                        </span>
                        <span className="font-mono text-[11px]">{completedPct}% · row {progress.currentRow + 1}</span>
                      </div>
                      <div className="overflow-hidden rounded-full" style={{ height: 4, background: "rgba(168,70,111,0.12)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${completedPct}%`, background: "#A8466F" }}
                        />
                      </div>
                      <div className="mt-2 font-sans text-[12px] text-muted">
                        <span className="font-bold text-text-strong">{filledCellCount}</span> blocks ·{" "}
                        <span className="font-bold text-text-strong">{emptyCellCount}</span> mesh squares
                      </div>
                    </div>
                  </div>

                  {/* ── Right panel: import controls OR yarn estimator ── */}
                  {/* Mobile toggle button */}
                  <button
                    type="button"
                    onClick={() => setMobilePanelOpen((p) => !p)}
                    className="xl:hidden flex items-center gap-1.5 self-start rounded-full border border-[rgba(61,42,30,0.10)] bg-white px-3 py-1.5 font-sans text-[12px] font-bold text-text-strong"
                  >
                    {editorMode === "import" ? "Import image" : "Yarn"} {mobilePanelOpen ? "▲" : "▾"}
                  </button>
                  <div
                    className={`flex w-full flex-col gap-4 xl:flex xl:w-80 xl:shrink-0 xl:overflow-y-auto xl:gap-0 xl:border-l xl:pl-5 ${!mobilePanelOpen ? "hidden xl:flex" : "flex"} ${imageCropExpanded || gridFullscreen ? "pointer-events-none" : ""}`}
                    style={{ borderColor: "rgba(61,42,30,0.08)" }}
                  >
                    {/* Import panel portal target — always mounted so portal can target it */}
                    <div
                      ref={setImportPanelEl}
                      className={editorMode === "import" ? "flex flex-1 flex-col" : "hidden"}
                    />
                    {editorMode !== "import" && (
                      <YarnEstimator
                        gridWidth={gridW}
                        gridHeight={gridH}
                        filledCellCount={filledCellCount}
                        emptyCellCount={emptyCellCount}
                        value={yarnSettings}
                        onChange={handleYarnSettingsChange}
                        className="w-full"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
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
