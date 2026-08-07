"use client";

import { AuthModal } from "@/components/AuthModal";
import { useNavAuth } from "@/components/NavAuthProvider";
import { EditorWorkspace } from "@/components/machine/EditorWorkspace";
import { HopperZone } from "@/components/machine/HopperZone";
import { MachineKeyboardBar } from "@/components/machine/MachineKeyboardBar";
import { MakerZone } from "@/components/machine/MakerZone";
import { PrimerZone } from "@/components/machine/PrimerZone";
import {
  buildZoneHref,
  parseZoneQuery,
  pathForZone,
  zoneFromPathname,
  type MachineZone,
} from "@/components/machine/zones";
import { ManilaThumbnail } from "@/components/ManilaThumbnail";
import { CopyGlyph, HeartGlyph } from "@/components/PatternGalleryCard";
import {
  copyPublicPattern,
  fetchUserLikedPatternIds,
  togglePatternLike,
  type GalleryPattern,
} from "@/lib/galleryHelpers";
import { manilaHex } from "@/lib/manilaStock";
import { createUntitledPattern } from "@/lib/patternHelpers";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export type { MachineZone };

type PreviewState = {
  pattern: GalleryPattern;
  makerLabel: string;
  isOwn: boolean;
};

/** Profile href when makerLabel is a real @displayname (not a truncated user id). */
function makerProfileHref(makerLabel: string, q?: string | null): string | null {
  if (!makerLabel.startsWith("@")) return null;
  const name = makerLabel.slice(1);
  if (!name || /^[0-9a-f]{6}$/i.test(name)) return null;
  const params = new URLSearchParams({ ref: "gallery" });
  const trimmed = q?.trim();
  if (trimmed) params.set("q", trimmed);
  return `/u/${encodeURIComponent(name)}?${params.toString()}`;
}

type SyncTick = {
  seq: number;
  patternId: string;
  likes_count: number;
  copies_count: number;
  liked: boolean;
};

