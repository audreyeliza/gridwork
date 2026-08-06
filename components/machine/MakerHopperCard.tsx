"use client";

import { ManilaThumbnail } from "@/components/ManilaThumbnail";
import { manilaHex, type ManilaStockId } from "@/lib/manilaStock";

type Props = {
  name: string;
  thumbnail?: string | null;
  gridWidth?: number;
  gridHeight?: number;
  /** Optional status line under the name (e.g. "Public · 40×40"). */
  meta?: string | null;
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
  meta,
  manilaStock = "manila",
  active = false,
  onClick,
}: Props) {
  const paper = manilaHex(manilaStock ?? "manila");
  const fallbackMeta =
    gridWidth != null && gridHeight != null ? `${gridWidth}×${gridHeight}` : null;
  const line = meta ?? fallbackMeta;

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
      <div
        className="border-t px-2 py-1.5"
        style={{
          borderColor: "color-mix(in srgb, var(--manila-stock) 92%, #8B3A2A 8%)",
          background: paper,
        }}
      >
        <p className="truncate font-mono text-[11px] font-bold uppercase punch-print-ink">{name}</p>
        {line ? (
          <p className="font-mono text-[9px] uppercase punch-print-faint">{line}</p>
        ) : null}
      </div>
    </button>
  );
}
