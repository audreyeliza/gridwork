"use client";

import { AuthModal } from "@/components/AuthModal";
import { CardReaderPreview } from "@/components/CardReaderPreview";
import { PatternGalleryCard } from "@/components/PatternGalleryCard";
import { RotaryKnob } from "@/components/machine/RotaryKnob";
import {
  copyPublicPattern,
  fetchGalleryPatterns,
  fetchUserLikedPatternIds,
  searchUsers,
  togglePatternLike,
  type GalleryPattern,
  type GallerySortBy,
  type UserSearchResult,
} from "@/lib/galleryHelpers";
import { fetchProfilesByUserIds } from "@/lib/profileHelpers";
import { useSupabaseInit } from "@/hooks/useSupabaseInit";
import * as Sentry from "@sentry/nextjs";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 24;

const USER_LAMP_COLORS = [
  "punch-lamp-red",
  "punch-lamp-orange",
  "punch-lamp-amber",
  "punch-lamp-green",
  "punch-lamp-blue",
  "punch-lamp-violet",
] as const;

type UserSearchResultWithLamp = UserSearchResult & {
  lampClass: (typeof USER_LAMP_COLORS)[number];
};

function randomUserLampClass(): (typeof USER_LAMP_COLORS)[number] {
  return USER_LAMP_COLORS[Math.floor(Math.random() * USER_LAMP_COLORS.length)]!;
}

function makerProfileHref(displayName: string, q: string): string {
  const params = new URLSearchParams({ ref: "gallery" });
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed);
  return `/u/${encodeURIComponent(displayName)}?${params.toString()}`;
}

export type HopperZoneProps = {
  onProgramCard?: (patternId: string | null) => void;
  onPreviewCard?: (pattern: GalleryPattern, makerLabel: string, isOwn: boolean) => void;
  previewId?: string | null;
  compact?: boolean;
  /** Apply count / like sync from the shell reader aside. */
  syncTick?: {
    seq: number;
    patternId: string;
    likes_count: number;
    copies_count: number;
    liked: boolean;
  } | null;
};

