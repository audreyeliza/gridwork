"use client";

import type { GalleryPattern } from "@/lib/galleryHelpers";

export type PatternGalleryCardProps = {
  pattern: GalleryPattern;
  isLiked: boolean;
  isOwn: boolean;
  onLike: () => void;
  onCopy: () => void;
  onPreview: () => void;
  copying: boolean;
  canInteract: boolean;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5a3 3 0 015.5-1.65A3 3 0 0114.5 5.5C14.5 9.5 8 13.5 8 13.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
}: PatternGalleryCardProps) {
  const makerTag = `Maker ${pattern.user_id.slice(0, 6).toUpperCase()}`;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-brand/10 bg-white/90 shadow-sm transition-all duration-200 hover:border-brand/20 hover:shadow-md">
      {/* Thumbnail — click to preview */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${pattern.name}`}
        className="group/thumb relative aspect-square w-full overflow-hidden bg-stone-50 focus:outline-none"
      >
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
                  style={{
                    background:
                      (Math.floor(i / 6) + (i % 6)) % 3 === 0 ? "#1c1917" : "#e7e5e4",
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/35 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
          {pattern.grid_width}×{pattern.grid_height}
        </span>
        {isOwn && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-brand/85 px-2 py-0.5 text-xs font-medium text-white">
            Yours
          </span>
        )}
        {/* Hover overlay */}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/thumb:bg-black/15">
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover/thumb:opacity-100">
            Preview
          </span>
        </span>
      </button>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <p className="truncate text-sm font-semibold text-stone-900">{pattern.name}</p>
        <p className="text-xs text-stone-400">{makerTag}</p>

        <div className="mt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onLike}
            disabled={!canInteract || isOwn}
            title={
              !canInteract
                ? "Log in to like"
                : isOwn
                  ? "Can't like your own pattern"
                  : isLiked
                    ? "Unlike"
                    : "Like"
            }
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isLiked
                ? "bg-rose-50 text-rose-600 hover:enabled:bg-rose-100"
                : "bg-stone-100 text-stone-500 hover:enabled:bg-stone-200"
            }`}
          >
            <HeartIcon filled={isLiked} />
            <span>{pattern.likes_count}</span>
          </button>

          <button
            type="button"
            onClick={onCopy}
            disabled={!canInteract || copying}
            title={
              !canInteract ? "Log in to copy" : copying ? "Copying…" : "Copy to your patterns"
            }
            className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500 transition-colors hover:enabled:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CopyIcon />
            <span>{copying ? "…" : pattern.copies_count}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
