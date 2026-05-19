"use client";

import { PatternGalleryCard } from "@/components/PatternGalleryCard";
import { fetchPublicPatternsByUserId, type GalleryPattern } from "@/lib/galleryHelpers";
import { fetchProfileByDisplayName } from "@/lib/profileHelpers";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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
  | { status: "loaded"; displayName: string; patterns: GalleryPattern[] };

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

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
      setPageState({ status: "loaded", displayName: profile.display_name, patterns });
    })();

    return () => { cancelled = true; };
  }, [supabase, displayname]);

  return (
    <div className="min-h-screen text-stone-800">
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/40 bg-white/80 px-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="font-serif text-xl font-bold text-brand hover:text-brand-dark"
          >
            Gridwork
          </Link>
          <Link
            href="/gallery"
            className="hidden text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700 md:inline"
          >
            Gallery
          </Link>
          <Link
            href="/learn"
            className="hidden text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700 md:inline"
          >
            Learn
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/editor"
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50"
          >
            Editor
          </Link>
          {user && (
            <Link
              href="/profile"
              className="text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700"
            >
              Profile
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="rounded-md border border-stone-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            aria-label="Menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
              <Link
                href="/gallery"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
              >
                Gallery
              </Link>
              <Link
                href="/learn"
                onClick={() => setMenuOpen(false)}
                className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
              >
                Learn
              </Link>
              <Link
                href="/editor"
                onClick={() => setMenuOpen(false)}
                className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
              >
                Editor
              </Link>
              {user && (
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50"
                >
                  Profile
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {configError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {configError}
          </div>
        )}

        {pageState.status === "loading" && (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-stone-500">Loading…</p>
          </div>
        )}

        {pageState.status === "not_found" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="font-serif text-2xl font-bold text-stone-400">This profile doesn&apos;t exist</p>
            <p className="mt-2 text-sm text-stone-400">
              The display name <span className="font-medium text-stone-600">@{displayname}</span> hasn&apos;t been claimed.
            </p>
            <Link
              href="/gallery"
              className="mt-6 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
            >
              Browse the gallery
            </Link>
          </div>
        )}

        {pageState.status === "loaded" && (
          <>
            <div className="mb-8 border-b border-stone-100 pb-6">
              <h1 className="font-serif text-3xl font-bold text-stone-900">
                @{pageState.displayName}
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                {pageState.patterns.length === 0
                  ? "No public patterns yet."
                  : `${pageState.patterns.length} public pattern${pageState.patterns.length === 1 ? "" : "s"}`}
              </p>
            </div>

            {pageState.patterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-stone-400">This maker hasn&apos;t shared any patterns publicly yet.</p>
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
                    onPreview={() => {}}
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
    </div>
  );
}
