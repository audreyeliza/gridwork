"use client";

import type { GalleryPattern } from "@/lib/galleryHelpers";
import { ManilaThumbnail } from "@/components/ManilaThumbnail";
import { manilaHex, type ManilaStockId } from "@/lib/manilaStock";
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
  hopper?: boolean;
  active?: boolean;
  /** Printed status line instead of like/copy (e.g. PUBLIC / PRIVATE). */
  statusLabel?: string | null;
};

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5a3 3 0 015.5-1.65A3 3 0 0114.5 5.5C14.5 9.5 8 13.5 8 13.5z" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  hopper = true,
  active = false,
  statusLabel = null,
}: PatternGalleryCardProps) {
  const makerTag = makerDisplayName
    ? `@${makerDisplayName}`
    : `@${pattern.user_id.slice(0, 6).toLowerCase()}`;

  const stock = (pattern.manila_stock ?? "manila") as ManilaStockId;
  const paper = manilaHex(stock);

  return (
    <div
      className={`punch-card relative flex flex-col ${hopper ? "hopper-card" : ""}`}
      data-active={active ? "true" : undefined}
      tabIndex={0}
      style={{
        ["--manila-stock" as string]: paper,
        background: paper,
        clipPath: "polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)",
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview();
        }
      }}
    >
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${pattern.name}`}
        className="relative aspect-square w-full overflow-hidden focus:outline-none"
        style={{ background: paper }}
      >
        {pattern.thumbnail ? (
          <ManilaThumbnail
            src={pattern.thumbnail}
            alt={`${pattern.name} preview`}
            stockId={stock}
            className="h-full w-full object-contain p-2"
            style={{ display: "block" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: paper }}>
            <div
              className="grid gap-px opacity-40"
              style={{ gridTemplateColumns: "repeat(6, 1fr)", width: 42, height: 42 }}
            >
              {Array.from({ length: 36 }, (_, i) => (
                <div
                  key={i}
                  className="aspect-square"
                  style={{
                    background: (Math.floor(i / 6) + (i % 6)) % 3 === 0 ? "#2C2C2C" : "color-mix(in srgb, var(--manila-stock) 80%, #8B3A2A 20%)",
                    borderRadius: 1,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <span className="absolute bottom-2 right-2 font-mono text-[9px] font-bold tracking-[0.08em] punch-print-ink">
          {pattern.grid_width}×{pattern.grid_height}
        </span>
      </button>

      <div
        className="px-2.5 py-2"
        style={{
          background: paper,
        }}
      >
        <p className="truncate font-mono text-[12px] font-bold tracking-[0.06em] uppercase punch-print-ink">
          {pattern.name}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {statusLabel ? (
            <span className="truncate font-mono text-[10px] font-bold tracking-[0.08em] uppercase punch-print-faint">
              {statusLabel}
            </span>
          ) : makerDisplayName ? (
            <Link
              href={makerHref ?? `/u/${makerDisplayName}`}
              className="punch-print truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {makerTag}
            </Link>
          ) : (
            <span className="truncate font-mono text-[10px] font-bold tracking-[0.06em] uppercase punch-print-faint">
              {makerTag}
            </span>
          )}

          {!statusLabel && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onLike}
                disabled={!canInteract || isOwn}
                title={!canInteract ? "Log in to like" : isOwn ? "Can't like your own" : isLiked ? "Unlike" : "Like"}
                className="punch-print"
                aria-label={isLiked ? "Unlike" : "Like"}
              >
                <HeartGlyph filled={isLiked} />
                <span>{pattern.likes_count}</span>
              </button>
              <button
                type="button"
                onClick={onCopy}
                disabled={!canInteract || copying}
                title={!canInteract ? "Log in to copy" : copying ? "Copying…" : "Copy"}
                className="punch-print"
                aria-label="Copy"
              >
                <CopyGlyph />
                <span>{copying ? "…" : pattern.copies_count}</span>
              </button>
            </div>
          )}
          {statusLabel && typeof pattern.likes_count === "number" && (
            <div className="flex shrink-0 items-center gap-2 punch-print-faint">
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold">
                <HeartGlyph filled={false} />
                {pattern.likes_count}
              </span>
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold">
                <CopyGlyph />
                {pattern.copies_count ?? 0}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
