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
import { usePatternDocument } from "@/hooks/usePatternDocument";
import { useSupabaseInit } from "@/hooks/useSupabaseInit";
import {
  createUntitledPattern,
  deletePattern,
  fetchPatternsForUser,
  type Pattern,
  upsertPattern,
} from "@/lib/patternHelpers";
import { clearPatternSnapshot, OWNER_NOTES_MAX } from "@/lib/patternSnapshot";
import {
  DEFAULT_PALETTE,
  isCellFilled,
  MAX_INK_WELLS,
  normalizeHexColor,
  removePaletteColor,
  type CellGrid,
} from "@/lib/gridFormat";
import type { InkBrush } from "@/components/GridCanvas";
import {
  clampCurrentRow,
  resizeProgressForGrid,
  trackLength,
  type TrackMode,
} from "@/lib/progressData";
import { type PatternYarnSettings } from "@/lib/yarnSettings";
import {
  DEFAULT_PATTERN_IMAGE_DOCUMENT,
  documentHasImage,
  serializeImageDocument,
} from "@/lib/imageSettings";
import { setPatternPublic } from "@/lib/galleryHelpers";
import { fetchProfile, upsertProfile } from "@/lib/profileHelpers";
import {
  contrastManilaHex,
  DEFAULT_MANILA_STOCK,
  manilaHex,
  MANILA_STOCKS,
  saveManilaStock,
} from "@/lib/manilaStock";
import * as Sentry from "@sentry/nextjs";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

const NEW_WELL_DEFAULTS = [
  "#2C2C2C",
  "#C62828",
  "#1565C0",
  "#2E7D32",
  "#F9A825",
  "#6A1B9A",
  "#EF6C00",
  "#00838F",
  "#AD1457",
  "#5D4037",
  "#455A64",
  "#F5F5F5",
] as const;

export type EditorWorkspaceProps = {
  /** When true, omit ChassisNav and fill parent (machine reader bay). */
  embedded?: boolean;
  /** Open program id from the URL. The editor does not keep a competing copy. */
  openId?: string | null;
  /** Hide pattern list sidebar (Profile owns your cards). */
  hideSidebar?: boolean;
  /** Open the console tour once (e.g. from Manual “Go to tutorial”). */
  forceTutorial?: boolean;
  /** Called after forceTutorial has been applied so the URL flag can clear. */
  onTutorialConsumed?: () => void;
  /** User picked a program — parent writes `?pattern=` . */
  onOpenPattern?: (id: string | null) => void;
  onRequestMaker?: () => void;
  onRequestHopper?: () => void;
  onRequestAuth?: () => void;
};

