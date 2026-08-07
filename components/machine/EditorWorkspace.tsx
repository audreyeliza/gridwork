"use client";

import { AuthModal } from "@/components/AuthModal";
import { ChassisNav } from "@/components/ChassisNav";
import { DisplayNameModal } from "@/components/DisplayNameModal";
import { FlipSwitch } from "@/components/machine/FlipSwitch";
import { RotaryKnob } from "@/components/machine/RotaryKnob";
import { useNavAuth } from "@/components/NavAuthProvider";
import { ImageTools } from "@/components/ImageTools";
import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import { YarnEstimator } from "@/components/YarnEstimator";
import { PatternSidebar } from "@/components/PatternSidebar";
import { shouldAutoOpenTutorial, TutorialSpotlight } from "@/components/TutorialSpotlight";
import { useAutoSave } from "@/hooks/useAutoSave";
import { usePatternHistory } from "@/hooks/usePatternHistory";
import {
  createUntitledPattern,
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
  DEFAULT_PATTERN_IMAGE_DOCUMENT,
  documentHasImage,
  parseImageDocument,
  serializeImageDocument,
  type PatternImageDocument,
} from "@/lib/imageSettings";
import { setPatternPublic } from "@/lib/galleryHelpers";
import { fetchProfile, upsertProfile } from "@/lib/profileHelpers";
import { generateGridThumbnail } from "@/lib/thumbnailUtils";
import {
  DEFAULT_MANILA_STOCK,
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
import { createPortal } from "react-dom";

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
  { value: "10x40", label: "10×40", w: 10, h: 40 },
  { value: "40x40", label: "40×40", w: 40, h: 40 },
  { value: "80x20", label: "80×20", w: 80, h: 20 },
  { value: "30x80", label: "30×80", w: 30, h: 80 },
  { value: "60x80", label: "60×80", w: 60, h: 80 },
] as const;

const SIZE_DIAL_OPTIONS = [
  ...GRID_PRESETS.map((p) => ({ value: p.value, label: p.label })),
  { value: "custom" as const, label: "Custom" },
];

type SizeDialValue = (typeof SIZE_DIAL_OPTIONS)[number]["value"];

function matchSizeDial(w: number, h: number): SizeDialValue {
  const hit = GRID_PRESETS.find((p) => p.w === w && p.h === h);
  return hit?.value ?? "custom";
}

function clampGridSize(n: number): number {
  if (Number.isNaN(n) || n < 5) return 5;
  if (n > 200) return 200;
  return Math.floor(n);
}

/** Demo motif for the console tour when no program is open yet. */
function createTutorialMockGrid(w: number, h: number): boolean[][] {
  const g = createEmptyGrid(w, h);
  const cx = Math.floor(w / 2);
  const top = Math.max(4, Math.floor(h * 0.18));
  const bottom = Math.min(h - 4, Math.floor(h * 0.62));
  for (let r = top; r < bottom; r++) {
    const t = (r - top) / Math.max(1, bottom - top - 1);
    const spread = Math.max(0, Math.round((1 - Math.abs(t * 2 - 1)) * (cx - 1)));
    for (let c = cx - spread; c <= cx + spread; c++) {
      if (c >= 0 && c < w) g[r]![c] = true;
    }
  }
  return g;
}

function loadLocalImageDocument(key: string): PatternImageDocument | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const parsed = parseImageDocument(JSON.parse(raw));
    return documentHasImage(parsed) ? parsed : null;
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
  /** Open the console tour once (e.g. from Manual “Go to tutorial”). */
  forceTutorial?: boolean;
  /** Called after forceTutorial has been applied so the URL flag can clear. */
  onTutorialConsumed?: () => void;
  /** Keep the URL `pattern` param in sync with the open program. */
  onPatternIdChange?: (id: string | null) => void;
  onRequestMaker?: () => void;
  onRequestHopper?: () => void;
  onRequestAuth?: () => void;
};