export function MachineShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zone = zoneFromPathname(pathname);
  const patternId = searchParams.get("pattern");

  const { supabase, user } = useNavAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [programming, setProgramming] = useState(false);
  const [copying, setCopying] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [syncTick, setSyncTick] = useState<SyncTick | null>(null);
  const [syncSeq, setSyncSeq] = useState(0);

  // Legacy bookmarks: /?zone=maker|primer|reader → /profile|/|/program.
  useEffect(() => {
    const legacy = parseZoneQuery(searchParams.get("zone"));
    if (!legacy) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("zone");
    const qs = params.toString();
    const href = qs ? `${pathForZone(legacy)}?${qs}` : pathForZone(legacy);
    router.replace(href, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!supabase || !user) {
      setLikedIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchUserLikedPatternIds(supabase, user.id).then((ids) => {
      if (!cancelled) setLikedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const setZone = useCallback(
    (next: MachineZone) => {
      setPreview(null);
      router.replace(buildZoneHref(next, { preserve: searchParams }), { scroll: false });
    },
    [router, searchParams],
  );

  const openProgram = useCallback(
    (id: string | null, opts?: { tutorial?: boolean }) => {
      setPreview(null);
      router.replace(
        buildZoneHref("program", {
          pattern: id,
          tutorial: opts?.tutorial === true,
          // Keep hopper search when opening a program from elsewhere.
          q: searchParams.get("q"),
        }),
        { scroll: false },
      );
    },
    [router, searchParams],
  );

  /** Update ?pattern on the current path without forcing Program (avoids nav races). */
  const syncPatternInUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("zone");
      if (id) params.set("pattern", id);
      else params.delete("pattern");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handlePatternIdChange = useCallback(
    (id: string | null) => {
      if (id === patternId) return;
      if (!id && !patternId) return;
      syncPatternInUrl(id);
    },
    [patternId, syncPatternInUrl],
  );

  const handleNewProgram = useCallback(async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!supabase) return;
    setProgramming(true);
    try {
      const { data, error } = await createUntitledPattern(supabase, user.id);
      if (error || !data?.id) {
        console.error(error);
        return;
      }
      openProgram(data.id);
    } catch (e) {
      console.error(e);
    } finally {
      setProgramming(false);
    }
  }, [user, supabase, openProgram]);

  const startTutorialFromManual = useCallback(() => {
    openProgram(patternId, { tutorial: true });
  }, [openProgram, patternId]);

  const clearTutorialParam = useCallback(() => {
    if (searchParams.get("tutorial") !== "1") return;
    router.replace(
      buildZoneHref("program", {
        pattern: patternId,
        tutorial: false,
        q: searchParams.get("q"),
      }),
      { scroll: false },
    );
  }, [router, searchParams, patternId]);

  const handlePreview = useCallback((state: PreviewState) => {
    setPreview(state);
  }, []);

  const pushSync = useCallback((pattern: GalleryPattern, liked: boolean) => {
    setSyncSeq((seq) => {
      const nextSeq = seq + 1;
      setSyncTick({
        seq: nextSeq,
        patternId: pattern.id,
        likes_count: pattern.likes_count,
        copies_count: pattern.copies_count,
        liked,
      });
      return nextSeq;
    });
  }, []);

  const handleProgramFromPreview = useCallback(async () => {
    if (!preview) {
      openProgram(null);
      return;
    }
    if (preview.isOwn) {
      openProgram(preview.pattern.id);
      return;
    }
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setProgramming(true);
    try {
      const client = getSupabaseBrowserClient();
      const { newPatternId, error } = await copyPublicPattern(client, preview.pattern.id);
      if (error || !newPatternId) {
        console.error(error);
        return;
      }
      openProgram(newPatternId);
    } catch (e) {
      console.error(e);
    } finally {
      setProgramming(false);
    }
  }, [preview, user, openProgram]);

  const handleLikePreview = useCallback(async () => {
    if (!preview) return;
    if (preview.isOwn) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const patternIdToLike = preview.pattern.id;
    const currentlyLiked = likedIds.has(patternIdToLike);
    const nextLiked = !currentlyLiked;
    const nextCount = preview.pattern.likes_count + (currentlyLiked ? -1 : 1);

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(patternIdToLike);
      else next.add(patternIdToLike);
      return next;
    });
    setPreview((prev) =>
      prev
        ? { ...prev, pattern: { ...prev.pattern, likes_count: nextCount } }
        : prev,
    );
    pushSync({ ...preview.pattern, likes_count: nextCount }, nextLiked);

    try {
      const client = getSupabaseBrowserClient();
      const { error } = await togglePatternLike(client, patternIdToLike);
      if (error) {
        console.error(error);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (currentlyLiked) next.add(patternIdToLike);
          else next.delete(patternIdToLike);
          return next;
        });
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                pattern: {
                  ...prev.pattern,
                  likes_count: prev.pattern.likes_count + (currentlyLiked ? 1 : -1),
                },
              }
            : prev,
        );
        pushSync(preview.pattern, currentlyLiked);
      }
    } catch (e) {
      console.error(e);
    }
  }, [preview, user, likedIds, pushSync]);

  const handleCopyPreview = useCallback(async () => {
    if (!preview) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setCopying(true);
    try {
      const client = getSupabaseBrowserClient();
      const { newPatternId, error } = await copyPublicPattern(client, preview.pattern.id);
      if (error || !newPatternId) {
        console.error(error ?? "No pattern ID returned");
        return;
      }
      const nextCopies = preview.pattern.copies_count + 1;
      const nextPattern = { ...preview.pattern, copies_count: nextCopies };
      setPreview((prev) => (prev ? { ...prev, pattern: nextPattern } : prev));
      pushSync(nextPattern, likedIds.has(preview.pattern.id));
      openProgram(newPatternId);
    } catch (e) {
      console.error(e);
    } finally {
      setCopying(false);
    }
  }, [preview, user, likedIds, pushSync, openProgram]);

  const expanded = zone === "program";
  const showReaderAside = zone === "hopper" || zone === "profile";
  const previewLiked = preview ? likedIds.has(preview.pattern.id) : false;

  const previewPaper = useMemo(
    () => manilaHex(preview?.pattern.manila_stock ?? "manila"),
    [preview],
  );
  const previewMakerHref = preview
    ? makerProfileHref(preview.makerLabel, zone === "hopper" ? searchParams.get("q") : null)
    : null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-paper">
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(0,0,0,0.05) 100%), #EDE8D5",
        }}
      >
        {expanded ? (
          <div className="punch-console flex min-h-0 flex-1 flex-col !rounded-none !border-0 !shadow-none">
            <div className="relative z-[2] min-h-0 flex-1 overflow-hidden">
              <EditorWorkspace
                embedded
                initialPatternId={patternId}
                hideSidebar
                forceTutorial={searchParams.get("tutorial") === "1"}
                onTutorialConsumed={clearTutorialParam}
                onPatternIdChange={handlePatternIdChange}
                onRequestMaker={() => setZone("profile")}
                onRequestHopper={() => setZone("hopper")}
                onRequestAuth={() => setAuthOpen(true)}
              />
            </div>
          </div>
        ) : (
          <div
            className={`flex min-h-0 flex-1 overflow-hidden ${
              showReaderAside ? "flex-col md:flex-row" : "flex-col"
            }`}
          >
            <section
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              style={{
                background:
                  zone === "manual"
                    ? "#EDE8D5"
                    : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 45%, rgba(0,0,0,0.12) 100%), var(--console-desk)",
                flex: showReaderAside ? "1 1 56%" : "1 1 100%",
              }}
            >
              <div className="relative z-[2] min-h-0 flex-1 overflow-hidden">
                {zone === "hopper" && (
                  <HopperZone
                    compact
                    previewId={preview?.pattern.id ?? null}
                    syncTick={syncTick}
                    onPreviewCard={(pattern, makerLabel, isOwn) =>
                      handlePreview({ pattern, makerLabel, isOwn })
                    }
                    onProgramCard={openProgram}
                  />
                )}
                {zone === "manual" && <PrimerZone onStartTutorial={startTutorialFromManual} />}
                {zone === "profile" && (
                  <MakerZone
                    previewId={preview?.pattern.id ?? null}
                    onPreviewCard={(pattern, makerLabel, isOwn) =>
                      handlePreview({ pattern, makerLabel, isOwn })
                    }
                    onProgramCard={openProgram}
                    onNewProgram={() => void handleNewProgram()}
                    creating={programming}
                  />
                )}
              </div>
            </section>

            {showReaderAside && (
              <aside className="flex w-full shrink-0 flex-col border-t-2 border-chassis-dark md:w-[min(480px,44%)] md:border-l-2 md:border-t-0">
                <div className="steel-tray flex h-full min-h-[260px] flex-col !rounded-none !border-0" style={{ minHeight: "100%" }}>
                  <div className="relative z-[2] mb-2 flex items-center gap-2">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                        Reader
                      </span>
                      <span className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                        · {preview ? "Preview" : "Idle"}
                      </span>
                    </div>
                  </div>
                  <div className="relative z-[2] flex min-h-0 flex-1 flex-col">
                    {preview ? (
                      <>
                        <div
                          className="punch-card flex min-h-0 flex-1 flex-col overflow-hidden"
                          style={{ ["--manila-stock" as string]: previewPaper, background: previewPaper }}
                        >
                          <div className="relative min-h-0 flex-1" style={{ background: previewPaper }}>
                            {preview.pattern.thumbnail ? (
                              <ManilaThumbnail
                                src={preview.pattern.thumbnail}
                                alt={preview.pattern.name}
                                stockId={preview.pattern.manila_stock}
                                className="h-full w-full object-contain p-3"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center font-mono text-xs punch-print-faint">
                                No preview
                              </div>
                            )}
                          </div>
                          <div className="card-meta-plate shrink-0 px-3 py-2.5" style={{ background: previewPaper }}>
                            <div className="relative z-[1]">
                              <p className="truncate font-mono text-[13px] font-bold uppercase punch-print-ink">
                                {preview.pattern.name}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.06em] uppercase punch-print-faint">
                                {preview.pattern.grid_width}×{preview.pattern.grid_height}
                              </p>
                              {zone === "profile" ? (
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <p className="truncate punch-print-label">
                                    {preview.isOwn
                                      ? preview.pattern.is_public
                                        ? "Public"
                                        : "Private"
                                      : "Public"}
                                  </p>
                                  <div className="flex shrink-0 items-center gap-2 punch-print-faint">
                                    <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold">
                                      <HeartGlyph filled={false} />
                                      {preview.pattern.likes_count}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold">
                                      <CopyGlyph />
                                      {preview.pattern.copies_count}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1">
                                  {previewMakerHref ? (
                                    <Link
                                      href={previewMakerHref}
                                      className="punch-print truncate text-[10px]"
                                    >
                                      {preview.makerLabel}
                                    </Link>
                                  ) : (
                                    <p className="truncate punch-print-label">
                                      {preview.makerLabel}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {zone === "hopper" ? (
                          <div className="relative z-[2] mt-2 flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleLikePreview()}
                              disabled={preview.isOwn}
                              className={`punch-lamp punch-lamp-red !min-h-[32px] !px-2.5 text-[9px] ${
                                previewLiked ? "is-lit" : "is-dim"
                              }`}
                            >
                              Like {preview.pattern.likes_count}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyPreview()}
                              disabled={copying}
                              className="punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px]"
                            >
                              {copying ? "…" : `Copy ${preview.pattern.copies_count}`}
                            </button>
                          </div>
                        ) : (
                          <div className="relative z-[2] mt-2 flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleProgramFromPreview()}
                              disabled={programming}
                              className="punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px]"
                            >
                              {programming ? "…" : "Program"}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="punch-card flex flex-1 flex-col items-center justify-center gap-2 p-6" style={{ background: "var(--manila-stock)" }}>
                        <p className="font-mono text-[11px] font-bold uppercase punch-print-ink">Select a card</p>
                        <p className="max-w-[20ch] text-center font-mono text-[10px] punch-print-faint">
                          Preview feeds here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      <MachineKeyboardBar
        activeZone={zone}
        onSelectZone={(id) => {
          if (id === "program") {
            if (zone === "program") return;
            openProgram(patternId);
          } else {
            setZone(id);
          }
        }}
      />

      <AuthModal
        key={authOpen ? "open" : "closed"}
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        supabase={supabase}
        supabaseReady={Boolean(supabase)}
      />
    </div>
  );
}
