"use client";

import { CopyGlyph, HeartGlyph } from "@/components/PatternGalleryCard";
import { ManilaThumbnail } from "@/components/ManilaThumbnail";
import { manilaHex, type ManilaStockId } from "@/lib/manilaStock";

type Props = {
  name: string;
  thumbnail?: string | null;
  gridWidth?: number;
  gridHeight?: number;
  /** Left status line (e.g. "Private · Edited 8/7/26"). */
  statusLabel?: string | null;
  likesCount?: number;
  copiesCount?: number;
  manilaStock?: ManilaStockId | null;
  active?: boolean;
  onClick: () => void;
};

/** Inline hopper manila card shared by private Maker and public /u profiles. */
export function MakerHopperCard({
  name,
  thumbnail,
  gridWidth,
  gridHeight,
  statusLabel = null,
  likesCount,
  copiesCount,
  manilaStock = "manila",
  active = false,
  onClick,
}: Props) {
  const paper = manilaHex(manilaStock ?? "manila");
  const sizeLine =
    gridWidth != null && gridHeight != null ? `${gridWidth}×${gridHeight}` : null;
  const showStats = typeof likesCount === "number" || typeof copiesCount === "number";

  return (
    <button
      type="button"
      data-active={active ? "true" : undefined}
      onClick={onClick}
      className="punch-card hopper-card flex flex-col text-left"
      style={{
        ["--manila-stock" as string]: paper,
        background: paper,
        clipPath: "polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)",
      }}
    >
      <div className="aspect-square w-full overflow-hidden p-2" style={{ background: paper }}>
        {thumbnail ? (
          <ManilaThumbnail src={thumbnail} alt="" stockId={manilaStock} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[10px] punch-print-faint">
            Empty
          </div>
        )}
      </div>
      <div className="px-2.5 py-2" style={{ background: paper }}>
        <p className="truncate font-mono text-[12px] font-bold tracking-[0.06em] uppercase punch-print-ink">
          {name}
        </p>
        {sizeLine ? (
          <p className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.06em] uppercase punch-print-faint">
            {sizeLine}
          </p>
        ) : null}
        {(statusLabel || showStats) && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {statusLabel ? (
              <span className="truncate punch-print-label">
                {statusLabel}
              </span>
            ) : (
              <span />
            )}
            {showStats ? (
              <div className="flex shrink-0 items-center gap-2 punch-print-faint">
                <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold">
                  <HeartGlyph filled={false} />
                  {likesCount ?? 0}
                </span>
                <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold">
                  <CopyGlyph />
                  {copiesCount ?? 0}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </button>
  );
}
