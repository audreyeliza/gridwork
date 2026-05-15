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
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    image.src = url;
  });
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
