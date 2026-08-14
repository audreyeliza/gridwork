"use client";

import { usePatternHistory } from "@/hooks/usePatternHistory";
import {
  createEmptyGrid,
  resizeGridPreserve,
  serializeGridCells,
  type CellGrid,
} from "@/lib/gridFormat";
import { serializeImageDocument } from "@/lib/imageSettings";
import type { ManilaStockId } from "@/lib/manilaStock";
import {
  fetchPatternById,
  upsertPattern,
} from "@/lib/patternHelpers";
import {
  applyPatternSnapshot,
  buildPatternSnapshot,
  clampOwnerNotes,
  clearPatternSnapshot,
  documentFromPattern,
  emptyPatternDocument,
  loadPatternSnapshot,
  pickDocumentSource,
  writePatternSnapshot,
  type PatternDocument,
} from "@/lib/patternSnapshot";
import {
  resizeProgressForGrid,
  serializeProgressData,
  type PatternProgressState,
} from "@/lib/progressData";
import { serializePatternYarnSettings, type PatternYarnSettings } from "@/lib/yarnSettings";
import { generateGridThumbnail } from "@/lib/thumbnailUtils";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PatternDocStatus = "loading" | "ready";
export type SaveIndicator = "idle" | "pending" | "saving" | "saved" | "error";

export type PatternDocumentPatch = Partial<
  Pick<
    PatternDocument,
    "name" | "palette" | "progress" | "yarn" | "image" | "manilaStock" | "notes"
  >
>;

type Options = {
  openId: string | null;
  supabase: SupabaseClient | null;
  user: User | null;
  tutorialOpen: boolean;
  onMissingPattern?: () => void;
};

function clampGridSize(n: number): number {
  if (Number.isNaN(n) || n < 5) return 5;
  if (n > 200) return 200;
  return Math.floor(n);
}

function createTutorialMockGrid(w: number, h: number): CellGrid {
  const g = createEmptyGrid(w, h);
  const cx = Math.floor(w / 2);
  const top = Math.max(4, Math.floor(h * 0.18));
  const bottom = Math.min(h - 4, Math.floor(h * 0.62));
  for (let r = top; r < bottom; r++) {
    const t = (r - top) / Math.max(1, bottom - top - 1);
    const spread = Math.max(0, Math.round((1 - Math.abs(t * 2 - 1)) * (cx - 1)));
    for (let c = cx - spread; c <= cx + spread; c++) {
      if (c >= 0 && c < w) g[r]![c] = 0;
    }
  }
  return g;
}

function guestDocument(tutorialOpen: boolean): PatternDocument {
  const local = loadPatternSnapshot(null);
  if (local && !tutorialOpen) return applyPatternSnapshot(local);
  if (tutorialOpen) {
    return emptyPatternDocument({ cells: createTutorialMockGrid(10, 40) });
  }
  return emptyPatternDocument();
}

