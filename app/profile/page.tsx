"use client";

import {
  checkDisplayNameAvailable,
  fetchProfile,
  upsertProfile,
} from "@/lib/profileHelpers";
import { fetchPatternsForUser, type Pattern } from "@/lib/patternHelpers";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Supabase init (same pattern used across all pages) ───────────────────────

type SupabaseInit = { supabase: SupabaseClient | null; configError: string | null };

function initSupabaseClient(): SupabaseInit {
  try {
    return { supabase: getSupabaseBrowserClient(), configError: null };
  } catch (e) {
    return { supabase: null, configError: e instanceof Error ? e.message : "Supabase is not configured." };
  }
}

// ─── Validation (mirrors DisplayNameModal / PatternSidebar) ───────────────────

const NAME_REGEX = /^[a-zA-Z0-9_]+$/;

function validateDisplayName(name: string): string | null {
  if (name.length < 3) return "At least 3 characters required";
  if (name.length > 30) return "30 characters maximum";
  if (!NAME_REGEX.test(name)) return "Letters, numbers, and underscores only";
  return null;
}

// ─── Profile pattern card ─────────────────────────────────────────────────────

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5a8 8 0 010 11M8 2.5a8 8 0 000 11" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5a3 3 0 015.5-1.65A3 3 0 0114.5 5.5C14.5 9.5 8 13.5 8 13.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="10" rx="1.5" />
      <path d="M3 11V3a1 1 0 011-1h8" />
    </svg>
  );
}

