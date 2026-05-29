"use client";

import { AuthModal } from "@/components/AuthModal";
import { CrochetMark } from "@/components/CrochetMark";
import { NavUserSection } from "@/components/NavUserSection";
import { PatternGalleryCard } from "@/components/PatternGalleryCard";
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
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const PAGE_SIZE = 24;

export default function GalleryPage() {
  const router = useRouter();

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
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);

  const hasMore = patterns.length < total;
  const previewPattern = previewId ? (patterns.find((p) => p.id === previewId) ?? null) : null;

  useEffect(() => {
    if (!previewId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    setLoading(true);
    setUserResults([]);

    const patternFetch = fetchGalleryPatterns(supabase, {
      sortBy,
      search: activeSearch,
      page: 0,
      pageSize: PAGE_SIZE,
    }).then(async ({ data, total: t, error }) => {
      if (cancelled) return;
      if (error) console.error(error);
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
          if (!cancelled) setUserResults(results);
        })
      : Promise.resolve();

    void Promise.all([patternFetch, userFetch]);

    return () => {
      cancelled = true;
    };
  }, [supabase, sortBy, activeSearch]);

  useEffect(() => {
    if (!supabase || !user) {
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
    if (error) console.error(error);
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
        return;
      }
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === patternId ? { ...p, copies_count: p.copies_count + 1 } : p,
        ),
      );
      router.push("/editor");
    },
    [user, supabase, router],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
  };

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  return (
    <div className="min-h-screen">
      {/* Transparent navbar */}
      <header className="z-20 flex h-[68px] items-center justify-between px-8">
        <div className="flex items-center gap-9">
          <Link href="/" className="inline-flex items-center gap-[9px] font-serif text-2xl font-bold leading-none tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
            <CrochetMark size={22} color="#fff" />
            Gridwork
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Home</Link>
            <Link href="/learn" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Learn</Link>
            <span className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full bg-white" />
              Gallery
            </span>
            <Link href="/editor" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Editor</Link>
          </nav>
        </div>
        <NavUserSection activePage="gallery" />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-0 pb-16">
        {configError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {configError}
          </div>
        )}

        {/* Page header */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white/85" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)", marginBottom: 8 }}>
              Community patterns
            </div>
            <h1 className="font-serif text-3xl font-bold leading-none tracking-[-0.02em] text-white md:text-[48px]" style={{ textShadow: "0 2px 6px rgba(40,20,40,0.18)", margin: 0 }}>
              Gallery
            </h1>
            <p className="font-serif italic text-[16px] text-white/92 mt-1" style={{ textShadow: "0 1px 2px rgba(40,20,40,0.18)" }}>
              Browse, like, and copy patterns shared by the community.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Sort pills */}
            <div
              className="inline-flex items-center self-start rounded-full"
              style={{ background: "#FBF7EF", padding: 4, boxShadow: "0 4px 14px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)" }}
            >
              <button
                type="button"
                onClick={() => setSortBy("newest")}
                className={`min-h-[36px] rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
                  sortBy === "newest" ? "bg-brand text-[#FBF7EF]" : "text-muted-strong hover:text-text-strong"
                }`}
              >
                Newest
              </button>
              <button
                type="button"
                onClick={() => setSortBy("popular")}
                className={`min-h-[36px] rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
                  sortBy === "popular" ? "bg-brand text-[#FBF7EF]" : "text-muted-strong hover:text-text-strong"
                }`}
              >
                Popular
              </button>
            </div>
            {/* Search — full width on mobile */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-1 rounded-full"
              style={{ background: "#FBF7EF", padding: 4, boxShadow: "0 4px 14px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)" }}
            >
              <div className="inline-flex flex-1 items-center gap-2 px-2 py-1.5">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#7A6A5F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>
                </svg>
                <input
                  type="search"
                  placeholder="Search patterns…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent font-sans text-[13px] font-medium text-text-strong placeholder:text-muted focus:outline-none"
                />
              </div>
              <button type="submit" className="min-h-[36px] rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold text-[#FBF7EF] hover:bg-brand-dark">
                Go
              </button>
            </form>
            {activeSearch && (
              <button type="button" onClick={handleClearSearch} className="self-start rounded-full border border-white/40 bg-white/20 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm hover:bg-white/30">
                Clear
              </button>
            )}
          </div>
        </div>

        {activeSearch && userResults.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Users</p>
            <div className="flex flex-col gap-1">
              {userResults.map((u) => (
                <div
                  key={u.display_name}
                  className="flex items-center justify-between rounded-xl px-4 py-2.5"
                  style={{ background: "#FBF7EF", boxShadow: "0 4px 14px rgba(40,20,30,0.08), 0 0 0 1px rgba(255,255,255,0.5)" }}
                >
                  <span className="font-sans text-sm font-semibold text-text-strong">@{u.display_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-sans text-xs font-medium text-muted">
                      {u.public_pattern_count} pattern{u.public_pattern_count === 1 ? "" : "s"}
                    </span>
                    <Link href={`/u/${u.display_name}?ref=gallery`} className="font-sans text-xs font-bold text-brand hover:text-brand-dark hover:underline">
                      View profile →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <p className="mb-4 font-sans text-sm font-medium text-white/70">
            {total === 0
              ? activeSearch
                ? `No patterns found for "${activeSearch}".`
                : "No public patterns yet. Share yours from the editor!"
              : `${total} pattern${total === 1 ? "" : "s"}`}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="font-sans text-sm font-medium text-white/70">Loading patterns…</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {patterns.map((p) => (
                <PatternGalleryCard
                  key={p.id}
                  pattern={p}
                  isLiked={likedIds.has(p.id)}
                  isOwn={user?.id === p.user_id}
                  onLike={() => void handleLike(p.id)}
                  onCopy={() => void handleCopy(p.id)}
                  onPreview={() => setPreviewId(p.id)}
                  copying={copying === p.id}
                  canInteract={Boolean(user)}
                  makerDisplayName={displayNames.get(p.user_id) ?? null}
                  makerHref={displayNames.get(p.user_id) ? `/u/${displayNames.get(p.user_id)}?ref=gallery` : undefined}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="rounded-full border border-white/40 bg-white/20 px-6 py-2.5 font-sans text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/30 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Pattern preview modal */}
      {previewPattern && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
              aria-label="Close preview"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>

            {/* Large thumbnail */}
            <div className="flex max-h-[55vh] items-center justify-center overflow-hidden bg-stone-50">
              {previewPattern.thumbnail ? (
                <img
                  src={previewPattern.thumbnail}
                  alt={`${previewPattern.name} preview`}
                  className="max-h-[55vh] max-w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center text-stone-300">
                  <svg viewBox="0 0 40 40" width="48" height="48" fill="currentColor">
                    <rect x="0" y="0" width="12" height="12" rx="1" />
                    <rect x="14" y="0" width="12" height="12" rx="1" opacity="0.3" />
                    <rect x="28" y="0" width="12" height="12" rx="1" />
                    <rect x="0" y="14" width="12" height="12" rx="1" opacity="0.3" />
                    <rect x="14" y="14" width="12" height="12" rx="1" />
                    <rect x="28" y="14" width="12" height="12" rx="1" opacity="0.3" />
                    <rect x="0" y="28" width="12" height="12" rx="1" />
                    <rect x="14" y="28" width="12" height="12" rx="1" opacity="0.3" />
                    <rect x="28" y="28" width="12" height="12" rx="1" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info + actions */}
            <div className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-stone-900">{previewPattern.name}</p>
                <p className="mt-0.5 text-sm text-stone-400">
                  {displayNames.get(previewPattern.user_id)
                    ? `@${displayNames.get(previewPattern.user_id)}`
                    : `@${previewPattern.user_id.slice(0, 6).toLowerCase()}`} · {previewPattern.grid_width}×{previewPattern.grid_height}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleLike(previewPattern.id)}
                  disabled={!user || user.id === previewPattern.user_id}
                  title={!user ? "Log in to like" : user.id === previewPattern.user_id ? "Can't like your own" : likedIds.has(previewPattern.id) ? "Unlike" : "Like"}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    likedIds.has(previewPattern.id)
                      ? "bg-rose-50 text-rose-600 hover:enabled:bg-rose-100"
                      : "bg-stone-100 text-stone-600 hover:enabled:bg-stone-200"
                  }`}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" fill={likedIds.has(previewPattern.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5a3 3 0 015.5-1.65A3 3 0 0114.5 5.5C14.5 9.5 8 13.5 8 13.5z" />
                  </svg>
                  {previewPattern.likes_count}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy(previewPattern.id)}
                  disabled={!user || copying === previewPattern.id}
                  title={!user ? "Log in to copy" : "Copy to your patterns"}
                  className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="5" width="8" height="10" rx="1.5" />
                    <path d="M3 11V3a1 1 0 011-1h8" />
                  </svg>
                  {copying === previewPattern.id ? "Copying…" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