function dirtySignature(doc: PatternDocument): string {
  return JSON.stringify({
    gridW: doc.gridWidth,
    gridH: doc.gridHeight,
    cells: doc.cells,
    palette: doc.palette,
    yarn: doc.yarn,
    progress: doc.progress,
    manilaStock: doc.manilaStock,
    name: doc.name,
    notes: doc.notes,
    images: doc.image.images.map((img) => ({
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
    activeImageId: doc.image.activeImageId,
  });
}

export function usePatternDocument({ openId, supabase, user, tutorialOpen, onMissingPattern }: Options) {
  const [status, setStatus] = useState<PatternDocStatus>("loading");
  const [meta, setMeta] = useState(() => {
    const empty = emptyPatternDocument();
    const { cells: _cells, ...rest } = empty;
    return rest;
  });
  const [loadKey, setLoadKey] = useState("");
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>("idle");

  const history = usePatternHistory(meta.gridWidth, meta.gridHeight);
  const { cells, commit: commitHistory, replace: replaceHistory, reset, undo, redo, canUndo, canRedo } =
    history;

  const doc: PatternDocument = useMemo(
    () => ({ ...meta, cells }),
    [meta, cells],
  );

  const statusRef = useRef(status);
  const openIdRef = useRef(openId);
  const loadedIdRef = useRef<string | null | undefined>(undefined);
  const docRef = useRef(doc);
  const tutorialOpenRef = useRef(tutorialOpen);
  const supabaseRef = useRef(supabase);
  const userRef = useRef(user);
  const onMissingPatternRef = useRef(onMissingPattern);
  const loadGenRef = useRef(0);
  const savedTimerRef = useRef<number | undefined>(undefined);
  const skipDirtyRef = useRef(true);

  useEffect(() => {
    statusRef.current = status;
    openIdRef.current = openId;
    docRef.current = doc;
    tutorialOpenRef.current = tutorialOpen;
    supabaseRef.current = supabase;
    userRef.current = user;
    onMissingPatternRef.current = onMissingPattern;
  }, [status, openId, doc, tutorialOpen, supabase, user, onMissingPattern]);

  const applyDocument = useCallback(
    (next: PatternDocument, id: string | null) => {
      const { cells: nextCells, ...rest } = next;
      setMeta(rest);
      reset(nextCells);
      loadedIdRef.current = id;
      setLoadKey(`${id ?? "guest"}-${next.savedAt}-${Date.now()}`);
      skipDirtyRef.current = true;
      setStatus("ready");
    },
    [reset],
  );

  const persistDoc = useCallback(async (id: string | null, current: PatternDocument): Promise<boolean> => {
    if (statusRef.current !== "ready") return false;
    if (id !== loadedIdRef.current) return false;
    writePatternSnapshot(id, buildPatternSnapshot(current));
    const sb = supabaseRef.current;
    const u = userRef.current;
    if (!sb || !u || !id) return true;
    const thumbnail = generateGridThumbnail(current.cells, {
      stockId: current.manilaStock,
      palette: current.palette,
    });
    const { error } = await upsertPattern(sb, {
      id,
      user_id: u.id,
      name: current.name,
      grid_width: current.gridWidth,
      grid_height: current.gridHeight,
      grid_data: serializeGridCells(current.cells, current.palette),
      progress_data: serializeProgressData(current.progress),
      yarn_settings: serializePatternYarnSettings(current.yarn),
      image_settings: serializeImageDocument(current.image, {
        manila_stock: current.manilaStock,
      }),
      thumbnail: thumbnail || null,
      owner_notes: clampOwnerNotes(current.notes),
    });
    if (error) {
      const extra = error as Error & { code?: string };
      console.error(error.message, extra.code ?? "", error);
      Sentry.captureException(error);
      return false;
    }
    return true;
  }, []);

  const save = useCallback(async () => {
    if (statusRef.current !== "ready") return;
    const id = openIdRef.current;
    setSaveIndicator("saving");
    const ok = await persistDoc(id, docRef.current);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    if (!ok) {
      setSaveIndicator("error");
      return;
    }
    setSaveIndicator("saved");
    savedTimerRef.current = window.setTimeout(
      () => setSaveIndicator("idle"),
      2500,
    ) as unknown as number;
  }, [persistDoc]);

  useEffect(() => {
    const gen = ++loadGenRef.current;
    let cancelled = false;

    const run = async () => {
      if (statusRef.current === "ready" && loadedIdRef.current === openId) return;

      if (statusRef.current === "ready" && loadedIdRef.current !== undefined && loadedIdRef.current !== openId) {
        // Closing a program (openId null) must not upsert — that resurrects a just-deleted row.
        if (openId) await persistDoc(loadedIdRef.current, docRef.current);
      }
      if (cancelled || loadGenRef.current !== gen) return;

      setStatus("loading");

      if (!openId) {
        applyDocument(guestDocument(tutorialOpenRef.current), null);
        return;
      }

      const sb = supabaseRef.current;
      const u = userRef.current;
      if (!sb || !u) return;

      const { data, error } = await fetchPatternById(sb, openId, u.id);
      if (cancelled || loadGenRef.current !== gen) return;
      if (error) {
        console.error(error);
        Sentry.captureException(error);
      }
      if (!data) {
        clearPatternSnapshot(openId);
        onMissingPatternRef.current?.();
        applyDocument(guestDocument(tutorialOpenRef.current), null);
        return;
      }

      const dbDoc = documentFromPattern(data);
      const localSnap = loadPatternSnapshot(openId);
      const localDoc = localSnap ? applyPatternSnapshot(localSnap) : null;
      applyDocument(pickDocumentSource(localDoc, dbDoc), openId);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [openId, supabase, user, applyDocument, persistDoc]);

  const dirtyKey = useMemo(() => dirtySignature(doc), [doc]);

  useEffect(() => {
    skipDirtyRef.current = true;
  }, [openId]);

  useEffect(() => {
    if (status !== "ready") return;
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setSaveIndicator((prev) => (prev === "saving" ? prev : "pending"));
  }, [dirtyKey, status]);

  const commit = useCallback(
    (next: CellGrid) => {
      commitHistory(next);
    },
    [commitHistory],
  );

  const replace = useCallback(
    (next: CellGrid) => {
      replaceHistory(next);
    },
    [replaceHistory],
  );

  const patch = useCallback((partial: PatternDocumentPatch) => {
    setMeta((prev) => ({ ...prev, ...partial, savedAt: Date.now() }));
  }, []);

  const resize = useCallback(
    (rawW: number, rawH: number) => {
      const w = clampGridSize(rawW);
      const h = clampGridSize(rawH);
      const nextCells = resizeGridPreserve(docRef.current.cells, w, h);
      replaceHistory(nextCells);
      setMeta((prev) => ({
        ...prev,
        gridWidth: w,
        gridHeight: h,
        progress: resizeProgressForGrid(prev.progress, w, h),
        savedAt: Date.now(),
      }));
    },
    [replaceHistory],
  );

  const setProgress = useCallback(
    (updater: PatternProgressState | ((prev: PatternProgressState) => PatternProgressState)) => {
      setMeta((prev) => {
        const next = typeof updater === "function" ? updater(prev.progress) : updater;
        return { ...prev, progress: next, savedAt: Date.now() };
      });
    },
    [],
  );

  const setYarn = useCallback((yarn: PatternYarnSettings) => {
    setMeta((prev) => ({ ...prev, yarn, savedAt: Date.now() }));
  }, []);

  const setImage = useCallback((image: PatternDocument["image"]) => {
    setMeta((prev) => ({ ...prev, image, savedAt: Date.now() }));
  }, []);

  const setPalette = useCallback(
    (palette: string[] | ((prev: string[]) => string[])) => {
      setMeta((prev) => ({
        ...prev,
        palette: typeof palette === "function" ? palette(prev.palette) : palette,
        savedAt: Date.now(),
      }));
    },
    [],
  );

  const setManilaStock = useCallback((manilaStock: ManilaStockId) => {
    setMeta((prev) => ({ ...prev, manilaStock, savedAt: Date.now() }));
  }, []);

  const setName = useCallback((name: string) => {
    setMeta((prev) => ({ ...prev, name, savedAt: Date.now() }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setMeta((prev) => ({ ...prev, notes: clampOwnerNotes(notes), savedAt: Date.now() }));
  }, []);

  return {
    doc,
    status,
    loadKey,
    saveIndicator,
    dirtyKey,
    cells,
    gridWidth: meta.gridWidth,
    gridHeight: meta.gridHeight,
    palette: meta.palette,
    progress: meta.progress,
    yarn: meta.yarn,
    image: meta.image,
    manilaStock: meta.manilaStock,
    name: meta.name,
    notes: meta.notes,
    commit,
    replace,
    resize,
    patch,
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
  };
}
