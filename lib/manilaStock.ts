/** Classic IBM-style card stock colors for the editor grid surface.
 * Ordered for even rotary steps (light → cool → warm), muted paper tones.
 * id "manila" kept for storage; UI label is White.
 */
export const MANILA_STOCKS = [
  { id: "manila", label: "White", hex: "#E8E2D0" },
  { id: "yellow", label: "Yellow", hex: "#D4C478" },
  { id: "green", label: "Green", hex: "#8FB5A0" },
  { id: "blue", label: "Blue", hex: "#8AADC0" },
  { id: "brown", label: "Brown", hex: "#B89578" },
  { id: "red", label: "Red", hex: "#C47B6A" },
] as const;

export type ManilaStockId = (typeof MANILA_STOCKS)[number]["id"];

export const DEFAULT_MANILA_STOCK: ManilaStockId = "manila";
export const MANILA_STORAGE_KEY = "gridwork-manila-stock";

/** Older stock ids → current palette (patterns saved before the IBM color set). */
const LEGACY_STOCK_MAP: Record<string, ManilaStockId> = {
  buff: "yellow",
  salmon: "red",
  grey: "manila",
};

function resolveStockId(raw: string | null | undefined): ManilaStockId | null {
  if (!raw) return null;
  if (MANILA_STOCKS.some((s) => s.id === raw)) return raw as ManilaStockId;
  return LEGACY_STOCK_MAP[raw] ?? null;
}

export function manilaHex(id: ManilaStockId): string {
  return MANILA_STOCKS.find((s) => s.id === id)?.hex ?? MANILA_STOCKS[0].hex;
}

export function loadManilaStock(): ManilaStockId {
  if (typeof window === "undefined") return DEFAULT_MANILA_STOCK;
  try {
    const resolved = resolveStockId(localStorage.getItem(MANILA_STORAGE_KEY));
    if (resolved) return resolved;
  } catch {
    /* ignore */
  }
  return DEFAULT_MANILA_STOCK;
}

export function saveManilaStock(id: ManilaStockId) {
  try {
    localStorage.setItem(MANILA_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Read stock id from pattern image_settings JSON (no DB column required). */
export function parseManilaStockFromSettings(data: unknown): ManilaStockId {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return DEFAULT_MANILA_STOCK;
  }
  const v = (data as Record<string, unknown>).manila_stock;
  if (typeof v === "string") {
    return resolveStockId(v) ?? DEFAULT_MANILA_STOCK;
  }
  return DEFAULT_MANILA_STOCK;
}

export function withManilaStockInSettings(
  settings: Record<string, unknown>,
  stock: ManilaStockId,
): Record<string, unknown> {
  return { ...settings, manila_stock: stock };
}