export function EditorWorkspace({
  embedded = false,
  openId = null,
  hideSidebar = false,
  forceTutorial = false,
  onTutorialConsumed,
  onOpenPattern,
  onRequestMaker,
  onRequestHopper,
  onRequestAuth,
}: EditorWorkspaceProps) {
  const { supabase, configError } = useSupabaseInit();
  const [, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);

  const selectPattern = useCallback(
    (id: string | null) => {
      onOpenPattern?.(id);
    },
    [onOpenPattern],
  );

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aspectLocked, setAspectLocked] = useState(false);
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const [gridFullscreen, setGridFullscreen] = useState(false);
  const enterFullscreenRef = useRef<(() => void) | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [yarnOpen, setYarnOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [deletePatternOpen, setDeletePatternOpen] = useState(false);
  const [deletingPattern, setDeletingPattern] = useState(false);
  const [inkCardIndex, setInkCardIndex] = useState<number | null>(null);
  const [inkHexDraft, setInkHexDraft] = useState("#2C2C2C");
  const [brushInk, setBrushInk] = useState<InkBrush>(0);
  const longPressTimerRef = useRef<number | null>(null);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
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

  const {
    status: docStatus,
    loadKey: imageSettingsLoadKey,
    saveIndicator,
    dirtyKey,
    cells,
    gridWidth: gridW,
    gridHeight: gridH,
    palette,
    progress,
    yarn: yarnSettings,
    image: imageDocument,
    manilaStock,
    name: draftTitle,
    notes,
    commit,
    resize,
    setProgress,
    setYarn,
    setImage,
    setPalette,
    setManilaStock,
    setName,
    setNotes,
    undo,
    redo,
    canUndo,
    canRedo,
    save,
  } = usePatternDocument({
    openId,
    supabase,
    user,
    tutorialOpen,
    onMissingPattern: () => onOpenPattern?.(null),
  });

  const selectedPatternId = openId;
  const editLocked = progress.editLocked;

  // Keep draft inputs in sync when gridW/gridH are changed externally (preset picker, DB load)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the editable draft input from the external grid size
  useEffect(() => { setWDraft(String(gridW)); }, [gridW]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the editable draft input from the external grid size
  useEffect(() => { setHDraft(String(gridH)); }, [gridH]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- size dial follows the loaded document
    setSizePreset(matchSizeDial(gridW, gridH));
  }, [imageSettingsLoadKey, gridW, gridH]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset ink well when a document loads
    setBrushInk(0);
  }, [imageSettingsLoadKey]);

  useEffect(() => {
    if (!importOpen && !yarnOpen && !notesOpen && inkCardIndex === null && !deletePatternOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (deletePatternOpen) setDeletePatternOpen(false);
      else if (inkCardIndex !== null) setInkCardIndex(null);
      else if (yarnOpen) setYarnOpen(false);
      else if (notesOpen) setNotesOpen(false);
      else setImportOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [importOpen, yarnOpen, notesOpen, inkCardIndex, deletePatternOpen]);

  const paperColor = manilaHex(manilaStock);
  const contrastPaper = contrastManilaHex(manilaStock);

  const activePattern = useMemo(
    () => patterns.find((p) => p.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId],
  );

  const completedCount = useMemo(
    () => progress.rowComplete.filter(Boolean).length,
    [progress.rowComplete],
  );
  const trackLen = useMemo(
    () => trackLength(progress.trackMode, gridW, gridH),
    [progress.trackMode, gridW, gridH],
  );
  const completedPct = trackLen > 0 ? Math.round((completedCount / trackLen) * 100) : 0;

  const { filledCellCount, emptyCellCount } = useMemo(() => {
    let filled = 0;
    let empty = 0;
    for (const row of cells) {
      for (const cell of row) {
        if (isCellFilled(cell)) filled += 1;
        else empty += 1;
      }
    }
    return { filledCellCount: filled, emptyCellCount: empty };
  }, [cells]);

  const handleYarnSettingsChange = useCallback((next: PatternYarnSettings) => {
    setYarn(next);
  }, [setYarn]);

  const handleImageDocumentChange = useCallback((next: typeof imageDocument) => {
    setImage(next);
  }, [setImage]);

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
      Sentry.captureException(error);
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
        onOpenPattern?.(null);
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
  }, [supabase, onOpenPattern]);

  useEffect(() => {
    if (!supabase || !user) return;
    const id = window.setTimeout(() => {
      void loadPatterns(supabase, user.id);
    }, 0);
    return () => window.clearTimeout(id);
  }, [supabase, user, loadPatterns]);

  useEffect(() => {
    if (!supabase || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears display name on logout; must react to auth changes
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
    if (user || filledCellCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Log in to save your pattern before leaving.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user, filledCellCount]);

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
        Sentry.captureException(error);
        return;
      }
      await loadPatterns(supabase, user.id);
      if (data?.id) selectPattern(data.id);
    } finally {
      setCreatingProgram(false);
    }
  }, [supabase, user, loadPatterns, manilaStock, onRequestAuth, selectPattern]);

  const handleCommitGrid = useCallback(
    (next: CellGrid) => {
      commit(next);
    },
    [commit],
  );

  const handleApplyConvertedGrid = useCallback(
    (next: CellGrid) => {
      commit(next);
    },
    [commit],
  );

  const openInkCard = useCallback((index: number) => {
    const hex = palette[index] ?? DEFAULT_PALETTE[0]!;
    setInkHexDraft(hex);
    setInkCardIndex(index);
    setBrushInk(index);
  }, [palette]);

  const applyInkColor = useCallback((hex: string) => {
    if (inkCardIndex === null) return;
    const next = normalizeHexColor(hex);
    setPalette((prev) => {
      const copy = [...prev];
      copy[inkCardIndex] = next;
      return copy;
    });
    setInkHexDraft(next);
  }, [inkCardIndex, setPalette]);

  const handleAddInkWell = useCallback(() => {
    if (palette.length >= MAX_INK_WELLS) return;
    const nextColor =
      NEW_WELL_DEFAULTS[palette.length % NEW_WELL_DEFAULTS.length] ?? "#2C2C2C";
    const nextIndex = palette.length;
    setPalette((prev) => [...prev, nextColor]);
    setBrushInk(nextIndex);
    setInkHexDraft(nextColor);
    setInkCardIndex(nextIndex);
  }, [palette.length, setPalette]);

  const handleRemoveInkWell = useCallback(() => {
    if (inkCardIndex === null) return;
    if (palette.length <= 1) return;
    const { cells: nextCells, palette: nextPalette } = removePaletteColor(
      cells,
      palette,
      inkCardIndex,
    );
    commit(nextCells);
    setPalette(nextPalette);
    setBrushInk(0);
    setInkCardIndex(null);
  }, [inkCardIndex, palette, cells, commit, setPalette]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleWidthChange = useCallback(
    (raw: number) => {
      const w = clampGridSize(raw);
      const h =
        aspectLocked && lockedRatio !== null
          ? clampGridSize(Math.round(w / lockedRatio))
          : gridH;
      setSizePreset(matchSizeDial(w, h));
      resize(w, h);
    },
    [aspectLocked, lockedRatio, gridH, resize],
  );

  const handleHeightChange = useCallback(
    (raw: number) => {
      const h = clampGridSize(raw);
      const w =
        aspectLocked && lockedRatio !== null
          ? clampGridSize(Math.round(h * lockedRatio))
          : gridW;
      setSizePreset(matchSizeDial(w, h));
      resize(w, h);
    },
    [aspectLocked, lockedRatio, gridW, resize],
  );

  const handleToggleRowComplete = useCallback((row: number) => {
    setProgress((p) => {
      if (row < 0 || row >= p.rowComplete.length) return p;
      const next = [...p.rowComplete];
      next[row] = !next[row];
      return { ...p, rowComplete: next };
    });
  }, [setProgress]);

  const handleBestFitGrid = useCallback(
    (w: number, h: number) => {
      const cw = clampGridSize(w);
      const ch = clampGridSize(h);
      setSizePreset(matchSizeDial(cw, ch));
      resize(cw, ch);
    },
    [resize],
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
      resize(preset.w, preset.h);
    },
    [resize],
  );

  const handleImageLoad = useCallback((naturalWidth: number, naturalHeight: number) => {
    setLockedRatio(naturalWidth / naturalHeight);
    setAspectLocked(true);
  }, []);

  const handleRenamePattern = useCallback(
    async (id: string, newName: string) => {
      setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
      if (id === openId) setName(newName);
      if (!supabase || !user) return;
      if (id === openId) return;
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
      if (error) {
        console.error(error);
        Sentry.captureException(error);
      }
    },
    [supabase, user, patterns, openId, setName],
  );

  const handleDeletePattern = useCallback(
    async (id: string) => {
      if (!supabase || !user) return;
      // Optimistic removal
      setPatterns((prev) => prev.filter((p) => p.id !== id));
      if (selectedPatternId === id) selectPattern(null);
      clearPatternSnapshot(id);
      const { error } = await deletePattern(supabase, id, user.id);
      if (error) {
        console.error(error);
        Sentry.captureException(error);
        // Reload on failure to restore the list
        await loadPatterns(supabase, user.id);
      }
    },
    [supabase, user, selectedPatternId, loadPatterns, selectPattern],
  );

  const handleSetTrackMode = useCallback(
    (nextMode: TrackMode) => {
      setProgress((p) => {
        if (p.trackMode === nextMode) return p;
        return resizeProgressForGrid(p, gridW, gridH, nextMode);
      });
    },
    [gridW, gridH, setProgress],
  );

  const handleStepCurrentRow = useCallback(
    (delta: number) => {
      setProgress((p) => {
        const len = trackLength(p.trackMode, gridW, gridH);
        return {
          ...p,
          currentRow: clampCurrentRow(p.currentRow + delta, len),
        };
      });
    },
    [gridW, gridH, setProgress],
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
        Sentry.captureException(error);
        setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, is_public: !isPublic } : p)));
      }
    },
    [supabase, user, displayName],
  );

  useAutoSave({
    enabled: docStatus === "ready",
    delayMs: 800,
    dirtyKey,
    onSave: save,
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
                      setName(next);
                    }
                    setIsRenamingTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const next = titleDraft.trim() || "Untitled";
                      if (selectedPatternId) {
                        void handleRenamePattern(selectedPatternId, next);
                      } else {
                        setName(next);
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
                          : saveIndicator === "pending" || saveIndicator === "error"
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
                      : saveIndicator === "error"
                        ? "Save failed"
                        : "Autosave on"}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
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
                bottomLabel="Link"
                on={aspectLocked}
                orientation="vertical"
                disabled={!sizeCustom}
                onClick={handleToggleAspectLock}
                title={
                  !sizeCustom
                    ? "Switch Size to Custom to edit dimensions"
                    : aspectLocked
                      ? "Unlock linked proportions"
                      : "Link width and height"
                }
              />
              <div id="tutorial-pencil" className="flex">
                <FlipSwitch
                  topLabel="Edit"
                  bottomLabel="Lock"
                  on={editLocked}
                  orientation="vertical"
                  onClick={() =>
                    setProgress((p) => ({ ...p, editLocked: !p.editLocked }))
                  }
                  title={editLocked ? "Unlock editing" : "Lock editing"}
                />
              </div>
              <button
                id="tutorial-image-tools"
                type="button"
                onClick={() => {
                  if (!showProgramSurface) return;
                  setImportOpen((p) => !p);
                }}
                disabled={!showProgramSurface}
                className={`punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px] self-end mb-0.5 ${
                  importOpen ? "is-lit" : ""
                }`}
                title={importOpen ? "Close import" : "Import reference image"}
                aria-pressed={importOpen}
              >
                Import
              </button>
            </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-0.5 self-end">
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
              <button
                type="button"
                onClick={() => setYarnOpen((p) => !p)}
                className={`punch-lamp punch-lamp-blue !min-h-[32px] !px-2.5 text-[9px] ${
                  yarnOpen ? "is-lit" : ""
                }`}
                title="Yarn estimate"
                aria-pressed={yarnOpen}
              >
                Yarn
              </button>
              <button
                type="button"
                onClick={() => setNotesOpen((p) => !p)}
                className={`punch-lamp punch-lamp-blue !min-h-[32px] !px-2.5 text-[9px] ${
                  notesOpen ? "is-lit" : ""
                }`}
                title="Private notes"
                aria-pressed={notesOpen}
              >
                Notes
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
                    if (selectedPatternId) void save();
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
              <FlipSwitch
                topLabel="Private"
                bottomLabel="Public"
                on={activePattern?.is_public ?? false}
                orientation="vertical"
                disabled={!user || !selectedPatternId || !activePattern}
                onClick={() => {
                  if (!selectedPatternId || !activePattern) return;
                  void handleTogglePublic(selectedPatternId, !activePattern.is_public);
                }}
                title={
                  !user || !selectedPatternId || !activePattern
                    ? "Open a program to set visibility"
                    : activePattern.is_public
                      ? "Make private"
                      : "Make public"
                }
              />
              <button
                type="button"
                disabled={!user || !selectedPatternId || deletingPattern}
                onClick={() => setDeletePatternOpen(true)}
                className="punch-lamp punch-lamp-red !min-h-[32px] !px-2.5 text-[9px] disabled:opacity-40"
                title={
                  !user || !selectedPatternId
                    ? "Open a program to delete"
                    : "Delete this program"
                }
              >
                Delete
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
              onSelectPattern={(id) => { selectPattern(id); setSidebarOpen(false); }}
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
              importOpen ? "flex-col md:flex-row" : "flex-col"
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
                    ["--manila-stock" as string]: manilaHex(DEFAULT_MANILA_STOCK),
                    background: manilaHex(DEFAULT_MANILA_STOCK),
                  }}
                >
                  <OperatorCardHeader title="Program card" colLabel="JOB PROG" />
                  <h2 className="mt-4 font-mono text-[15px] font-bold tracking-[0.06em] uppercase punch-print-ink">
                    New program
                  </h2>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed punch-print-faint">
                    Techniques → Manual. Console tour → ?. Or start below.
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
                          ? "New →"
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
                      {user ? "Open from Deck →" : "Sign in for Deck →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestHopper?.()}
                      className="punch-print text-left text-[12px] tracking-[0.1em]"
                    >
                      Copy from Hopper →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-0">
                {/* Ink wells — yarn/fill colors for the chart */}
                {!gridFullscreen ? (
                <div
                  className="flex shrink-0 items-center gap-2 border-b border-black/10 px-2 py-1.5"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(255,255,255,0.04) 100%), var(--recess)",
                    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
                  }}
                  aria-label="Ink wells"
                >
                  <span className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--card,#f2edd3)]/80">
                    Ink
                  </span>
                  <button
                    type="button"
                    onClick={() => setBrushInk(null)}
                    title="Erase (open mesh)"
                    aria-label="Erase"
                    aria-pressed={brushInk === null}
                    className="relative flex h-7 w-7 shrink-0 items-center justify-center border transition-shadow"
                    style={{
                      borderColor: brushInk === null ? "rgba(10,10,10,0.55)" : "rgba(10,10,10,0.28)",
                      background:
                        "repeating-linear-gradient(135deg, #E8E4DA 0 3px, #C9C4B8 3px 6px)",
                      boxShadow: brushInk === null ? "0 0 0 1px rgba(10,10,10,0.2)" : "none",
                    }}
                  >
                    <span className="font-mono text-[9px] font-bold text-black/70">∅</span>
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                    {palette.map((hex, i) => {
                      const selected = brushInk === i;
                      return (
                        <button
                          key={`ink-${i}`}
                          type="button"
                          title={`${hex} — click to paint, hold or double-click to edit`}
                          aria-label={`Ink well ${i + 1}: ${hex}`}
                          aria-pressed={selected}
                          onClick={() => setBrushInk(i)}
                          onDoubleClick={() => openInkCard(i)}
                          onPointerDown={() => {
                            clearLongPress();
                            longPressTimerRef.current = window.setTimeout(() => {
                              openInkCard(i);
                            }, 480);
                          }}
                          onPointerUp={clearLongPress}
                          onPointerLeave={clearLongPress}
                          onPointerCancel={clearLongPress}
                          className="relative h-7 w-7 shrink-0 border transition-shadow"
                          style={{
                            background: hex,
                            borderColor: selected ? "rgba(10,10,10,0.55)" : "rgba(10,10,10,0.28)",
                            boxShadow: selected
                              ? "inset 0 0 0 1px rgba(255,255,255,0.25), 0 0 0 1px rgba(10,10,10,0.18)"
                              : "inset 0 0 0 1px rgba(255,255,255,0.15)",
                          }}
                        />
                      );
                    })}
                    {palette.length < MAX_INK_WELLS ? (
                      <button
                        type="button"
                        onClick={handleAddInkWell}
                        title="Add ink well"
                        aria-label="Add ink well"
                        className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-dashed border-[var(--card,#f2edd3)]/40 font-mono text-[14px] font-bold text-[var(--card,#f2edd3)]/70 hover:border-[var(--card,#f2edd3)]/70 hover:text-[var(--card,#f2edd3)]"
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                </div>
                ) : null}

                <div className="relative flex min-h-0 flex-1 flex-col">
                    <ImageTools
                      gridWidth={gridW}
                      gridHeight={gridH}
                      cells={cells}
                      onCommit={handleCommitGrid}
                      onApplyConvertedGrid={handleApplyConvertedGrid}
                      onBestFitGrid={handleBestFitGrid}
                      onImageLoad={handleImageLoad}
                      onGridFullscreenChange={(fs) => {
                        setGridFullscreen(fs);
                        if (fs) setImportOpen(false);
                      }}
                      progress={progress}
                      onToggleRowComplete={handleToggleRowComplete}
                      trackMode={progress.trackMode}
                      mirrorView={progress.mirrorView}
                      savedImageDocument={imageDocument}
                      imageSettingsLoadKey={imageSettingsLoadKey}
                      onImageDocumentChange={handleImageDocumentChange}
                      sidePanelTarget={importOpen ? importPanelEl : null}
                      editLocked={editLocked}
                      paperColor={paperColor}
                      hideFullscreenEntry
                      enterFullscreenRef={enterFullscreenRef}
                      zoomApiRef={zoomApiRef}
                      palette={palette}
                      brushInk={brushInk}
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
                        <span className="font-mono text-sm" style={{ color: "rgba(10,10,10,0.55)" }}>
                          / {String(trackLen).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden bg-chassis-dark/30">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${completedPct}%`,
                            background: contrastPaper,
                          }}
                        />
                      </div>
                      <RotaryKnob
                        label="Track"
                        value={progress.trackMode}
                        options={[
                          { value: "row", label: "Row" },
                          { value: "col", label: "Col" },
                          { value: "diag", label: "Diag" },
                        ]}
                        onChange={handleSetTrackMode}
                        accent="#0A0A0A"
                        pointer="#FFFFFF"
                        dial="var(--key-blue)"
                        size={32}
                      />
                      <FlipSwitch
                        topLabel="Face"
                        bottomLabel="Flip"
                        on={progress.mirrorView}
                        orientation="vertical"
                        size="sm"
                        onClick={() =>
                          setProgress((p) => ({ ...p, mirrorView: !p.mirrorView }))
                        }
                        title={
                          progress.mirrorView
                            ? "Show the face of the work"
                            : "Mirror view — match turned work"
                        }
                      />
                      <button
                        type="button"
                        disabled={progress.currentRow <= 0}
                        onClick={() => handleStepCurrentRow(-1)}
                        className="punch-lamp punch-lamp-orange !min-h-[28px] !px-2 text-[9px] disabled:opacity-40"
                      >
                        ← {progress.trackMode === "diag" ? "Diag" : progress.trackMode === "col" ? "Col" : "Row"}
                      </button>
                      <button
                        type="button"
                        disabled={progress.currentRow >= trackLen - 1}
                        onClick={() => handleStepCurrentRow(1)}
                        className="punch-lamp punch-lamp-orange !min-h-[28px] !px-2 text-[9px] disabled:opacity-40"
                      >
                        {progress.trackMode === "diag" ? "Diag" : progress.trackMode === "col" ? "Col" : "Row"} →
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

          {importOpen && showProgramSurface && (
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

      {deletePatternOpen &&
        selectedPatternId &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-recess/70"
              aria-label="Close panel"
              disabled={deletingPattern}
              onClick={() => {
                if (!deletingPattern) setDeletePatternOpen(false);
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Delete pattern"
              onPointerDown={(e) => e.stopPropagation()}
              className="punch-card relative z-10 flex w-full max-w-sm flex-col overflow-hidden px-6 py-5"
              style={{
                ["--manila-stock" as string]: manilaHex(DEFAULT_MANILA_STOCK),
              }}
            >
              <OperatorCardHeader className="shrink-0" title="Delete card" colLabel="JOB DEL" />
              <p className="mt-4 font-mono text-[13px] font-bold tracking-[0.04em] uppercase punch-print-ink">
                Delete this program?
              </p>
              <p className="mt-2 font-mono text-[11px] leading-relaxed punch-print-faint">
                {activePattern?.name ?? "Untitled"} will be permanently removed. This cannot be undone.
              </p>
              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={deletingPattern}
                  onClick={() => setDeletePatternOpen(false)}
                  className="punch-print text-[11px] opacity-70 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingPattern}
                  onClick={() => {
                    const id = selectedPatternId;
                    if (!id) return;
                    setDeletingPattern(true);
                    void handleDeletePattern(id).finally(() => {
                      setDeletingPattern(false);
                      setDeletePatternOpen(false);
                    });
                  }}
                  className="punch-lamp punch-lamp-red !min-h-[32px] !px-3 text-[9px]"
                >
                  {deletingPattern ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {yarnOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-recess/70"
              aria-label="Close panel"
              onClick={() => setYarnOpen(false)}
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
                  onClick={() => setYarnOpen(false)}
                  className="punch-print text-[11px] opacity-70"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {notesOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-recess/70"
              aria-label="Close panel"
              onClick={() => setNotesOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Private notes"
              onPointerDown={(e) => e.stopPropagation()}
              className="punch-card relative z-10 flex min-h-[18rem] max-h-[85vh] w-full max-w-sm flex-col overflow-hidden px-6 py-5"
              style={{
                ["--manila-stock" as string]: manilaHex(DEFAULT_MANILA_STOCK),
              }}
            >
              <OperatorCardHeader className="shrink-0" title="Notes card" colLabel="JOB NOTE" />
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] punch-print-faint">
                Private · not copied
              </p>
              <textarea
                value={notes}
                maxLength={OWNER_NOTES_MAX}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hook, yarn, tension, whatever you want to remember."
                className="mt-3 min-h-[10rem] w-full flex-1 resize-none bg-transparent font-mono text-[12px] leading-relaxed punch-print-ink placeholder:text-[var(--print-ink-faint)] focus:outline-none"
              />
              <div className="mt-auto flex shrink-0 items-center justify-between gap-3 pt-4">
                <span className="font-mono text-[9px] punch-print-faint">
                  {notes.length}/{OWNER_NOTES_MAX}
                </span>
                <button
                  type="button"
                  onClick={() => setNotesOpen(false)}
                  className="punch-print text-[11px] opacity-70"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {inkCardIndex !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-recess/70"
              aria-label="Close ink card"
              onClick={() => setInkCardIndex(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Ink well"
              onPointerDown={(e) => e.stopPropagation()}
              className="punch-card relative z-10 flex w-full max-w-xs flex-col overflow-hidden px-6 py-5"
              style={{
                ["--manila-stock" as string]: manilaHex(DEFAULT_MANILA_STOCK),
              }}
            >
              <OperatorCardHeader className="shrink-0" title="Ink card" colLabel="JOB INK" />
              <p className="mt-3 font-mono text-[11px] punch-print-faint">
                Well {String((inkCardIndex ?? 0) + 1).padStart(2, "0")}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <label className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden border-2 border-black/40 shadow-inner">
                  <span className="sr-only">Pick color</span>
                  <input
                    type="color"
                    value={normalizeHexColor(inkHexDraft).toLowerCase()}
                    onChange={(e) => applyInkColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <span
                    className="pointer-events-none absolute inset-0"
                    style={{ background: normalizeHexColor(inkHexDraft) }}
                    aria-hidden
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <label className="font-mono text-[9px] font-bold tracking-[0.12em] uppercase punch-print-faint">
                    Hex
                  </label>
                  <input
                    type="text"
                    value={inkHexDraft}
                    onChange={(e) => setInkHexDraft(e.target.value)}
                    onBlur={() => applyInkColor(inkHexDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyInkColor(inkHexDraft);
                    }}
                    spellCheck={false}
                    className="mt-1 w-full border border-black/25 bg-white/70 px-2 py-1.5 font-mono text-[13px] uppercase punch-print-ink outline-none focus:border-black/50"
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRemoveInkWell}
                  disabled={palette.length <= 1}
                  className="punch-print text-[11px] opacity-70 disabled:opacity-30"
                >
                  Remove well
                </button>
                <button
                  type="button"
                  onClick={() => setInkCardIndex(null)}
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