function ProfilePatternCard({ pattern }: { pattern: Pattern }) {
  const isPublic = pattern.is_public ?? false;

  return (
    <Link
      href="/editor"
      className="flex flex-col overflow-hidden rounded-2xl border border-brand/10 bg-white/90 shadow-sm transition-all duration-200 hover:border-brand/20 hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="group/thumb relative aspect-square w-full overflow-hidden bg-stone-50">
        {pattern.thumbnail ? (
          <img
            src={pattern.thumbnail}
            alt={`${pattern.name} preview`}
            className="h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="grid gap-px opacity-25"
              style={{ gridTemplateColumns: "repeat(6, 1fr)", width: 42, height: 42 }}
            >
              {Array.from({ length: 36 }, (_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[1px]"
                  style={{ background: (Math.floor(i / 6) + (i % 6)) % 3 === 0 ? "#1c1917" : "#e7e5e4" }}
                />
              ))}
            </div>
          </div>
        )}
        {/* Grid dimensions */}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/35 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
          {pattern.grid_width}×{pattern.grid_height}
        </span>
        {/* Hover overlay */}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/thumb:bg-black/10">
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover/thumb:opacity-100">
            Open
          </span>
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3">
        <p className="truncate text-sm font-semibold text-stone-900">{pattern.name}</p>

        {/* Public / Private pill */}
        <span
          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isPublic
              ? "bg-teal-50 text-teal-700"
              : "bg-stone-100 text-stone-500"
          }`}
        >
          {isPublic ? <GlobeIcon /> : <LockIcon />}
          {isPublic ? "Public" : "Private"}
        </span>

        {/* Like / copy counts — only meaningful for public patterns */}
        {isPublic && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <HeartIcon />
              {pattern.likes_count ?? 0}
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <CopyIcon />
              {pattern.copies_count ?? 0}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Pencil icon ──────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2.5l2.5 2.5-7 7H4v-2.5l7-7z" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  const [supabaseInit, setSupabaseInit] = useState<SupabaseInit>(() => ({ supabase: null, configError: null }));

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
  const [authChecked, setAuthChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Auth state — redirect to home if not logged in
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setAuthChecked(true);
      if (!u) router.replace("/");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      const u = s?.user ?? null;
      setUser(u);
      if (!u) router.replace("/");
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // Profile data
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;

    void fetchProfile(supabase, user.id).then(({ data }) => {
      if (!cancelled) setDisplayName(data?.display_name ?? null);
    });

    setPatternsLoading(true);
    void fetchPatternsForUser(supabase, user.id).then(({ data }) => {
      if (!cancelled) {
        setPatterns(data ?? []);
        setPatternsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [supabase, user]);

  // ── Inline display name edit ───────────────────────────────────────────────

  const [editingDn, setEditingDn] = useState(false);
  const [dnInput, setDnInput] = useState("");
  const [dnLocalError, setDnLocalError] = useState<string | null>(null);
  const [dnAvailability, setDnAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [dnSaving, setDnSaving] = useState(false);
  const dnDebounceRef = useRef<number | undefined>(undefined);
  const dnInputRef = useRef<HTMLInputElement>(null);

  const startEditDn = useCallback(() => {
    setDnInput(displayName ?? "");
    setDnLocalError(null);
    setDnAvailability("idle");
    setEditingDn(true);
    window.setTimeout(() => { dnInputRef.current?.select(); dnInputRef.current?.focus(); }, 0);
  }, [displayName]);

  const cancelEditDn = useCallback(() => {
    if (dnDebounceRef.current !== undefined) window.clearTimeout(dnDebounceRef.current);
    setEditingDn(false);
  }, []);

  const handleDnChange = useCallback(
    (value: string) => {
      setDnInput(value);
      const err = validateDisplayName(value);
      setDnLocalError(err);
      if (dnDebounceRef.current !== undefined) window.clearTimeout(dnDebounceRef.current);
      if (err || value.trim() === "") { setDnAvailability("idle"); return; }
      setDnAvailability("checking");
      dnDebounceRef.current = window.setTimeout(() => {
        if (!supabase || !user) return;
        void checkDisplayNameAvailable(supabase, value, user.id).then((ok) => {
          setDnAvailability(ok ? "available" : "taken");
        });
      }, 500) as unknown as number;
    },
    [supabase, user],
  );

  const commitDn = useCallback(async () => {
    if (dnLocalError || dnAvailability !== "available" || dnSaving || !supabase || !user) return;
    setDnSaving(true);
    const { error } = await upsertProfile(supabase, user.id, dnInput.trim());
    setDnSaving(false);
    if (!error) {
      setDisplayName(dnInput.trim());
      setEditingDn(false);
    }
  }, [supabase, user, dnInput, dnLocalError, dnAvailability, dnSaving]);

  const canSaveDn = !dnLocalError && dnAvailability === "available" && dnInput.trim() !== "" && !dnSaving;

  // ── Render ─────────────────────────────────────────────────────────────────

  // Show nothing while waiting for auth — avoids flash of content before redirect
  if (!authChecked) return null;
  if (!user) return null;

  const publicCount = patterns.filter((p) => p.is_public).length;

  return (
    <div className="min-h-screen text-stone-800">
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/40 bg-white/80 px-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-serif text-xl font-bold text-brand hover:text-brand-dark">
            Gridwork
          </Link>
          <Link href="/gallery" className="hidden text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700 md:inline">
            Gallery
          </Link>
          <Link href="/learn" className="hidden text-sm text-gray-700 transition-colors duration-150 hover:text-violet-700 md:inline">
            Learn
          </Link>
          <span className="hidden text-sm font-medium text-stone-700 md:inline">Profile</span>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/editor"
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50"
          >
            Editor
          </Link>
        </div>

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
              <Link href="/gallery" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-stone-50">Gallery</Link>
              <Link href="/learn" onClick={() => setMenuOpen(false)} className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50">Learn</Link>
              <Link href="/editor" onClick={() => setMenuOpen(false)} className="block border-t border-stone-100 px-4 py-3 text-sm text-gray-700 hover:bg-stone-50">Editor</Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {configError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{configError}</div>
        )}

        {/* Profile heading */}
        <div className="mb-8 border-b border-stone-100 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            {editingDn ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    ref={dnInputRef}
                    type="text"
                    value={dnInput}
                    onChange={(e) => handleDnChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSaveDn) void commitDn();
                      if (e.key === "Escape") cancelEditDn();
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        if (document.activeElement !== dnInputRef.current) cancelEditDn();
                      }, 150);
                    }}
                    maxLength={30}
                    placeholder="display_name"
                    className="rounded-xl border border-brand/30 bg-white px-3 py-1.5 font-serif text-2xl font-bold text-stone-900 shadow-sm outline-none focus:ring-1 focus:ring-brand/30"
                  />
                  <button
                    type="button"
                    onClick={() => void commitDn()}
                    disabled={!canSaveDn}
                    className="rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-40"
                  >
                    {dnSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditDn}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                </div>
                <div className="min-h-[16px] pl-1 text-xs">
                  {dnLocalError && dnInput !== "" && <span className="text-brand">{dnLocalError}</span>}
                  {!dnLocalError && dnAvailability === "checking" && <span className="text-stone-400">Checking…</span>}
                  {!dnLocalError && dnAvailability === "available" && <span className="text-teal-600">✓ available</span>}
                  {!dnLocalError && dnAvailability === "taken" && <span className="text-brand">✗ taken</span>}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEditDn}
                className="group flex items-center gap-2"
                title="Edit display name"
              >
                <h1 className="font-serif text-3xl font-bold text-stone-900 group-hover:text-stone-700">
                  {displayName ? `@${displayName}` : "Set a display name"}
                </h1>
                <span className="text-stone-400 opacity-0 transition-opacity group-hover:opacity-100">
                  <PencilIcon />
                </span>
              </button>
            )}

            {!editingDn && displayName && (
              <Link
                href={`/u/${displayName}`}
                className="text-sm font-medium text-accent hover:text-accent-dark hover:underline"
              >
                View public profile →
              </Link>
            )}
          </div>

          <p className="mt-1 text-xs text-stone-400">{user.email}</p>

          {!editingDn && (
            <p className="mt-2 text-sm text-stone-500">
              {patterns.length === 0
                ? "No patterns yet."
                : `${patterns.length} pattern${patterns.length === 1 ? "" : "s"} · ${publicCount} public`}
            </p>
          )}
        </div>

        {/* Pattern grid */}
        {patternsLoading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-stone-500">Loading patterns…</p>
          </div>
        ) : patterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm text-stone-400">No patterns yet.</p>
            <Link
              href="/editor"
              className="mt-4 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
            >
              Go to editor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {patterns.map((p) => (
              <ProfilePatternCard key={p.id} pattern={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
