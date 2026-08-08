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
  /** Scale of the image within the grid (0.5–4). 1 = default contain fit. */
  imageZoom: number;
  positionLocked: boolean;
};

export type PatternImageLayer = PatternImageSettings & {
  id: string;
  visible: boolean;
  /** Display name in the import list. */
  name: string;
};

export type PatternImageDocument = {
  images: PatternImageLayer[];
  activeImageId: string | null;
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
  imageZoom: 1,
  positionLocked: false,
};

export const DEFAULT_PATTERN_IMAGE_DOCUMENT: PatternImageDocument = {
  images: [],
  activeImageId: null,
};

export function defaultImageLayerName(index: number): string {
  return `Image ${index + 1}`;
}

export function createImageLayerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `img_${crypto.randomUUID()}`;
  }
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createImageLayer(partial?: Partial<PatternImageLayer>): PatternImageLayer {
  return {
    ...DEFAULT_PATTERN_IMAGE_SETTINGS,
    id: createImageLayerId(),
    visible: true,
    name: "Image",
    ...partial,
  };
}

export function documentHasImage(doc: PatternImageDocument): boolean {
  return doc.images.some((img) => Boolean(img.imageDataUrl));
}

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
  // Manila card stock — matches editor paper (JPEG has no alpha)
  ctx.fillStyle = "#F2EDD3";
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

function parseSettingsFields(o: Record<string, unknown>): PatternImageSettings {
  const d = DEFAULT_PATTERN_IMAGE_SETTINGS;
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
    imageZoom:
      typeof o.imageZoom === "number" && o.imageZoom > 0
        ? Math.min(4, Math.max(0.5, o.imageZoom))
        : d.imageZoom,
    positionLocked: typeof o.positionLocked === "boolean" ? o.positionLocked : false,
  };
}

function parseLayer(o: Record<string, unknown>, fallbackId: string, index: number): PatternImageLayer {
  const name =
    typeof o.name === "string" && o.name.trim()
      ? o.name.trim()
      : defaultImageLayerName(index);
  return {
    id: typeof o.id === "string" && o.id ? o.id : fallbackId,
    visible: o.visible !== false,
    name,
    ...parseSettingsFields(o),
  };
}

/** Parse multi-image document; migrates legacy single-image `image_settings` objects. */
export function parseImageDocument(data: Json | undefined): PatternImageDocument {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { images: [], activeImageId: null };
  }
  const o = data as Record<string, unknown>;

  if (Array.isArray(o.images)) {
    const images = o.images
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object" && !Array.isArray(item))
      .map((item, i) => parseLayer(item, `legacy_${i}`, i));
    const activeImageId =
      typeof o.activeImageId === "string" && images.some((img) => img.id === o.activeImageId)
        ? o.activeImageId
        : (images[0]?.id ?? null);
    return { images, activeImageId };
  }

  // Legacy single-object shape (mode / imageDataUrl at top level)
  const settings = parseSettingsFields(o);
  if (!settings.imageDataUrl && settings.mode === "none") {
    return { images: [], activeImageId: null };
  }
  const layer = createImageLayer({ ...settings, id: "legacy_0", name: defaultImageLayerName(0) });
  return { images: [layer], activeImageId: layer.id };
}

export function serializeImageDocument(
  doc: PatternImageDocument,
  extra?: Record<string, unknown>,
): Json {
  return {
    images: doc.images.map((img) => ({
      id: img.id,
      visible: img.visible,
      name: img.name,
      mode: img.mode,
      imageDataUrl: img.imageDataUrl,
      underlayOpacityPct: img.underlayOpacityPct,
      threshold: img.threshold,
      darkIsFilled: img.darkIsFilled,
      cropRect: img.cropRect,
      appliedCrop: img.appliedCrop,
      panX: img.panX,
      panY: img.panY,
      imageZoom: img.imageZoom,
      positionLocked: img.positionLocked,
    })),
    activeImageId: doc.activeImageId,
    ...extra,
  } as Json;
}
