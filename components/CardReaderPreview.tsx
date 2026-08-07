"use client";

import { ManilaThumbnail } from "@/components/ManilaThumbnail";
import { manilaHex, type ManilaStockId } from "@/lib/manilaStock";
import { useEffect } from "react";

export type CardReaderPattern = {
  name: string;
  thumbnail?: string | null;
  grid_width: number;
  grid_height: number;
  likes_count?: number;
  copies_count?: number;
  manila_stock?: ManilaStockId | null;
};

type Props = {
  pattern: CardReaderPattern;
  makerLabel: string;
  onClose: () => void;
  onLike?: () => void;
  onCopy?: () => void;
  liked?: boolean;
  canLike?: boolean;
  canCopy?: boolean;
  copying?: boolean;
  /** When false, only Close is shown on steel (e.g. own profile open). */
  showActions?: boolean;
};

export function CardReaderPreview({
  pattern,
  makerLabel,
  onClose,
  onLike,
  onCopy,
  liked = false,
  canLike = false,
  canCopy = false,
  copying = false,
  showActions = true,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stock = pattern.manila_stock ?? "manila";
  const paper = manilaHex(stock);

  return (
    <div className="card-reader-scrim" onClick={onClose} role="presentation">
      <div className="card-reader" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={pattern.name}>
        <div className="card-reader-tray">
          <article
            className="punch-card relative mx-auto flex w-full max-w-lg flex-col overflow-hidden"
            style={{ ["--manila-stock" as string]: paper, background: paper }}
          >
            <div className="flex max-h-[50vh] items-center justify-center overflow-hidden px-4 pt-5 pb-3" style={{ background: paper }}>
              {pattern.thumbnail ? (
                <ManilaThumbnail
                  src={pattern.thumbnail}
                  alt={`${pattern.name} preview`}
                  stockId={stock}
                  className="max-h-[50vh] max-w-full object-contain"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center font-mono text-xs punch-print-faint">
                  No preview
                </div>
              )}
            </div>
            <div className="border-t px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--manila-stock) 92%, #8B3A2A 8%)", background: paper }}>
              <p className="truncate font-mono text-[15px] font-bold tracking-[0.06em] uppercase punch-print-ink">
                {pattern.name}
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold tracking-[0.08em] uppercase punch-print-faint">
                {makerLabel} · {pattern.grid_width}×{pattern.grid_height}
                {typeof pattern.likes_count === "number" && (
                  <> · LIKE {pattern.likes_count}</>
                )}
                {typeof pattern.copies_count === "number" && (
                  <> · COPY {pattern.copies_count}</>
                )}
              </p>
            </div>
          </article>
        </div>

        <div className="card-reader-controls">
          {showActions && onLike && (
            <button
              type="button"
              onClick={onLike}
              disabled={!canLike}
              className={`punch-lamp ${liked ? "punch-lamp-green" : "punch-lamp-clear"} !min-h-[40px] text-[11px]`}
              title={!canLike ? "Log in to like" : liked ? "Unlike" : "Like"}
            >
              {liked ? "Liked" : "Like"}
              {typeof pattern.likes_count === "number" ? ` · ${pattern.likes_count}` : ""}
            </button>
          )}
          {showActions && onCopy && (
            <button
              type="button"
              onClick={onCopy}
              disabled={!canCopy || copying}
              className="punch-lamp punch-lamp-green !min-h-[40px] text-[11px]"
              title={!canCopy ? "Log in to copy" : "Copy"}
            >
              {copying ? "Copying…" : "Copy"}
            </button>
          )}
          <button type="button" onClick={onClose} className="punch-key punch-key-blue !min-h-[40px] text-[11px]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
