"use client";

import { AuthModal } from "@/components/AuthModal";
import { ChassisNav } from "@/components/ChassisNav";
import { DisplayNameModal } from "@/components/DisplayNameModal";
import { FlipSwitch } from "@/components/machine/FlipSwitch";
import { RotaryKnob } from "@/components/machine/RotaryKnob";
import { useNavAuth } from "@/components/NavAuthProvider";
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
import {
  loadManilaStock,
  manilaHex,
  MANILA_STOCKS,
  parseManilaStockFromSettings,
  saveManilaStock,
  type ManilaStockId,
} from "@/lib/manilaStock";
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

export type EditorWorkspaceProps = {
  /** When true, omit ChassisNav and fill parent (machine reader bay). */
  embedded?: boolean;
  /** Select this pattern once the user's list loads. */
  initialPatternId?: string | null;
  /** Collapse reader back to hopper. */
  onReturn?: () => void;
  /** Hide pattern list sidebar (Profile owns your cards). */
  hideSidebar?: boolean;
};

export function EditorWorkspace({
  embedded = false,
  initialPatternId = null,
  onReturn,
  hideSidebar = false,
}: EditorWorkspaceProps) {
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
  const initialPatternApplied = useRef(false);
  useEffect(() => {
    if (!initialPatternId || initialPatternApplied.current) return;
    setSelectedPatternId(initialPatternId);
    initialPatternApplied.current = true;
  }, [initialPatternId]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aspectLocked, setAspectLocked] = useState(false);
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const [manilaStock, setManilaStock] = useState<ManilaStockId>("manila");
  const [imageCropExpanded, setImageCropExpanded] = useState(false);
  const [gridFullscreen, setGridFullscreen] = useState(false);
  const enterFullscreenRef = useRef<(() => void) | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const { setDisplayName: setNavDisplayName } = useNavAuth();

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
  useEffect(() => {
    setManilaStock(loadManilaStock());
  }, []);

  const paperColor = manilaHex(manilaStock);

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
        setManilaStock(parseManilaStockFromSettings(fromList.image_settings));
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
        setManilaStock(parseManilaStockFromSettings(data.image_settings));
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
    const thumbnail = generateGridThumbnail(cells, { stockId: manilaStock });
    const { data, error } = await upsertPattern(supabase, {
      user_id: user.id,
      name: "Untitled",
      grid_data: serializeGridCells(cells),
      grid_width: gridW,
      grid_height: gridH,
      progress_data: serializeProgressData(progress),
      yarn_settings: serializePatternYarnSettings(yarnSettings),
      image_settings: serializeImageSettings(imageSettings, { manila_stock: manilaStock }),
      thumbnail: thumbnail || null,
    });
    if (error) {
      console.error(error);
      return;
    }
    await loadPatterns(supabase, user.id);
    if (data?.id) setSelectedPatternId(data.id);
  }, [supabase, user, cells, gridW, gridH, progress, yarnSettings, imageSettings, manilaStock, loadPatterns]);

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
      if (!error) {
        setDisplayName(name);
        setNavDisplayName(name);
      }
    },
    [supabase, user, setNavDisplayName],
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
    const thumbnail = generateGridThumbnail(cells, { stockId: manilaStock });
    const { error } = await upsertPattern(supabase, {
      id: selectedPatternId,
      user_id: user.id,
      name: activePattern.name,
      grid_width: gridW,
      grid_height: gridH,
      grid_data: serializeGridCells(cells),
      progress_data: serializeProgressData(progress),
      yarn_settings: serializePatternYarnSettings(yarnSettings),
      image_settings: serializeImageSettings(imageSettings, { manila_stock: manilaStock }),
      thumbnail: thumbnail || null,
    });
    if (error) console.error(error);
  }, [supabase, user, selectedPatternId, activePattern, gridW, gridH, cells, yarnSettings, progress, imageSettings, manilaStock]);

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
    <div className={`relative flex flex-col bg-paper ${embedded ? "h-full min-h-0" : "h-screen max-md:h-auto max-md:min-h-screen"}`}>
      {!embedded && (
        <ChassisNav
          activePage="editor"
          loginButtonId="tutorial-login"
          leading={
            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              className="punch-key text-[10px] md:hidden"
            >
              {sidebarOpen ? "Close" : "Hopper"}
            </button>
          }
        />
      )}

      {/* Chassis machine body */}
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${embedded ? "punch-chassis punch-chassis-flush" : "mx-2 mb-2 mt-2 punch-chassis max-md:mx-0 max-md:mb-0 max-md:mt-0 max-md:rounded-none max-md:border-0"}`}>
        {/* Title strip — pattern name + save status only */}
        <div
          className="flex shrink-0 flex-wrap items-center gap-3 border-b border-chassis-dark px-3 py-2 md:px-4"
          style={{ background: "var(--chassis-light)", borderRadius: 0 }}
        >
          {embedded && !hideSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              className="punch-key text-[10px] md:hidden"
            >
              {sidebarOpen ? "Close" : "Cards"}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] font-bold tracking-[0.14em] text-recess uppercase">
              {embedded ? "Program" : "Editing"}
            </div>
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
                  className="min-w-[120px] border-b-2 border-key-blue bg-transparent font-mono text-[16px] font-bold text-ink focus:outline-none"
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
                  className={`font-mono text-[16px] font-bold tracking-[0.04em] text-ink uppercase text-left ${selectedPatternId ? "cursor-pointer" : "cursor-default"}`}
                >
                  {activePattern?.name ?? "Unsaved pattern"}
                </button>
              )}
              {user && selectedPatternId && (
                <span className="font-mono text-[9px] font-bold tracking-[0.08em] text-recess uppercase">
                  {saveIndicator === "saving" ? "Saving…" : saveIndicator === "saved" ? "Saved" : saveIndicator === "pending" ? "Unsaved" : "Autosave on"}
                </span>
              )}
              {!user && <span className="font-mono text-[9px] text-recess uppercase">Sign in to save</span>}
            </div>
          </div>
        </div>

        {/* Body: hopper | canvas | dock */}
        <div className="relative flex min-h-0 flex-1">
          {!hideSidebar && sidebarOpen && (
            <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}
          {!hideSidebar && (
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
          )}

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-paper p-3 max-md:p-2">
            {configError ? (
              <div className="rounded-sm border border-amber-300 bg-amber-50 p-4 font-mono text-sm text-amber-900">
                {configError}
              </div>
            ) : (
              <div className="flex flex-col gap-3 xl:flex-1 xl:min-h-0">
                {/* Functional control panel — IBM 129 analog mix */}
                <div
                  id="tutorial-grid-size"
                  className="punch-metal relative flex w-full shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-3 border border-chassis-dark bg-recess px-4 py-2"
                  style={{ borderRadius: 0 }}
                >
                  <span className="font-mono text-[8px] font-bold tracking-[0.14em] text-chassis-light uppercase">
                    Controls
                  </span>

                  <RotaryKnob
                    label="Stock"
                    value={manilaStock}
                    options={MANILA_STOCKS.map((s) => ({ value: s.id, label: s.label }))}
                    onChange={(id) => {
                      setManilaStock(id);
                      saveManilaStock(id);
                    }}
                    accent={manilaHex(manilaStock)}
                    size={28}
                  />

                  <div id="tutorial-pencil">
                    <FlipSwitch
                      label={drawMode === "block" ? "Block" : "Mesh"}
                      on={drawMode === "mesh"}
                      onClick={() => setDrawMode((m) => (m === "block" ? "mesh" : "block"))}
                      title="Toggle Block / Mesh"
                      size="sm"
                    />
                  </div>

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
                    className="punch-metal-select"
                    title="Size preset"
                  >
                    <option value="" disabled>Preset…</option>
                    {GRID_PRESETS.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Width"
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
                        className="punch-readout"
                      />
                      <span className="font-mono text-[6px] font-bold tracking-[0.12em] text-chassis-light uppercase">W</span>
                    </div>
                    <FlipSwitch
                      label={aspectLocked ? "Lock" : "Free"}
                      on={aspectLocked}
                      onClick={handleToggleAspectLock}
                      title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                      size="sm"
                    />
                    <div className="flex flex-col items-center gap-0.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Height"
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
                        className="punch-readout"
                      />
                      <span className="font-mono text-[6px] font-bold tracking-[0.12em] text-chassis-light uppercase">H</span>
                    </div>
                  </div>

                  <span className="hidden h-6 w-px bg-chassis-dark sm:inline-block" />

                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={() => undo()}
                    title="Undo"
                    className="punch-lamp punch-lamp-clear !min-h-[32px] !px-2.5 text-[9px]"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    disabled={!canRedo}
                    onClick={() => redo()}
                    title="Redo"
                    className="punch-lamp punch-lamp-clear !min-h-[32px] !px-2.5 text-[9px]"
                  >
                    Redo
                  </button>

                  <span className="hidden h-6 w-px bg-chassis-dark sm:inline-block" />

                  <button
                    id="tutorial-print"
                    type="button"
                    disabled={!selectedPatternId}
                    onClick={() => {
                      if (!selectedPatternId) return;
                      window.open(`/print/${selectedPatternId}`, "_blank", "noopener,noreferrer");
                    }}
                    className="punch-lamp punch-lamp-amber !min-h-[32px] !px-2.5 text-[9px]"
                  >
                    Print
                  </button>

                  {user && !selectedPatternId && (
                    <button type="button" onClick={() => void handleSaveCurrentAsPattern()} className="punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px]">
                      Save
                    </button>
                  )}
                  {user && selectedPatternId && (
                    <button type="button" disabled={saveIndicator === "saving"} onClick={() => void handleSave()} className="punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px]">
                      {saveIndicator === "saving" ? "Saving…" : "Save"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => enterFullscreenRef.current?.()}
                    className="punch-lamp punch-lamp-blue !min-h-[32px] !px-2.5 text-[9px]"
                    title="Fullscreen follow-along"
                  >
                    Full
                  </button>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:flex-1 xl:min-h-0 xl:min-w-0 xl:items-stretch">
                  <div className={`relative flex flex-col gap-2 xl:flex-1 xl:min-h-0 xl:min-w-0 transition-all duration-200 ${gridFullscreen ? "z-30 pointer-events-none" : ""}`}>
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
                      paperColor={paperColor}
                      hideFullscreenEntry
                      enterFullscreenRef={enterFullscreenRef}
                      className="xl:flex-1 xl:min-h-0"
                    />

                    {/* Reader strip — row progress + steppers */}
                    <div
                      id="tutorial-row-progress"
                      className="flex shrink-0 flex-wrap items-center gap-3 border-2 border-reader-edge px-3 py-2"
                      style={{ background: "var(--reader)" }}
                    >
                      <div className="font-mono text-[9px] font-bold tracking-[0.14em] text-recess uppercase">
                        Card reader
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-bold tabular-nums text-ink">
                          {String(progress.currentRow + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-sm text-recess">/ {String(gridH).padStart(2, "0")}</span>
                      </div>
                      <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden bg-card-edge">
                        <div className="h-full bg-key-blue transition-all" style={{ width: `${completedPct}%` }} />
                      </div>
                      <button type="button" disabled={progress.currentRow <= 0} onClick={() => handleStepCurrentRow(-1)} className="punch-key text-[10px]">
                        ← Row
                      </button>
                      <button type="button" disabled={progress.currentRow >= gridH - 1} onClick={() => handleStepCurrentRow(1)} className="punch-key text-[10px]">
                        Row →
                      </button>
                      <span className="font-mono text-[10px] text-recess">
                        <span className="font-bold text-ink">{filledCellCount}</span> holes ·{" "}
                        <span className="font-bold text-ink">{emptyCellCount}</span> open
                      </span>
                    </div>
                  </div>

                  {/* Right dock: Yarn | Import */}
                  <div
                    className="flex w-full flex-col border border-chassis-dark bg-chassis-light xl:w-72 xl:shrink-0 xl:overflow-y-auto"
                    style={{ pointerEvents: imageCropExpanded || gridFullscreen ? "none" : undefined }}
                  >
                    <div id="tutorial-image-tools" className="flex border-b border-chassis-dark">
                      {([
                        { key: "draw" as const, label: "Yarn" },
                        { key: "import" as const, label: "Import" },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setEditorMode(key)}
                          className={`flex-1 py-2 font-mono text-[10px] font-bold tracking-[0.12em] uppercase ${
                            editorMode === key
                              ? "bg-chassis-dark text-card"
                              : "text-ink/60 hover:bg-chassis/40"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="p-3">
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
            setNavDisplayName(name);
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
