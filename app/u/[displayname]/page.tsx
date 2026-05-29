"use client";

import { CrochetMark } from "@/components/CrochetMark";
import { NavUserSection } from "@/components/NavUserSection";
import { PatternGalleryCard } from "@/components/PatternGalleryCard";
import { fetchPublicPatternsByUserId, type GalleryPattern } from "@/lib/galleryHelpers";
import { fetchProfileByDisplayName } from "@/lib/profileHelpers";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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

type PageState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "loaded"; displayName: string; userId: string; avatarUrl: string | null; patterns: GalleryPattern[] };

export default function UserProfilePage() {
  const params = useParams();
  const displayname = typeof params.displayname === "string" ? params.displayname : "";

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
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fromGallery, setFromGallery] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewPattern = previewId && pageState.status === "loaded"
    ? pageState.patterns.find((p) => p.id === previewId) ?? null
    : null;

  useEffect(() => {
    if (!previewId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromGallery(params.get("ref") === "gallery");
  }, []);

  useEffect(() => {
    if (!supabase || !displayname) return;
    let cancelled = false;
    setPageState({ status: "loading" });

    void (async () => {
      const { data: profile, error: profileError } = await fetchProfileByDisplayName(supabase, displayname);
      if (cancelled) return;
      if (profileError) console.error(profileError);
      if (!profile) {
        setPageState({ status: "not_found" });
        return;
      }
      const { data: patterns, error: patternsError } = await fetchPublicPatternsByUserId(supabase, profile.user_id);
      if (cancelled) return;
      if (patternsError) console.error(patternsError);
      setPageState({ status: "loaded", displayName: profile.display_name, userId: profile.user_id, avatarUrl: profile.avatar_url ?? null, patterns });
    })();

    return () => { cancelled = true; };
  }, [supabase, displayname]);

  return (
    <div className="min-h-screen">
      <header className="z-20 flex h-[68px] items-center justify-between px-8">
        <div className="flex items-center gap-9">
          <Link href="/" className="inline-flex items-center gap-[9px] font-serif text-2xl font-bold leading-none tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]">
            <CrochetMark size={22} color="#fff" />
            Gridwork
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Home</Link>
            <Link href="/learn" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Learn</Link>
            <Link href="/gallery" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Gallery</Link>
            <Link href="/editor" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Editor</Link>
          </nav>
        </div>
        <NavUserSection activePage={null} />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {configError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {configError}
          </div>
        )}

        {pageState.status === "loading" && (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-white/70">Loading…</p>
          </div>
        )}

        {pageState.status === "not_found" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="font-serif text-2xl font-bold text-white/60">This profile doesn&apos;t exist</p>
            <p className="mt-2 text-sm text-white/50">
              The display name <span className="font-medium text-white/80">@{displayname}</span> hasn&apos;t been claimed.
            </p>
            <Link
              href="/gallery"
              className="mt-6 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25"
            >
              Browse the gallery
            </Link>
          </div>
        )}

        {pageState.status === "loaded" && (
          <>
            {(fromGallery || currentUserId !== pageState.userId) && (
              <Link
                href="/gallery"
                className="mb-6 inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold text-white/80 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 3L5 8l5 5" />
                </svg>
                Back to Gallery
              </Link>
            )}
            <div className="mb-8 flex items-center gap-5 border-b border-white/20 pb-6">
              <span
                className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-serif text-[28px] font-bold leading-none text-white"
                style={{
                  width: 72, height: 72,
                  background: pageState.avatarUrl ? undefined : "linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)",
                  border: "3px solid rgba(255,255,255,0.55)",
                  boxShadow: "0 4px 16px rgba(168,70,111,0.22)",
                  flexShrink: 0,
                }}
              >
                {pageState.avatarUrl
                  ? <img src={pageState.avatarUrl} alt="" className="h-full w-full object-cover" />
                  : pageState.displayName.charAt(0).toUpperCase()
                }
              </span>
              <div>
                <h1 className="font-serif text-3xl font-bold text-white">
                  @{pageState.displayName}
                </h1>
                <p className="mt-1 text-sm text-white/60">
                  {pageState.patterns.length === 0
                    ? "No public patterns yet."
                    : `${pageState.patterns.length} public pattern${pageState.patterns.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>

            {pageState.patterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-white/50">This maker hasn&apos;t shared any patterns publicly yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {pageState.patterns.map((p) => (
                  <PatternGalleryCard
                    key={p.id}
                    pattern={p}
                    isLiked={false}
                    isOwn={false}
                    onLike={() => {}}
                    onCopy={() => {}}
                    onPreview={() => setPreviewId(p.id)}
                    copying={false}
                    canInteract={false}
                    makerDisplayName={pageState.displayName}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {previewPattern && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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
            <div className="p-4">
              <p className="truncate text-base font-semibold text-stone-900">{previewPattern.name}</p>
              <p className="mt-0.5 text-sm text-stone-400">
                {pageState.status === "loaded" ? `@${pageState.displayName}` : ""} · {previewPattern.grid_width}×{previewPattern.grid_height}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
