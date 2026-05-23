"use client";

import type { GalleryPattern } from "@/lib/galleryHelpers";
import Link from "next/link";

export type PatternGalleryCardProps = {
  pattern: GalleryPattern;
  isLiked: boolean;
  isOwn: boolean;
  onLike: () => void;
  onCopy: () => void;
  onPreview: () => void;
  copying: boolean;
  canInteract: boolean;
  makerDisplayName?: string | null;
  makerHref?: string;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5a3 3 0 015.5-1.65A3 3 0 0114.5 5.5C14.5 9.5 8 13.5 8 13.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="10" rx="1.5" />
      <path d="M3 11V3a1 1 0 011-1h8" />
    </svg>
  );
}

export function PatternGalleryCard({
  pattern,
  isLiked,
  isOwn,
  onLike,
  onCopy,
  onPreview,
  copying,
  canInteract,
  makerDisplayName,
  makerHref,
}: PatternGalleryCardProps) {
  const makerTag = makerDisplayName
    ? `@${makerDisplayName}`
    : `@${pattern.user_id.slice(0, 6).toLowerCase()}`;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[14px] transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: "#FBF7EF",
        boxShadow: "0 6px 20px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)",
      }}
    >
      {/* Thumbnail */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${pattern.name}`}
        className="group/thumb relative aspect-square w-full overflow-hidden bg-[#F4ECE0] focus:outline-none"
      >
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
        {/* Size chip */}
        <span className="absolute bottom-2 right-[22px] rounded-full bg-[rgba(31,20,16,0.70)] px-2 py-0.5 font-mono text-[10px] font-medium text-white">
          {pattern.grid_width}×{pattern.grid_height}
        </span>
        {isOwn && (
          <span className="absolute left-2 top-2 rounded-full bg-brand/85 px-2 py-0.5 font-mono text-[9px] font-bold text-white uppercase tracking-wide">
            Yours
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/thumb:bg-black/10">
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover/thumb:opacity-100">
            Preview
          </span>
        </span>
      </button>

      {/* Info */}
      <div className="p-3" style={{ paddingTop: 12 }}>
        <p className="truncate font-serif text-[15px] font-semibold leading-snug text-text-strong" style={{ letterSpacing: "-0.005em" }}>
          {pattern.name}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          {makerDisplayName ? (
            <Link
              href={makerHref ?? `/u/${makerDisplayName}`}
              className="truncate font-sans text-[12px] font-bold text-brand hover:text-brand-dark"
              onClick={(e) => e.stopPropagation()}
            >
              {makerTag}
            </Link>
          ) : (
            <span className="truncate font-sans text-[12px] font-bold text-brand">{makerTag}</span>
          )}

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onLike}
              disabled={!canInteract || isOwn}
              title={!canInteract ? "Log in to like" : isOwn ? "Can't like your own" : isLiked ? "Unlike" : "Like"}
              className={`inline-flex items-center gap-[3px] font-sans text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                isLiked ? "text-brand" : "text-muted hover:text-brand"
              }`}
            >
              <HeartIcon filled={isLiked} />
              {pattern.likes_count}
            </button>
            <button
              type="button"
              onClick={onCopy}
              disabled={!canInteract || copying}
              title={!canInteract ? "Log in to copy" : copying ? "Copying…" : "Copy"}
              className="inline-flex items-center gap-[3px] font-sans text-[12px] font-semibold text-muted transition-colors hover:text-text-strong disabled:opacity-50"
            >
              <CopyIcon />
              {copying ? "…" : pattern.copies_count}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
