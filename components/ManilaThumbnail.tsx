"use client";

import { manilaHex, type ManilaStockId } from "@/lib/manilaStock";
import { remanilaThumbnail } from "@/lib/thumbnailUtils";
import { useEffect, useState, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  /** Card stock — empty cells are remapped to this paper so the grid matches the frame. */
  stockId?: ManilaStockId | null;
};

/** Gallery/profile thumbs — remaps empty cells to the card's manila stock. */
export function ManilaThumbnail({ src, alt = "", stockId, style, ...rest }: Props) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const paper = manilaHex(stockId ?? "manila");

  useEffect(() => {
    let cancelled = false;
    setDisplaySrc(src);
    void remanilaThumbnail(src, paper).then((next) => {
      if (!cancelled) setDisplaySrc(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src, paper]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      style={{ imageRendering: "pixelated", background: "transparent", ...style }}
      {...rest}
    />
  );
}