export function EditorWorkspace({
  embedded = false,
  initialPatternId = null,
  onReturn,
  hideSidebar = false,
  forceTutorial = false,
  onTutorialConsumed,
  onPatternIdChange,
  onRequestMaker,
  onRequestHopper,
  onRequestAuth,
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
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(initialPatternId);
  const [creatingProgram, setCreatingProgram] = useState(false);

  // URL is source of truth for the open program.
  useEffect(() => {
    setSelectedPatternId(initialPatternId);
  }, [initialPatternId]);

  useEffect(() => {
    onPatternIdChange?.(selectedPatternId);
  }, [selectedPatternId, onPatternIdChange]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aspectLocked, setAspectLocked] = useState(false);
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const [manilaStock, setManilaStock] = useState<ManilaStockId>("manila");
  const [gridFullscreen, setGridFullscreen] = useState(false);
  const enterFullscreenRef = useRef<(() => void) | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsPanel, setToolsPanel] = useState<null | "yarn" | "import">(null);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("Untitled");
  const [editLocked, setEditLocked] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [importPanelEl, setImportPanelEl] = useState<HTMLDivElement | null>(null);
  const [wDraft, setWDraft] = useState<string>("10");
  const [hDraft, setHDraft] = useState<string>("40");
  const [sizePreset, setSizePreset] = useState<SizeDialValue>("10x40");
  const zoomApiRef = useRef<{ fit: () => void; zoomIn: () => void; zoomOut: () => void } | null>(null);
  const sizeCustom = sizePreset === "custom";

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayNameModalOpen, setDisplayNameModalOpen] = useState(false);
  const [displayNameModalMsg, setDisplayNameModalMsg] = useState<string | undefined>(undefined);
  const skippedDisplayNameRef = useRef(false);
  const { setDisplayName: setNavDisplayName } = useNavAuth();

  const [gridW, setGridW] = useState(10);
  const [gridH, setGridH] = useState(40);
  const [yarnSettings, setYarnSettings] = useState<PatternYarnSettings>(DEFAULT_PATTERN_YARN_SETTINGS);
  const [progress, setProgress] = useState<PatternProgressState>(() => defaultProgressState(40));
  const [imageDocument, setImageDocument] = useState<PatternImageDocument>({
    images: [],
    activeImageId: null,
  });
  /** Incremented each time a pattern's data is fully loaded from the DB, triggering ImageTools reinit. */
  const [imageSettingsLoadKey, setImageSettingsLoadKey] = useState("");
  const { cells, commit, replace, reset, undo, redo, canUndo, canRedo } = usePatternHistory(gridW, gridH);

  // Keep draft inputs in sync when gridW/gridH are changed externally (preset picker, DB load)
  useEffect(() => { setWDraft(String(gridW)); }, [gridW]);
  useEffect(() => { setHDraft(String(gridH)); }, [gridH]);
  useEffect(() => {
    setManilaStock(loadManilaStock());
  }, []);

  useEffect(() => {
    if (!toolsPanel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsPanel(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toolsPanel]);

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

  const handleImageDocumentChange = useCallback((next: PatternImageDocument) => {
    setImageDocument(next);
  }, []);

  // Back up image settings to localStorage so they survive refresh / logout.
  // Debounced 800ms to avoid rapid writes during slider drags.
  useEffect(() => {
    const key = selectedPatternId ? `gridwork:imgset:${selectedPatternId}` : "gridwork:imgset:draft";
    if (!documentHasImage(imageDocument)) {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    const timerId = window.setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(imageDocument)); } catch {}
    }, 800);
    return () => window.clearTimeout(timerId);
  }, [imageDocument, selectedPatternId]);

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
    if (gridFullscreen) return;
    if (forceTutorial) {
      const id = window.setTimeout(() => {
        setTutorialOpen(true);
        onTutorialConsumed?.();
      }, 400);
      return () => window.clearTimeout(id);
    }
    if (!shouldAutoOpenTutorial()) return;
    const id = window.setTimeout(() => setTutorialOpen(true), 400);
    return () => window.clearTimeout(id);
  }, [gridFullscreen, forceTutorial, onTutorialConsumed]);

  useEffect(() => {
    if (selectedPatternId !== null) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      isLoadingRef.current = true;
      setGridW(10);
      setGridH(40);
      setSizePreset("10x40");
      reset(tutorialOpen ? createTutorialMockGrid(10, 40) : createEmptyGrid(10, 40));
      setYarnSettings({ ...DEFAULT_PATTERN_YARN_SETTINGS });
      setProgress(defaultProgressState(40));
      setImageDocument({ images: [], activeImageId: null });
      setImageSettingsLoadKey((tutorialOpen ? "tutorial-" : "empty-") + Date.now());
      setDraftTitle("Untitled");
      if (!tutorialOpen) setToolsPanel(null);
      window.setTimeout(() => { isLoadingRef.current = false; }, 0);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selectedPatternId, tutorialOpen, reset]);

  useEffect(() => {
    if (!selectedPatternId || !supabase || !user) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      const hydrate = (row: Pattern) => {
        const w = clampGridSize(row.grid_width);
        const h = clampGridSize(row.grid_height);
        isLoadingRef.current = true;
        setGridW(w);
        setGridH(h);
        setSizePreset(matchSizeDial(w, h));
        reset(parseGridData(row.grid_data, w, h));
        setYarnSettings(parsePatternYarnSettings(row.yarn_settings));
        setProgress(parseProgressData(row.progress_data, h));
        const dbImg = parseImageDocument(row.image_settings);
        const resolved =
          documentHasImage(dbImg)
            ? dbImg
            : (loadLocalImageDocument(`gridwork:imgset:${row.id}`) ?? dbImg);
        setImageDocument(resolved);
        setImageSettingsLoadKey(row.id + "-" + row.updated_at);
        setManilaStock(parseManilaStockFromSettings(row.image_settings));
        window.setTimeout(() => { isLoadingRef.current = false; }, 0);
      };

      const fromList = patternsRef.current.find((p) => p.id === selectedPatternId);
      if (fromList) {
        hydrate(fromList);
        return;
      }

      void fetchPatternById(supabase, selectedPatternId, user.id).then(({ data }) => {
        if (cancelled || !data) return;
        hydrate(data);
        setPatterns((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]));
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selectedPatternId, supabase, user, reset]);

  useEffect(() => {
    if (user || filledCellCount === 0 || selectedPatternId === null) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Log in to save your pattern before leaving.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user, filledCellCount, selectedPatternId]);

  const handleCreateNew = useCallback(async () => {
    if (!supabase || !user) {
      onRequestAuth?.();
      return;
    }
    setCreatingProgram(true);
    try {
      const { data, error } = await createUntitledPattern(supabase, user.id, {
        image_settings: serializeImageDocument(DEFAULT_PATTERN_IMAGE_DOCUMENT, {
          manila_stock: manilaStock,
        }),
      });
      if (error) {
        console.error(error);
        return;
      }
      await loadPatterns(supabase, user.id);
      if (data?.id) setSelectedPatternId(data.id);
    } finally {
      setCreatingProgram(false);
    }
  }, [supabase, user, loadPatterns, manilaStock, onRequestAuth]);

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
        setSizePreset(matchSizeDial(w, h));
        replace(resizeGridPreserve(cells, w, h));
        setProgress((p) => ({
          ...p,
          rowComplete: resizeRowComplete(p.rowComplete, h),
          currentRow: clampCurrentRow(p.currentRow, h),
        }));
      } else {
        setGridW(w);
        setSizePreset(matchSizeDial(w, gridH));
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
        setSizePreset(matchSizeDial(w, h));
        replace(resizeGridPreserve(cells, w, h));
        setProgress((p) => ({
          ...p,
          rowComplete: resizeRowComplete(p.rowComplete, h),
          currentRow: clampCurrentRow(p.currentRow, h),
        }));
      } else {
        setGridH(h);
        setSizePreset(matchSizeDial(gridW, h));
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
      setSizePreset(matchSizeDial(cw, ch));
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
    if (!sizeCustom) return;
    if (!aspectLocked) {
      setLockedRatio(gridW / gridH);
    }
    setAspectLocked((prev) => !prev);
  }, [aspectLocked, gridW, gridH, sizeCustom]);

  const handleSizePreset = useCallback(
    (value: SizeDialValue) => {
      setSizePreset(value);
      if (value === "custom") return;
      const preset = GRID_PRESETS.find((p) => p.value === value);
      if (!preset) return;
      setAspectLocked(false);
      setGridW(preset.w);
      setGridH(preset.h);
      replace(resizeGridPreserve(cells, preset.w, preset.h));
      setProgress((p) => ({
        ...p,
        rowComplete: resizeRowComplete(p.rowComplete, preset.h),
        currentRow: clampCurrentRow(p.currentRow, preset.h),
      }));
    },
    [replace, cells],
  );

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
        image_settings: pattern.image_settings,
        thumbnail: pattern.thumbnail ?? null,
        is_public: pattern.is_public,
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
      gridW, gridH, cells, yarnSettings, progress, manilaStock,
      images: imageDocument.images.map((img) => ({
        id: img.id,
        name: img.name,
        visible: img.visible,
        mode: img.mode,
        imageUrlSig: img.imageDataUrl?.length ?? 0,
        underlayOpacityPct: img.underlayOpacityPct,
        cropRect: img.cropRect,
        appliedCrop: img.appliedCrop,
        panX: img.panX,
        panY: img.panY,
        imageZoom: img.imageZoom,
        threshold: img.threshold,
        darkIsFilled: img.darkIsFilled,
        positionLocked: img.positionLocked,
      })),
      activeImageId: imageDocument.activeImageId,
    }),
    [gridW, gridH, cells, yarnSettings, progress, imageDocument, manilaStock],
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
      image_settings: serializeImageDocument(imageDocument, { manila_stock: manilaStock }),
      thumbnail: thumbnail || null,
    });
    if (error) console.error(error);
  }, [supabase, user, selectedPatternId, activePattern, gridW, gridH, cells, yarnSettings, progress, imageDocument, manilaStock]);

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
    delayMs: 800,
    dirtyKey,
    onSave: handleSave,
  });

  const hasOpenProgram = selectedPatternId !== null;
  /** Show grid + tracker during the tour even before a program is selected. */
  const showProgramSurface = hasOpenProgram || tutorialOpen;

  return (
    <div className={`relative flex flex-col ${embedded || gridFullscreen ? "h-full min-h-0" : "h-screen max-md:h-auto max-md:min-h-screen"} ${gridFullscreen ? "bg-transparent" : "bg-paper"}`}>
      {!embedded && !gridFullscreen && (
        <ChassisNav
          activePage="editor"
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
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          embedded || gridFullscreen
            ? "punch-chassis punch-chassis-flush !m-0"
            : "mx-2 mb-2 mt-2 punch-chassis max-md:mx-0 max-md:mb-0 max-md:mt-0 max-md:rounded-none max-md:border-0"
        }`}
      >
        {!gridFullscreen && (
        <div id="tutorial-grid-size" className="punch-console-face !flex-col !items-stretch !justify-between !gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            {embedded && !hideSidebar && (
              <button
                type="button"
                onClick={() => setSidebarOpen((p) => !p)}
                className="punch-key text-[10px] md:hidden"
              >
                {sidebarOpen ? "Close" : "Cards"}
              </button>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                Program
              </span>
              {isRenamingTitle ? (
                <input
                  autoFocus
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    const next = titleDraft.trim() || "Untitled";
                    if (selectedPatternId) {
                      void handleRenamePattern(selectedPatternId, next);
                    } else {
                      setDraftTitle(next);
                    }
                    setIsRenamingTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const next = titleDraft.trim() || "Untitled";
                      if (selectedPatternId) {
                        void handleRenamePattern(selectedPatternId, next);
                      } else {
                        setDraftTitle(next);
                      }
                      setIsRenamingTitle(false);
                    } else if (e.key === "Escape") {
                      setIsRenamingTitle(false);
                    }
                  }}
                  className="min-w-[120px] max-w-full border-b-2 border-key-blue bg-transparent font-mono text-[15px] font-bold tracking-[0.06em] uppercase text-ink focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!hasOpenProgram) return;
                    setTitleDraft(activePattern?.name ?? draftTitle);
                    setIsRenamingTitle(true);
                  }}
                  title={
                    hasOpenProgram
                      ? "Click to rename"
                      : tutorialOpen
                        ? "Tutorial sample"
                        : "No program open"
                  }
                  disabled={!hasOpenProgram}
                  className="min-w-0 truncate font-mono text-[15px] font-bold tracking-[0.06em] uppercase text-left cursor-pointer transition-opacity hover:underline hover:opacity-70 disabled:cursor-default disabled:no-underline disabled:opacity-70"
                  style={{ color: "#0A0A0A" }}
                >
                  {hasOpenProgram
                    ? (activePattern?.name ?? draftTitle)
                    : tutorialOpen
                      ? "Tutorial sample"
                      : "No program"}
                </button>
              )}
            </div>
            {user && selectedPatternId && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-[0.08em] uppercase" style={{ color: "#0A0A0A" }}>
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      saveIndicator === "saving"
                        ? "#C9A227"
                        : saveIndicator === "saved"
                          ? "#2E7D4F"
                          : saveIndicator === "pending"
                            ? "#C62828"
                            : "#2E7D4F",
                    boxShadow:
                      saveIndicator === "saving"
                        ? "0 0 4px #C9A227"
                        : saveIndicator === "saved" || saveIndicator === "idle"
                          ? "0 0 4px #2E7D4F"
                          : "0 0 4px #C62828",
                  }}
                  aria-hidden
                />
                {saveIndicator === "saving"
                  ? "Saving…"
                  : saveIndicator === "saved"
                    ? "Saved"
                    : saveIndicator === "pending"
                      ? "Unsaved"
                      : "Autosave on"}
              </span>
            )}
            {!user && (
              <button
                id="tutorial-login"
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="font-mono text-[9px] uppercase underline underline-offset-2 transition-opacity hover:opacity-70"
                style={{ color: "#0A0A0A" }}
              >
                Sign in to save
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-end gap-4">
            <RotaryKnob
              label="Stock"
              value={manilaStock}
              options={MANILA_STOCKS.map((s) => ({ value: s.id, label: s.label }))}
              onChange={(id) => {
                setManilaStock(id);
                saveManilaStock(id);
              }}
              accent="#0A0A0A"
              pointer="#FFFFFF"
              dial="var(--key-blue)"
            />

            <RotaryKnob
              label="Size"
              value={sizePreset}
              options={SIZE_DIAL_OPTIONS}
              onChange={handleSizePreset}
              accent="#0A0A0A"
              pointer="#FFFFFF"
              dial="var(--key-blue)"
            />

            <div
              className={`flex items-end gap-3 pb-0.5 ${sizeCustom ? "" : "pointer-events-none opacity-40"}`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Width"
                  disabled={!sizeCustom}
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
                <span className="font-mono text-[6px] font-bold tracking-[0.12em] uppercase" style={{ color: "#0A0A0A" }}>W</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Height"
                  disabled={!sizeCustom}
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
                <span className="font-mono text-[6px] font-bold tracking-[0.12em] uppercase" style={{ color: "#0A0A0A" }}>H</span>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <FlipSwitch
                topLabel="Free"
                bottomLabel="Ratio"
                on={aspectLocked}
                orientation="vertical"
                disabled={!sizeCustom}
                onClick={handleToggleAspectLock}
                title={
                  !sizeCustom
                    ? "Switch Size to Custom to edit dimensions"
                    : aspectLocked
                      ? "Unlock aspect ratio"
                      : "Lock aspect ratio"
                }
              />
              <div id="tutorial-pencil" className="flex">
                <FlipSwitch
                  topLabel="Edit"
                  bottomLabel="Lock"
                  on={editLocked}
                  orientation="vertical"
                  onClick={() => setEditLocked((v) => !v)}
                  title={editLocked ? "Unlock editing" : "Lock editing"}
                />
              </div>
              <button
                id="tutorial-image-tools"
                type="button"
                onClick={() => {
                  if (!showProgramSurface) return;
                  setToolsPanel((p) => (p === "import" ? null : "import"));
                }}
                disabled={!showProgramSurface}
                className={`punch-lamp punch-lamp-red !min-h-[32px] !px-2.5 text-[9px] self-end mb-0.5 ${
                  toolsPanel === "import" ? "is-lit" : ""
                }`}
                title={toolsPanel === "import" ? "Close import" : "Import reference image"}
                aria-pressed={toolsPanel === "import"}
              >
                Import
              </button>
            </div>

            <div className="min-w-0 flex-1" />

            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <button
                type="button"
                disabled={!canUndo || editLocked}
                onClick={() => undo()}
                title="Undo"
                className="punch-lamp punch-lamp-orange !min-h-[32px] !px-2.5 text-[9px] disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                disabled={!canRedo || editLocked}
                onClick={() => redo()}
                title="Redo"
                className="punch-lamp punch-lamp-orange !min-h-[32px] !px-2.5 text-[9px] disabled:opacity-40"
              >
                Redo
              </button>
              {user && (
                <button
                  id="tutorial-save"
                  type="button"
                  disabled={
                    creatingProgram ||
                    (Boolean(selectedPatternId) && saveIndicator === "saving")
                  }
                  onClick={() => {
                    if (selectedPatternId) void handleSave();
                    else void handleCreateNew();
                  }}
                  className="punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px]"
                >
                  {creatingProgram
                    ? "…"
                    : selectedPatternId && saveIndicator === "saving"
                      ? "Saving…"
                      : selectedPatternId
                        ? "Save"
                        : "New"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setToolsPanel("yarn")}
                className="punch-lamp punch-lamp-red !min-h-[32px] !px-2.5 text-[9px]"
                title="Yarn estimate"
              >
                Yarn
              </button>
              <button
                id="tutorial-print"
                type="button"
                disabled={!selectedPatternId}
                onClick={() => {
                  if (!selectedPatternId) return;
                  window.open(`/print/${selectedPatternId}`, "_blank", "noopener,noreferrer");
                }}
                className="punch-lamp punch-lamp-violet !min-h-[32px] !px-2.5 text-[9px]"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                title="Tutorial"
                aria-label="Open tutorial"
                aria-pressed={tutorialOpen}
                className={`punch-lamp punch-lamp-blue !min-h-[32px] !min-w-[32px] !px-2.5 text-[11px] font-bold ${
                  tutorialOpen ? "is-lit" : ""
                }`}
              >
                ?
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Body: hopper | canvas | import aside */}
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

          <div
            className={`flex min-h-0 min-w-0 flex-1 ${
              toolsPanel === "import" ? "flex-col md:flex-row" : "flex-col"
            }`}
          >
          <main
            className={`flex min-h-0 min-w-0 flex-1 flex-col ${gridFullscreen ? "overflow-hidden p-0" : "overflow-y-auto p-3 max-md:p-2"}`}
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 45%, rgba(0,0,0,0.12) 100%), var(--console-desk)",
            }}
          >
            {configError ? (
              <div className="rounded-sm border border-amber-300 bg-amber-50 p-4 font-mono text-sm text-amber-900">
                {configError}
              </div>
            ) : !showProgramSurface ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6">
                <div
                  className="punch-card flex w-full max-w-sm flex-col px-6 py-5"
                  style={{
                    ["--manila-stock" as string]: paperColor,
                    background: paperColor,
                  }}
                >
                  <OperatorCardHeader title="Program card" colLabel="JOB PROG" />
                  <h2 className="mt-4 font-mono text-[15px] font-bold tracking-[0.06em] uppercase punch-print-ink">
                    New program
                  </h2>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed punch-print-faint">
                    Create a new card, open one from your deck, or copy a public pattern from the gallery.
                  </p>
                  <div className="mt-5 flex flex-col gap-3">
                    <button
                      type="button"
                      disabled={creatingProgram}
                      onClick={() => {
                        if (!user) {
                          onRequestAuth?.();
                          return;
                        }
                        void handleCreateNew();
                      }}
                      className="punch-print text-left text-[12px] tracking-[0.1em] disabled:opacity-50"
                    >
                      {creatingProgram
                        ? "Creating…"
                        : user
                          ? "New program →"
                          : "Sign in to create →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          onRequestAuth?.();
                          return;
                        }
                        onRequestMaker?.();
                      }}
                      className="punch-print text-left text-[12px] tracking-[0.1em]"
                    >
                      {user ? "Open from your cards →" : "Sign in to open cards →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestHopper?.()}
                      className="punch-print text-left text-[12px] tracking-[0.1em]"
                    >
                      Copy from gallery →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-0">
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <ImageTools
                      gridWidth={gridW}
                      gridHeight={gridH}
                      cells={cells}
                      onCommit={handleCommitGrid}
                      onApplyConvertedGrid={handleApplyConvertedGrid}
                      onBestFitGrid={handleBestFitGrid}
                      onImageLoad={handleImageLoad}
                      onGridFullscreenChange={setGridFullscreen}
                      onUndo={undo}
                      onRedo={redo}
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onStepRow={handleStepCurrentRow}
                      progress={progress}
                      onToggleRowComplete={handleToggleRowComplete}
                      savedImageDocument={imageDocument}
                      imageSettingsLoadKey={imageSettingsLoadKey}
                      onImageDocumentChange={handleImageDocumentChange}
                      sidePanelTarget={toolsPanel === "import" ? importPanelEl : null}
                      editLocked={editLocked}
                      paperColor={paperColor}
                      hideFullscreenEntry
                      enterFullscreenRef={enterFullscreenRef}
                      zoomApiRef={zoomApiRef}
                      className="min-h-0 flex-1"
                    />

                    {/* Tracker — progress, steppers, zoom, follow */}
                    <div
                      id="tutorial-row-progress"
                      className="punch-tracker-face shrink-0"
                    >
                      <div className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: "#0A0A0A" }}>
                        Tracker
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: "#0A0A0A" }}>
                          {String(progress.currentRow + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-sm" style={{ color: "rgba(10,10,10,0.55)" }}>/ {String(gridH).padStart(2, "0")}</span>
                      </div>
                      <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden bg-chassis-dark/30">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${completedPct}%`,
                            background: `color-mix(in srgb, ${paperColor} 82%, #0A0A0A 18%)`,
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={progress.currentRow <= 0}
                        onClick={() => handleStepCurrentRow(-1)}
                        className="punch-lamp punch-lamp-orange !min-h-[28px] !px-2 text-[9px] disabled:opacity-40"
                      >
                        ← Row
                      </button>
                      <button
                        type="button"
                        disabled={progress.currentRow >= gridH - 1}
                        onClick={() => handleStepCurrentRow(1)}
                        className="punch-lamp punch-lamp-orange !min-h-[28px] !px-2 text-[9px] disabled:opacity-40"
                      >
                        Row →
                      </button>
                      <span className="font-mono text-[10px]" style={{ color: "rgba(10,10,10,0.55)" }}>
                        <span className="font-bold" style={{ color: "#0A0A0A" }}>{filledCellCount}</span> filled ·{" "}
                        <span className="font-bold" style={{ color: "#0A0A0A" }}>{emptyCellCount}</span> empty
                      </span>
                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => zoomApiRef.current?.fit()}
                          className="punch-lamp punch-lamp-violet !min-h-[28px] !px-2 text-[9px]"
                          title="Fit grid to width"
                        >
                          Fit
                        </button>
                        <button
                          type="button"
                          onClick={() => zoomApiRef.current?.zoomOut()}
                          className="punch-lamp punch-lamp-violet !min-h-[28px] !px-2 text-[9px]"
                          title="Zoom out"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => zoomApiRef.current?.zoomIn()}
                          className="punch-lamp punch-lamp-violet !min-h-[28px] !px-2 text-[9px]"
                          title="Zoom in"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => enterFullscreenRef.current?.()}
                          className="punch-lamp punch-lamp-violet !min-h-[28px] !px-2 text-[9px]"
                          title={gridFullscreen ? "Exit follow mode" : "Follow mode — hide console"}
                        >
                          {gridFullscreen ? "Exit" : "Full"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
            )}
          </main>

          {toolsPanel === "import" && showProgramSurface && (
            <aside className="flex w-full shrink-0 flex-col border-t-2 border-chassis-dark md:w-[min(480px,44%)] md:border-l-2 md:border-t-0">
              <div className="steel-tray flex h-full min-h-[260px] flex-col !rounded-none !border-0" style={{ minHeight: "100%" }}>
                <div className="relative z-[2] mb-2 flex items-center gap-2">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                      Import
                    </span>
                    <span className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                      · {documentHasImage(imageDocument) ? `${imageDocument.images.filter((i) => i.imageDataUrl).length} set` : "Ready"}
                    </span>
                  </div>
                </div>
                <div
                  className="relative z-[2] flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <div
                    className="punch-card flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-5"
                    style={{
                      ["--manila-stock" as string]: manilaHex(DEFAULT_MANILA_STOCK),
                      background: manilaHex(DEFAULT_MANILA_STOCK),
                    }}
                  >
                    <OperatorCardHeader className="shrink-0" title="Import card" colLabel="JOB IMP" />
                    <div
                      ref={setImportPanelEl}
                      className="mt-4 min-h-0 flex-1 overflow-y-auto"
                    />
                  </div>
                </div>
              </div>
            </aside>
          )}
          </div>
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

      <TutorialSpotlight open={tutorialOpen} onOpenChange={setTutorialOpen} />

      {toolsPanel === "yarn" &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-recess/70"
              aria-label="Close panel"
              onClick={() => setToolsPanel(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Yarn estimate"
              onPointerDown={(e) => e.stopPropagation()}
              className="punch-card relative z-10 flex min-h-[26rem] max-h-[85vh] w-full max-w-sm flex-col overflow-hidden px-6 py-5"
              style={{
                ["--manila-stock" as string]: manilaHex(DEFAULT_MANILA_STOCK),
              }}
            >
              <OperatorCardHeader className="shrink-0" title="Yarn card" colLabel="JOB YARN" />
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                <YarnEstimator
                  gridWidth={gridW}
                  gridHeight={gridH}
                  filledCellCount={filledCellCount}
                  emptyCellCount={emptyCellCount}
                  value={yarnSettings}
                  onChange={handleYarnSettingsChange}
                  className="w-full"
                />
              </div>
              <div className="mt-auto flex shrink-0 items-center justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setToolsPanel(null)}
                  className="punch-print text-[11px] opacity-70"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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
