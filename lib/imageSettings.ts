import type { Json } from "@/lib/patternHelpers";

export type StoredCropRect = { x: number; y: number; w: number; h: number };

export type PatternImageSettings = {
  mode: "none" | "underlay" | "convert";
  /** Compressed JPEG data URL of the working image (post-transforms). Null if no image. */
  imageDataUrl: string | null;
  underlayOpacityPct: number;
  threshold: number;
  darkIsFilled: boolean;
  cropRect: StoredCropRect | null;
  appliedCrop: StoredCropRect | null;
  panX: number;
  panY: number;
  positionLocked: boolean;
};

export const DEFAULT_PATTERN_IMAGE_SETTINGS: PatternImageSettings = {
  mode: "none",
  imageDataUrl: null,
  underlayOpacityPct: 65,
  threshold: 140,
  darkIsFilled: true,
  cropRect: null,
  appliedCrop: null,
  panX: 0,
  panY: 0,
  positionLocked: false,
};

/** Resize and JPEG-compress an image for storage. Max 1200px on the longest side. */
export async function compressImageToDataUrl(
  img: HTMLImageElement,
  maxDim = 1200,
  quality = 0.82,
): Promise<string> {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(sw, sh, 1));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;
  // Fill white before drawing — JPEG has no transparency channel and will otherwise
  // encode transparent pixels as black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load saved image"));
    img.src = dataUrl;
  });
}

function isCropRect(v: unknown): v is StoredCropRect {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.w === "number" &&
    typeof o.h === "number"
  );
}

export function parseImageSettings(data: Json | undefined): PatternImageSettings {
  const d = DEFAULT_PATTERN_IMAGE_SETTINGS;
  if (data == null || typeof data !== "object" || Array.isArray(data)) return { ...d };
  const o = data as Record<string, unknown>;
  return {
    mode: o.mode === "underlay" || o.mode === "convert" ? o.mode : "none",
    imageDataUrl: typeof o.imageDataUrl === "string" ? o.imageDataUrl : null,
    underlayOpacityPct:
      typeof o.underlayOpacityPct === "number" ? o.underlayOpacityPct : d.underlayOpacityPct,
    threshold: typeof o.threshold === "number" ? o.threshold : d.threshold,
    darkIsFilled: typeof o.darkIsFilled === "boolean" ? o.darkIsFilled : d.darkIsFilled,
    cropRect: isCropRect(o.cropRect) ? o.cropRect : null,
    appliedCrop: isCropRect(o.appliedCrop) ? o.appliedCrop : null,
    panX: typeof o.panX === "number" ? o.panX : 0,
    panY: typeof o.panY === "number" ? o.panY : 0,
    positionLocked: typeof o.positionLocked === "boolean" ? o.positionLocked : false,
  };
}

export function serializeImageSettings(s: PatternImageSettings): Json {
  return {
    mode: s.mode,
    imageDataUrl: s.imageDataUrl,
    underlayOpacityPct: s.underlayOpacityPct,
    threshold: s.threshold,
    darkIsFilled: s.darkIsFilled,
    cropRect: s.cropRect,
    appliedCrop: s.appliedCrop,
    panX: s.panX,
    panY: s.panY,
    positionLocked: s.positionLocked,
  } as Json;
}
