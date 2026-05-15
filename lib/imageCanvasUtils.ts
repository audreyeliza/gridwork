/** Draw image scaled with CSS-like `object-fit: contain` into the destination rect. */
export function getCanvasImageSize(img: CanvasImageSource): { w: number; h: number } {
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
    return { w: img.width, h: img.height };
  }
  if (img instanceof HTMLCanvasElement) {
    return { w: img.width, h: img.height };
  }
  const im = img as HTMLImageElement;
  return { w: im.naturalWidth || im.width || 0, h: im.naturalHeight || im.height || 0 };
}

export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
): void {
  const { w: iw, h: ih } = getCanvasImageSize(img);
  if (iw <= 0 || ih <= 0) return;

  const ir = iw / ih;
  const dr = dWidth / dHeight;
  let dw = dWidth;
  let dh = dHeight;
  let ox = dx;
  let oy = dy;
  if (ir > dr) {
    dw = dWidth;
    dh = dw / ir;
    oy = dy + (dHeight - dh) / 2;
  } else {
    dh = dHeight;
    dw = dh * ir;
    ox = dx + (dWidth - dw) / 2;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, ox, oy, dw, dh);
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const finish = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      const decode = image.decode?.();
      if (decode && typeof (decode as Promise<void>).then === "function") {
        void (decode as Promise<void>).then(finish).catch(finish);
      } else {
        finish();
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    image.src = url;
  });
}

/**
 * Otsu's method: find the threshold that maximises between-class variance.
 * Samples the image at ≤256 px on each side for speed.
 */
export function otsuThreshold(img: HTMLImageElement): number {
  const maxDim = 256;
  const ar = img.naturalWidth / img.naturalHeight;
  const sw = ar >= 1 ? maxDim : Math.max(1, Math.round(maxDim * ar));
  const sh = ar >= 1 ? Math.max(1, Math.round(maxDim / ar)) : maxDim;
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 128;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(img, 0, 0, sw, sh);

  const { data } = ctx.getImageData(0, 0, sw, sh);
  const hist = new Uint32Array(256);
  const n = sw * sh;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0));
    hist[Math.min(255, gray)]++;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = (wB / n) * (wF / n) * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Rasterize image into a WxH boolean grid using grayscale + threshold (Canvas only).
 * Dark pixels below threshold become filled (line art on light background).
 */
export function imageToThresholdGrid(
  img: CanvasImageSource,
  gridWidth: number,
  gridHeight: number,
  threshold: number,
  darkIsFilled = true,
): boolean[][] {
  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Array.from({ length: gridHeight }, () => Array.from({ length: gridWidth }, () => false));
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, gridWidth, gridHeight);
  drawImageContain(ctx, img, 0, 0, gridWidth, gridHeight);

  const { data } = ctx.getImageData(0, 0, gridWidth, gridHeight);
  const grid: boolean[][] = [];
  const t = Math.min(255, Math.max(0, threshold));

  for (let r = 0; r < gridHeight; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < gridWidth; c++) {
      const i = (r * gridWidth + c) * 4;
      const R = data[i] ?? 0;
      const G = data[i + 1] ?? 0;
      const B = data[i + 2] ?? 0;
      const gray = 0.299 * R + 0.587 * G + 0.114 * B;
      const filled = darkIsFilled ? gray < t : gray >= t;
      row.push(filled);
    }
    grid.push(row);
  }
  return grid;
}