export function HopperZone({
  onProgramCard,
  onPreviewCard,
  previewId = null,
  compact = false,
  syncTick = null,
}: HopperZoneProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q")?.trim() ?? "";

  const { supabase, configError } = useSupabaseInit();

  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setUser(s?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setUser(newSession?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const [patterns, setPatterns] = useState<GalleryPattern[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<GallerySortBy>("newest");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [searchInput, setSearchInput] = useState(urlQ);
  const [activeSearch, setActiveSearch] = useState(urlQ);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState<string | null>(null);
  const [modalPreviewId, setModalPreviewId] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [userResults, setUserResults] = useState<UserSearchResultWithLamp[]>([]);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs search state from the URL-derived param
    setSearchInput(q);
    setActiveSearch(q);
  }, [searchParams]);

  const hasMore = patterns.length < total;
  const previewPattern = modalPreviewId ? (patterns.find((p) => p.id === modalPreviewId) ?? null) : null;

  const displayPatterns = sortDir === "asc" ? [...patterns].reverse() : patterns;

  useEffect(() => {
    if (!syncTick) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- merges a real-time like/copy count update from a sibling zone
    setPatterns((prev) =>
      prev.map((p) =>
        p.id === syncTick.patternId
          ? { ...p, likes_count: syncTick.likes_count, copies_count: syncTick.copies_count }
          : p,
      ),
    );
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (syncTick.liked) next.add(syncTick.patternId);
      else next.delete(syncTick.patternId);
      return next;
    });
  }, [syncTick]);

  useEffect(() => {
    if (!modalPreviewId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModalPreviewId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalPreviewId]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state before the fetch below starts
    setLoading(true);
    setUserResults([]);

    const patternFetch = fetchGalleryPatterns(supabase, {
      sortBy,
      search: activeSearch,
      page: 0,
      pageSize: PAGE_SIZE,
    }).then(async ({ data, total: t, error }) => {
      if (cancelled) return;
      if (error) {
        console.error(error);
        Sentry.captureException(error);
      }
      setPatterns(data);
      setTotal(t);
      setPage(0);
      setLoading(false);
      const uniqueIds = [...new Set(data.map((p) => p.user_id))];
      const names = await fetchProfilesByUserIds(supabase, uniqueIds);
      if (!cancelled) setDisplayNames(names);
    });

    const userFetch = activeSearch.trim()
      ? searchUsers(supabase, activeSearch).then((results) => {
          if (!cancelled) {
            setUserResults(
              results.map((u) => ({ ...u, lampClass: randomUserLampClass() })),
            );
          }
        })
      : Promise.resolve();

    void Promise.all([patternFetch, userFetch]);

    return () => {
      cancelled = true;
    };
  }, [supabase, sortBy, activeSearch]);

  useEffect(() => {
    if (!supabase || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears liked state on logout; must react to auth changes
      setLikedIds(new Set());
      return;
    }
    void fetchUserLikedPatternIds(supabase, user.id).then((ids) => {
      setLikedIds(ids);
    });
  }, [supabase, user]);

  const handleLoadMore = useCallback(async () => {
    if (!supabase || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const { data, error } = await fetchGalleryPatterns(supabase, {
      sortBy,
      search: activeSearch,
      page: nextPage,
      pageSize: PAGE_SIZE,
    });
    if (error) {
      console.error(error);
      Sentry.captureException(error);
    }
    setPatterns((prev) => [...prev, ...data]);
    setPage(nextPage);
    setLoadingMore(false);
    const newIds = data.map((p) => p.user_id).filter((id) => !displayNames.has(id));
    if (newIds.length > 0) {
      const names = await fetchProfilesByUserIds(supabase, [...new Set(newIds)]);
      setDisplayNames((prev) => new Map([...prev, ...names]));
    }
  }, [supabase, loadingMore, page, sortBy, activeSearch, displayNames]);

  const handleLike = useCallback(
    async (patternId: string) => {
      if (!user) {
        setAuthModalOpen(true);
        return;
      }
      if (!supabase) return;
      const currentlyLiked = likedIds.has(patternId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.delete(patternId);
        else next.add(patternId);
        return next;
      });
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === patternId
            ? { ...p, likes_count: p.likes_count + (currentlyLiked ? -1 : 1) }
            : p,
        ),
      );
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
        setPatterns((prev) =>
          prev.map((p) =>
            p.id === patternId
              ? { ...p, likes_count: p.likes_count + (currentlyLiked ? 1 : -1) }
              : p,
          ),
        );
      }
    },
    [user, supabase, likedIds],
  );

  const handleCopy = useCallback(
    async (patternId: string) => {
      if (!user) {
        setAuthModalOpen(true);
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
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === patternId ? { ...p, copies_count: p.copies_count + 1 } : p,
        ),
      );
      onProgramCard?.(newPatternId);
    },
    [user, supabase, onProgramCard],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = searchInput.trim();
    setActiveSearch(next);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("zone");
    if (next) params.set("q", next);
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `/hopper?${qs}` : "/hopper", { scroll: false });
  };

  return (
    <div className={compact ? "h-full min-h-0 flex flex-col" : "h-full min-h-0 flex flex-col"}>
        {configError && (
          <div className="mb-3 rounded-sm border border-amber-300 bg-amber-50 p-3 font-mono text-xs text-amber-900">
            {configError}
          </div>
        )}

        <div className="punch-console flex min-h-0 flex-1 flex-col !rounded-none !border-0 !shadow-none">

          <div className="punch-console-face !flex-col !items-stretch !justify-between !gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
              Hopper
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-8">
              <form
                onSubmit={handleSearchSubmit}
                className="punch-console-slot min-w-0 flex-1"
              >
                <input
                  type="text"
                  placeholder="Search patterns…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[12px] font-medium text-chassis-light placeholder:text-chassis-light focus:outline-none"
                />
              </form>

              <div className="flex shrink-0 items-center gap-5">
                <RotaryKnob
                  label="Mode"
                  value={sortBy}
                  options={[
                    { value: "newest" as const, label: "Newest" },
                    { value: "popular" as const, label: "Popular" },
                  ]}
                  onChange={setSortBy}
                  accent="#0A0A0A"
                  pointer="#FFFFFF"
                  dial="var(--key-blue)"
                />
                <RotaryKnob
                  label="Order"
                  value={sortDir}
                  options={[
                    { value: "desc" as const, label: "Desc" },
                    { value: "asc" as const, label: "Asc" },
                  ]}
                  onChange={setSortDir}
                  accent="#0A0A0A"
                  pointer="#FFFFFF"
                  dial="var(--key-blue)"
                />
              </div>
            </div>
          </div>

          {activeSearch && userResults.length > 0 && (
            <div className="relative z-[2] px-3 py-3">
              <p className="mb-2 pl-2 font-mono text-[10px] font-medium tracking-[0.08em] uppercase" style={{ color: "#0A0A0A" }}>
                {userResults.length} user{userResults.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-2 pl-2">
                {userResults.map((u) => (
                  <Link
                    key={u.display_name}
                    href={makerProfileHref(u.display_name, activeSearch)}
                    className={`punch-lamp ${u.lampClass} !min-h-[36px] !px-3 no-underline`}
                    title={`${u.public_pattern_count} public pattern${u.public_pattern_count === 1 ? "" : "s"}`}
                  >
                    <span className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase">
                      @{u.display_name}
                    </span>
                    <span className="ml-1.5 font-mono text-[9px] font-medium opacity-70">
                      {u.public_pattern_count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="punch-console-bay">
            {!loading && (
              <p className="relative z-[2] mb-3 pl-2 font-mono text-[10px] font-medium tracking-[0.08em] uppercase" style={{ color: "#0A0A0A" }}>
                {total === 0
                  ? activeSearch
                    ? `No patterns found for "${activeSearch}".`
                    : "No public patterns yet. Share yours from Program."
                  : `${total} pattern${total === 1 ? "" : "s"}`}
              </p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <p className="font-mono text-sm text-chassis-light">Loading patterns…</p>
              </div>
            ) : (
              <>
                {displayPatterns.length > 0 && (
                  <div className="hopper-bay pl-6">
                    <div className="relative z-[2] grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {displayPatterns.map((p) => (
                        <PatternGalleryCard
                          key={p.id}
                          pattern={p}
                          isLiked={likedIds.has(p.id)}
                          isOwn={user?.id === p.user_id}
                          onLike={() => void handleLike(p.id)}
                          onCopy={() => void handleCopy(p.id)}
                          onPreview={() => {
                            const maker = displayNames.get(p.user_id);
                            const makerLabel = maker
                              ? `@${maker}`
                              : `@${p.user_id.slice(0, 6).toLowerCase()}`;
                            if (onPreviewCard) {
                              onPreviewCard(p, makerLabel, user?.id === p.user_id);
                              return;
                            }
                            setModalPreviewId(p.id);
                          }}
                          copying={copying === p.id}
                          canInteract={Boolean(user)}
                          makerDisplayName={displayNames.get(p.user_id) ?? null}
                          makerHref={
                            displayNames.get(p.user_id)
                              ? makerProfileHref(displayNames.get(p.user_id)!, activeSearch)
                              : undefined
                          }
                          active={previewId === p.id}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {hasMore && (
                  <div className="relative z-[2] mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void handleLoadMore()}
                      disabled={loadingMore}
                      className="punch-key disabled:opacity-50"
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      {previewPattern && (
        <CardReaderPreview
          pattern={previewPattern}
          makerLabel={
            displayNames.get(previewPattern.user_id)
              ? `@${displayNames.get(previewPattern.user_id)}`
              : `@${previewPattern.user_id.slice(0, 6).toLowerCase()}`
          }
          onClose={() => setModalPreviewId(null)}
          onLike={() => void handleLike(previewPattern.id)}
          onCopy={() => void handleCopy(previewPattern.id)}
          liked={likedIds.has(previewPattern.id)}
          canLike={Boolean(user) && user!.id !== previewPattern.user_id}
          canCopy={Boolean(user)}
          copying={copying === previewPattern.id}
        />
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
