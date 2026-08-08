"use client";

import { AuthModal } from "@/components/AuthModal";
import * as Sentry from "@sentry/nextjs";
import { useNavAuth } from "@/components/NavAuthProvider";
import { PatternGalleryCard } from "@/components/PatternGalleryCard";
import { MachineKeyboardBar } from "@/components/machine/MachineKeyboardBar";
import { ManilaThumbnail } from "@/components/ManilaThumbnail";
import {
  copyPublicPattern,
  fetchPublicPatternsByUserId,
  fetchUserLikedPatternIds,
  togglePatternLike,
  type GalleryPattern,
} from "@/lib/galleryHelpers";
import { manilaHex } from "@/lib/manilaStock";
import { fetchProfileByDisplayName } from "@/lib/profileHelpers";
import { useSupabaseInit } from "@/hooks/useSupabaseInit";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type LoadedState = {
  status: "loaded";
  displayName: string;
  userId: string;
  avatarUrl: string | null;
  patterns: GalleryPattern[];
};

type PageState =
  | { status: "loading" }
  | { status: "not_found" }
  | LoadedState;

/** Public maker profile — same hopper + aside reader layout as private Maker. */
function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const displayname = typeof params.displayname === "string" ? params.displayname : "";
  const { user } = useNavAuth();
  const returnQ = searchParams.get("q")?.trim() ?? "";
  const hopperBackHref = returnQ
    ? `/hopper?q=${encodeURIComponent(returnQ)}`
    : "/hopper";

  const { supabase, configError } = useSupabaseInit();
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const previewPattern =
    previewId && pageState.status === "loaded"
      ? pageState.patterns.find((p) => p.id === previewId) ?? null
      : null;

  const previewPaper = useMemo(
    () => manilaHex(previewPattern?.manila_stock ?? "manila"),
    [previewPattern],
  );

  const previewLiked = previewPattern ? likedIds.has(previewPattern.id) : false;
  const isOwnProfile = Boolean(user && pageState.status === "loaded" && user.id === pageState.userId);

  useEffect(() => {
    if (!supabase || !displayname) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets to loading before the fetch below starts
    setPageState({ status: "loading" });
    setPreviewId(null);

    void (async () => {
      const { data: profile, error: profileError } = await fetchProfileByDisplayName(supabase, displayname);
      if (cancelled) return;
      if (profileError) {
        console.error(profileError);
        Sentry.captureException(profileError);
      }
      if (!profile) {
        setPageState({ status: "not_found" });
        return;
      }
      const { data: patterns, error: patternsError } = await fetchPublicPatternsByUserId(supabase, profile.user_id);
      if (cancelled) return;
      if (patternsError) {
        console.error(patternsError);
        Sentry.captureException(patternsError);
      }
      setPageState({
        status: "loaded",
        displayName: profile.display_name,
        userId: profile.user_id,
        avatarUrl: profile.avatar_url ?? null,
        patterns,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, displayname]);

  useEffect(() => {
    if (!supabase || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears liked state on logout; must react to auth changes
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

  const patchPattern = useCallback((patternId: string, patch: Partial<GalleryPattern>) => {
    setPageState((prev) => {
      if (prev.status !== "loaded") return prev;
      return {
        ...prev,
        patterns: prev.patterns.map((p) => (p.id === patternId ? { ...p, ...patch } : p)),
      };
    });
  }, []);

  const handleLike = useCallback(
    async (patternId: string) => {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      if (!supabase) return;
      if (pageState.status === "loaded" && pageState.userId === user.id) return;

      const currentlyLiked = likedIds.has(patternId);
      const pattern =
        pageState.status === "loaded"
          ? pageState.patterns.find((p) => p.id === patternId)
          : null;
      if (!pattern) return;

      setLikedIds((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.delete(patternId);
        else next.add(patternId);
        return next;
      });
      patchPattern(patternId, {
        likes_count: pattern.likes_count + (currentlyLiked ? -1 : 1),
      });

      const { error } = await togglePatternLike(supabase, patternId);
      if (error) {
        console.error(error);
        Sentry.captureException(error);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (currentlyLiked) next.add(patternId);
          else next.delete(patternId);
          return next;
        });
        patchPattern(patternId, { likes_count: pattern.likes_count });
      }
    },
    [user, supabase, likedIds, pageState, patchPattern],
  );

  const handleCopy = useCallback(
    async (patternId: string) => {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      if (!supabase) return;
      setCopying(patternId);
      const { newPatternId, error } = await copyPublicPattern(supabase, patternId);
      setCopying(null);
      if (error || !newPatternId) {
        console.error(error ?? "No pattern ID returned");
        Sentry.captureException(error ?? new Error("copyPublicPattern: no pattern ID returned"));
        return;
      }
      const pattern =
        pageState.status === "loaded"
          ? pageState.patterns.find((p) => p.id === patternId)
          : null;
      if (pattern) {
        patchPattern(patternId, { copies_count: pattern.copies_count + 1 });
      }
      router.push(`/program?pattern=${newPatternId}`);
    },
    [user, supabase, pageState, patchPattern, router],
  );

  if (pageState.status === "not_found") {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="font-mono text-2xl font-bold text-ink">This profile doesn&apos;t exist</p>
          <p className="mt-2 font-mono text-sm text-muted">
            The display name <span className="font-bold text-ink">@{displayname}</span> hasn&apos;t been claimed.
          </p>
          <Link href={hopperBackHref} className="mt-6 punch-lamp punch-lamp-blue is-lit">
            Browse the hopper
          </Link>
        </div>
        <MachineKeyboardBar />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-paper">
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(0,0,0,0.05) 100%), #EDE8D5",
        }}
      >
        {configError && (
          <div className="relative z-[3] m-3 rounded-sm border border-amber-300 bg-amber-50 p-3 font-mono text-xs text-amber-900">
            {configError}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <section
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 45%, rgba(0,0,0,0.12) 100%), var(--console-desk)",
              flex: "1 1 56%",
            }}
          >
            <div className="relative z-[2] flex min-h-0 flex-1 flex-col overflow-hidden">
              {pageState.status === "loading" ? (
                <p className="py-16 text-center font-mono text-sm text-chassis-light">Loading…</p>
              ) : (
                <>
                  <div className="punch-console-face !flex-col !items-stretch !justify-between !gap-2">
                    <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                      Deck
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-4">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-key-blue font-mono text-sm font-bold text-white">
                        {pageState.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pageState.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          pageState.displayName.charAt(0).toUpperCase()
                        )}
                      </span>
                      <h1 className="min-w-0 truncate font-mono text-[13px] font-bold tracking-[0.06em] uppercase" style={{ color: "#0A0A0A" }}>
                        @{pageState.displayName}
                      </h1>

                      <div className="min-w-0 flex-1" />

                      <Link
                        href={hopperBackHref}
                        className="punch-lamp punch-lamp-red !min-h-[32px] !px-2.5 text-[9px] no-underline"
                      >
                        Back
                      </Link>
                    </div>
                  </div>

                  <div className="punch-console-bay min-h-0 flex-1 overflow-y-auto">
                    <p className="relative z-[2] mb-3 pl-2 font-mono text-[10px] font-medium tracking-[0.08em] uppercase" style={{ color: "#0A0A0A" }}>
                      {pageState.patterns.length === 0
                        ? "No public patterns yet."
                        : `${pageState.patterns.length} pattern${pageState.patterns.length === 1 ? "" : "s"}`}
                    </p>
                    {pageState.patterns.length === 0 ? null : (
                      <div className="hopper-bay pl-6">
                        <div className="relative z-[2] grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                          {pageState.patterns.map((p) => (
                            <PatternGalleryCard
                              key={p.id}
                              pattern={p}
                              isLiked={likedIds.has(p.id)}
                              isOwn={isOwnProfile}
                              onLike={() => void handleLike(p.id)}
                              onCopy={() => void handleCopy(p.id)}
                              onPreview={() => setPreviewId(p.id)}
                              copying={copying === p.id}
                              canInteract={Boolean(user)}
                              makerDisplayName={pageState.displayName}
                              makerHref={`/u/${pageState.displayName}`}
                              active={previewId === p.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="flex w-full shrink-0 flex-col border-t-2 border-chassis-dark md:w-[min(480px,44%)] md:border-l-2 md:border-t-0">
            <div className="steel-tray flex h-full min-h-[260px] flex-col !rounded-none !border-0" style={{ minHeight: "100%" }}>
              <div className="relative z-[2] mb-2 flex items-center gap-2">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                    Reader
                  </span>
                  <span className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
                    · {previewPattern ? "Preview" : "Idle"}
                  </span>
                </div>
              </div>
              <div className="relative z-[2] flex min-h-0 flex-1 flex-col">
                {previewPattern && pageState.status === "loaded" ? (
                  <>
                    <div
                      className="punch-card flex min-h-0 flex-1 flex-col overflow-hidden"
                      style={{ ["--manila-stock" as string]: previewPaper, background: previewPaper }}
                    >
                      <div className="relative min-h-0 flex-1" style={{ background: previewPaper }}>
                        {previewPattern.thumbnail ? (
                          <ManilaThumbnail
                            src={previewPattern.thumbnail}
                            alt={previewPattern.name}
                            stockId={previewPattern.manila_stock}
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
                            {previewPattern.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.06em] uppercase punch-print-faint">
                            {previewPattern.grid_width}×{previewPattern.grid_height}
                          </p>
                          <p className="mt-1 truncate punch-print-label">
                            @{pageState.displayName}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="relative z-[2] mt-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleLike(previewPattern.id)}
                        disabled={isOwnProfile}
                        className={`punch-lamp punch-lamp-red !min-h-[32px] !px-2.5 text-[9px] ${
                          previewLiked ? "is-lit" : "is-dim"
                        }`}
                      >
                        Like {previewPattern.likes_count}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy(previewPattern.id)}
                        disabled={copying === previewPattern.id}
                        className="punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px]"
                      >
                        {copying === previewPattern.id ? "…" : `Copy ${previewPattern.copies_count}`}
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    className="punch-card flex flex-1 flex-col items-center justify-center gap-2 p-6"
                    style={{ background: "var(--manila-stock)" }}
                  >
                    <p className="font-mono text-[11px] font-bold uppercase punch-print-ink">Select a card</p>
                    <p className="max-w-[20ch] text-center font-mono text-[10px] punch-print-faint">
                      Preview feeds here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <MachineKeyboardBar />

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

export default function UserProfilePageRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-paper font-mono text-sm text-chassis-dark">
          Loading…
        </div>
      }
    >
      <UserProfilePage />
    </Suspense>
  );
}
