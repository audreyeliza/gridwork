"use client";

import {
  checkDisplayNameAvailable,
  fetchProfile,
  fetchProfilesByUserIds,
  upsertProfile,
  upsertProfileAvatar,
} from "@/lib/profileHelpers";
import { fetchPatternsForUser, type Pattern } from "@/lib/patternHelpers";
import { copyPublicPattern, fetchUserLikedPatterns, type GalleryPattern } from "@/lib/galleryHelpers";
import { CrochetMark } from "@/components/CrochetMark";
import { NavUserSection } from "@/components/NavUserSection";
import { PatternGalleryCard } from "@/components/PatternGalleryCard";
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
      className="flex flex-col overflow-hidden rounded-[14px] transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: "#FBF7EF",
        boxShadow: "0 6px 20px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)",
      }}
    >
      {/* Thumbnail */}
      <div className="group/thumb relative aspect-square w-full overflow-hidden bg-[#F4ECE0]">
        {pattern.thumbnail ? (
          <img
            src={pattern.thumbnail}
            alt={`${pattern.name} preview`}
            className="h-full w-full object-contain"
            style={{ imageRendering: "pixelated", display: "block" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="grid gap-px opacity-30"
              style={{ gridTemplateColumns: "repeat(6, 1fr)", width: 42, height: 42 }}
            >
              {Array.from({ length: 36 }, (_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[1px]"
                  style={{ background: (Math.floor(i / 6) + (i % 6)) % 3 === 0 ? "#1F1410" : "#D4C9BC" }}
                />
              ))}
            </div>
          </div>
        )}
        <span className="absolute bottom-2 right-2 rounded-full bg-[rgba(31,20,16,0.70)] px-2 py-0.5 font-mono text-[10px] font-medium text-white">
          {pattern.grid_width}×{pattern.grid_height}
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/thumb:bg-black/10">
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover/thumb:opacity-100">
            Open
          </span>
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-[10px_13px_13px]">
        <p className="truncate font-serif text-[15px] font-semibold leading-snug text-text-strong">{pattern.name}</p>

        <div className="flex items-center gap-1.5">
          {/* Public / Private pill */}
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.02em] ${
              isPublic
                ? "text-pill-text"
                : "text-muted"
            }`}
            style={{
              background: isPublic ? "rgba(184,90,53,0.10)" : "rgba(122,106,95,0.10)",
            }}
          >
            {isPublic ? <GlobeIcon /> : <LockIcon />}
            {isPublic ? "Public" : "Private"}
          </span>
        </div>

        {isPublic && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-sans text-xs font-semibold text-muted">
              <HeartIcon />{pattern.likes_count ?? 0}
            </span>
            <span className="flex items-center gap-1 font-sans text-xs font-semibold text-muted">
              <CopyIcon />{pattern.copies_count ?? 0}
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

// ─── Avatar crop modal ────────────────────────────────────────────────────────

function AvatarCropModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setImgEl(null); setZoom(1); setOffset({ x: 0, y: 0 }); }
  }, [open]);

  useEffect(() => {
    if (!imgEl) return;
    const SIZE = 240;
    const base = SIZE / Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
    const s = base * zoom;
    const maxX = Math.max(0, (imgEl.naturalWidth * s - SIZE) / 2);
    const maxY = Math.max(0, (imgEl.naturalHeight * s - SIZE) / 2);
    setOffset((p) => ({
      x: Math.max(-maxX, Math.min(maxX, p.x)),
      y: Math.max(-maxY, Math.min(maxY, p.y)),
    }));
  }, [zoom, imgEl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const SIZE = 240;
    const base = SIZE / Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
    const s = base * zoom;
    const w = imgEl.naturalWidth * s;
    const h = imgEl.naturalHeight * s;
    const maxX = Math.max(0, (w - SIZE) / 2);
    const maxY = Math.max(0, (h - SIZE) / 2);
    const cx = Math.max(-maxX, Math.min(maxX, offset.x));
    const cy = Math.max(-maxY, Math.min(maxY, offset.y));
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imgEl, SIZE / 2 - w / 2 + cx, SIZE / 2 - h / 2 + cy, w, h);
    ctx.restore();
  }, [imgEl, zoom, offset]);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImgEl(img); setZoom(1); setOffset({ x: 0, y: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging || !dragStart.current || !imgEl) return;
      const SIZE = 240;
      const base = SIZE / Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
      const s = base * zoom;
      const maxX = Math.max(0, (imgEl.naturalWidth * s - SIZE) / 2);
      const maxY = Math.max(0, (imgEl.naturalHeight * s - SIZE) / 2);
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setOffset({
        x: Math.max(-maxX, Math.min(maxX, dragStart.current.ox + dx)),
        y: Math.max(-maxY, Math.min(maxY, dragStart.current.oy + dy)),
      });
    },
    [dragging, imgEl, zoom],
  );

  const handleSave = () => {
    if (!imgEl) return;
    const SAVE = 128, PREV = 240;
    const base = PREV / Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
    const s = base * zoom * (SAVE / PREV);
    const w = imgEl.naturalWidth * s;
    const h = imgEl.naturalHeight * s;
    const maxX = Math.max(0, (w - SAVE) / 2);
    const maxY = Math.max(0, (h - SAVE) / 2);
    const cx = Math.max(-maxX, Math.min(maxX, offset.x * (SAVE / PREV)));
    const cy = Math.max(-maxY, Math.min(maxY, offset.y * (SAVE / PREV)));
    const c = document.createElement("canvas");
    c.width = SAVE; c.height = SAVE;
    const ctx = c.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(SAVE / 2, SAVE / 2, SAVE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imgEl, SAVE / 2 - w / 2 + cx, SAVE / 2 - h / 2 + cy, w, h);
    onSave(c.toDataURL("image/jpeg", 0.85));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-xs rounded-[22px] p-6"
        style={{ background: "#FBF7EF", boxShadow: "0 20px 60px rgba(40,20,30,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:text-text-strong"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <p className="mb-4 font-serif text-xl font-bold text-text-strong">Profile photo</p>

        {!imgEl ? (
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10"
            style={{ borderColor: "rgba(168,70,111,0.25)" }}
            onClick={() => fileRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-muted">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="font-sans text-sm font-semibold text-muted">Upload a photo</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <canvas
              ref={canvasRef}
              width={240}
              height={240}
              className="rounded-full"
              style={{ cursor: dragging ? "grabbing" : "grab", border: "3px solid rgba(168,70,111,0.35)" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
            />
            <div className="flex w-full items-center gap-3">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-muted">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
              </svg>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-brand"
              />
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Choose a different photo
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {imgEl && (
          <button
            type="button"
            onClick={handleSave}
            className="mt-4 w-full rounded-full bg-brand py-2.5 font-sans text-sm font-bold text-[#FBF7EF] hover:bg-brand-dark"
            style={{ boxShadow: "0 4px 18px rgba(168,70,111,0.30)" }}
          >
            Save photo
          </button>
        )}
      </div>
    </div>
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;

    void fetchProfile(supabase, user.id).then(({ data }) => {
      if (!cancelled) {
        setDisplayName(data?.display_name ?? null);
        setAvatarUrl(data?.avatar_url ?? null);
      }
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

  // ── Liked patterns tab ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"patterns" | "liked">("patterns");
  const [likedPatterns, setLikedPatterns] = useState<GalleryPattern[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [likedDisplayNames, setLikedDisplayNames] = useState<Map<string, string>>(new Map());
  const [likedPreviewId, setLikedPreviewId] = useState<string | null>(null);
  const likedPreviewPattern = likedPreviewId ? (likedPatterns.find((p) => p.id === likedPreviewId) ?? null) : null;

  useEffect(() => {
    if (!likedPreviewId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLikedPreviewId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [likedPreviewId]);

  useEffect(() => {
    if (!supabase || !user || activeTab !== "liked") return;
    let cancelled = false;
    setLikedLoading(true);
    void (async () => {
      const { data } = await fetchUserLikedPatterns(supabase, user.id);
      if (cancelled) return;
      const patterns = data ?? [];
      setLikedPatterns(patterns);
      setLikedLoading(false);
      const uniqueIds = [...new Set(patterns.map((p) => p.user_id))];
      const names = await fetchProfilesByUserIds(supabase, uniqueIds);
      if (!cancelled) setLikedDisplayNames(names);
    })();
    return () => { cancelled = true; };
  }, [supabase, user, activeTab]);

  const handleCopy = useCallback(
    async (patternId: string) => {
      if (!user || !supabase) return;
      setCopying(patternId);
      const { newPatternId, error } = await copyPublicPattern(supabase, patternId);
      setCopying(null);
      if (error || !newPatternId) { console.error(error ?? "No pattern ID returned"); return; }
      setLikedPatterns((prev) =>
        prev.map((p) => p.id === patternId ? { ...p, copies_count: p.copies_count + 1 } : p),
      );
      router.push("/editor");
    },
    [user, supabase, router],
  );

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

  const handleSaveAvatar = useCallback(async (dataUrl: string) => {
    if (!supabase || !user) return;
    const { error } = await upsertProfileAvatar(supabase, user.id, dataUrl);
    if (!error) {
      setAvatarUrl(dataUrl);
      setAvatarModalOpen(false);
    }
  }, [supabase, user]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Show nothing while waiting for auth — avoids flash of content before redirect
  if (!authChecked) return null;
  if (!user) return null;

  const publicCount = patterns.filter((p) => p.is_public).length;

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
            <Link href="/gallery" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Gallery</Link>
            <Link href="/editor" className="relative inline-flex items-center pl-[13px] text-sm font-bold text-white/70 transition-colors hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]"><span className="absolute left-0 top-1/2 -translate-y-1/2 size-[6px] rounded-full opacity-0" />Editor</Link>
          </nav>
        </div>
        <NavUserSection activePage="profile" />
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-0">
        {configError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{configError}</div>
        )}

        {/* Journal-style header card */}
        <div
          className="mb-7 rounded-none px-5 py-8 md:rounded-[22px] md:px-12 md:py-10"
          style={{
            background: "#FBF7EF",
            boxShadow: "0 10px 36px rgba(40,20,30,0.12), 0 0 0 1px rgba(255,255,255,0.5)",
          }}
        >
          {/* Top row: avatar + name + edit + view public */}
          <div className="mb-4 flex items-center gap-6">
            {/* Clickable avatar */}
            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              className="group/avatar relative inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full p-0 font-serif text-[42px] font-bold leading-none text-white"
              style={{
                width: 92, height: 92,
                border: "4px solid #fff",
                boxShadow: "0 6px 20px rgba(168,70,111,0.25)",
                background: avatarUrl ? undefined : "linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)",
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                (displayName ?? user.email ?? "?").charAt(0).toUpperCase()
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover/avatar:bg-black/35">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 transition-opacity group-hover/avatar:opacity-100" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted" style={{ marginBottom: 4 }}>
                Maker profile
              </div>

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
                      className="rounded-xl border border-brand/30 bg-white px-3 py-1.5 font-serif text-2xl font-bold text-text-strong shadow-sm outline-none focus:ring-1 focus:ring-brand/30"
                    />
                    <button type="button" onClick={() => void commitDn()} disabled={!canSaveDn} className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-[#FBF7EF] shadow-sm hover:bg-brand-dark disabled:opacity-40">
                      {dnSaving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={cancelEditDn} className="rounded-full border border-[rgba(61,42,30,0.10)] bg-transparent px-3 py-1.5 text-xs font-semibold text-muted hover:bg-[rgba(61,42,30,0.05)]">
                      Cancel
                    </button>
                  </div>
                  <div className="min-h-[16px] pl-1 text-xs">
                    {dnLocalError && dnInput !== "" && <span className="text-brand">{dnLocalError}</span>}
                    {!dnLocalError && dnAvailability === "checking" && <span className="text-muted">Checking…</span>}
                    {!dnLocalError && dnAvailability === "available" && <span className="text-green-700">✓ available</span>}
                    {!dnLocalError && dnAvailability === "taken" && <span className="text-brand">✗ taken</span>}
                  </div>
                </div>
              ) : (
                <div className="group/dnname inline-flex max-w-full items-center gap-2 font-serif text-[28px] font-bold leading-none tracking-[-0.02em] text-text-strong md:text-[40px]">
                  {displayName ? `@${displayName}` : "Set a display name"}
                  <button
                    type="button"
                    onClick={startEditDn}
                    title="Edit display name"
                    className="mb-[-3px] inline-flex items-center justify-center rounded-full p-1.5 text-muted opacity-0 transition-opacity group-hover/dnname:opacity-100 hover:text-brand"
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
              <p className="mt-1 font-sans text-sm font-medium text-muted">{user.email}</p>
              {!editingDn && displayName && (
                <Link href={`/u/${displayName}`} className="mt-1.5 inline-flex items-center gap-1 font-sans text-[13px] font-bold text-brand hover:text-brand-dark">
                  View public profile
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6"/>
                  </svg>
                </Link>
              )}
            </div>


          </div>

          {/* Stats strip */}
          <div
            className="mt-1 grid grid-cols-2 gap-4 border-t pt-5 md:grid-cols-4 md:gap-0"
            style={{ borderColor: "rgba(61,42,30,0.10)" }}
          >
            {[
              { v: String(patterns.length), l: "patterns" },
              { v: String(publicCount), l: "public" },
              { v: String(patterns.reduce((acc, p) => acc + (p.likes_count ?? 0), 0)), l: "likes received" },
              { v: String(patterns.reduce((acc, p) => acc + (p.copies_count ?? 0), 0)), l: "copies" },
            ].map((s, i) => (
              <div key={s.l} className={`${i > 0 && i % 2 !== 0 ? "border-l pl-4 md:pl-6" : ""} ${i >= 2 ? "border-t md:border-t-0 pt-2 md:pt-0" : ""} ${i > 0 && i % 2 === 0 ? "md:border-l md:pl-6" : ""}`} style={{ borderColor: "rgba(61,42,30,0.10)" }}>
                <div className="font-serif text-[24px] font-bold leading-none tracking-[-0.015em] text-text-strong md:text-[32px]">{s.v}</div>
                <div className="mt-1 font-sans text-[12px] font-semibold tracking-[0.02em] text-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs + New pattern button */}
        <div className="mb-4 flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-between">
          <div
            className="inline-flex items-center overflow-x-auto rounded-full p-[3px]"
            style={{ background: "rgba(0,0,0,0.20)" }}
          >
            {(["patterns", "liked"] as const).map((tab) => {
              const label = tab === "patterns"
                ? `My patterns · ${patterns.length}`
                : `Liked · ${likedPatterns.length}`;
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-full px-3 py-[5px] font-sans text-[12px] font-bold transition-all duration-150 md:px-4 md:py-[7px] md:text-[13px] ${
                    isActive ? "bg-white text-[#1F1410] shadow-sm" : "text-white/75 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Link
            href="/editor"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-[18px] py-2.5 font-sans text-[13px] font-bold text-[#FBF7EF] hover:bg-brand-dark"
            style={{ boxShadow: "0 4px 18px rgba(168,70,111,0.30)" }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New pattern
          </Link>
        </div>

        {/* Pattern grid — My patterns tab */}
        {activeTab === "patterns" && (
          patternsLoading ? (
            <div className="flex items-center justify-center py-24">
              <p className="font-sans text-sm font-medium text-white/70">Loading patterns…</p>
            </div>
          ) : patterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="font-sans text-sm font-medium text-white/70">No patterns yet.</p>
              <Link href="/editor" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 font-sans text-sm font-bold text-[#FBF7EF] hover:bg-brand-dark">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New pattern
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {patterns.map((p) => (
                <ProfilePatternCard key={p.id} pattern={p} />
              ))}
            </div>
          )
        )}

        {/* Liked patterns tab */}
        {activeTab === "liked" && (
          likedLoading ? (
            <div className="flex items-center justify-center py-24">
              <p className="font-sans text-sm font-medium text-white/70">Loading liked patterns…</p>
            </div>
          ) : likedPatterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="font-sans text-sm font-medium text-white/70">No liked patterns yet.</p>
              <Link href="/gallery" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-5 py-2 font-sans text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25">
                Browse the gallery
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {likedPatterns.map((p) => (
                <PatternGalleryCard
                  key={p.id}
                  pattern={p}
                  isLiked={true}
                  isOwn={p.user_id === user.id}
                  onLike={() => {}}
                  onCopy={() => void handleCopy(p.id)}
                  onPreview={() => setLikedPreviewId(p.id)}
                  copying={copying === p.id}
                  canInteract={Boolean(user)}
                  makerDisplayName={likedDisplayNames.get(p.user_id) ?? null}
                />
              ))}
            </div>
          )
        )}
      </main>

      <AvatarCropModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        onSave={(dataUrl) => void handleSaveAvatar(dataUrl)}
      />

      {likedPreviewPattern && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setLikedPreviewId(null)}
        >
          <div
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLikedPreviewId(null)}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
              aria-label="Close preview"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
            <div className="flex max-h-[55vh] items-center justify-center overflow-hidden bg-stone-50">
              {likedPreviewPattern.thumbnail ? (
                <img
                  src={likedPreviewPattern.thumbnail}
                  alt={`${likedPreviewPattern.name} preview`}
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
              <p className="truncate text-base font-semibold text-stone-900">{likedPreviewPattern.name}</p>
              <p className="mt-0.5 text-sm text-stone-400">
                {likedDisplayNames.get(likedPreviewPattern.user_id)
                  ? `@${likedDisplayNames.get(likedPreviewPattern.user_id)}`
                  : `@${likedPreviewPattern.user_id.slice(0, 6).toLowerCase()}`} · {likedPreviewPattern.grid_width}×{likedPreviewPattern.grid_height}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
