export const CRAFT_MODES = [
  "filet-dc",
  "filet-tr",
  "tapestry",
  "c2c",
  "mosaic",
] as const;

export type CraftMode = (typeof CRAFT_MODES)[number];

export const DEFAULT_CRAFT_MODE: CraftMode = "filet-dc";

export function parseCraftMode(v: unknown): CraftMode {
  if (typeof v === "string" && (CRAFT_MODES as readonly string[]).includes(v)) {
    return v as CraftMode;
  }
  return DEFAULT_CRAFT_MODE;
}

/** Open start: first dc in 6th. Filled start: first dc in 4th (chain is 2 shorter). */
export function filetDcChain(gridW: number, startFilled = false): number {
  return Math.max(0, gridW) * 2 + (startFilled ? 2 : 4);
}

/** Open start: first tr in 9th. Filled start: first tr in 5th (chain is 2 shorter). */
export function filetTrChain(gridW: number, startFilled = false): number {
  return Math.max(0, gridW) * 3 + (startFilled ? 4 : 6);
}

/** Foundation chain that yields `gridW` stitches (work into 2nd/3rd/4th/5th from hook). */
export function tapestryChain(gridW: number, stitch: "sc" | "hdc" | "dc" | "tr"): number {
  const extra = { sc: 1, hdc: 2, dc: 3, tr: 4 }[stitch];
  return Math.max(0, gridW) + extra;
}

export function tapestryFoundation(gridW: number): number {
  return tapestryChain(gridW, "sc");
}

export function c2cStartChain(stitch: "hdc" | "dc"): number {
  return stitch === "hdc" ? 5 : 6;
}

export type ChainReadout = {
  display: string;
  hint: string;
};

export function chainReadout(
  method: "filet" | "tapestry" | "c2c",
  stitch: "sc" | "hdc" | "dc" | "tr",
  gridW: number,
  startFilled = false,
): ChainReadout {
  if (method === "filet") {
    const start = startFilled ? "filled start" : "open start";
    if (stitch === "tr") {
      return {
        display: String(filetTrChain(gridW, startFilled)),
        hint: startFilled
          ? `tr, ch-2 · ${start} · 5th from hook`
          : `tr, ch-2 · ${start} · 9th from hook`,
      };
    }
    return {
      display: String(filetDcChain(gridW, startFilled)),
      hint: startFilled
        ? `dc, ch-1 · ${start} · 4th from hook`
        : `dc, ch-1 · ${start} · 6th from hook`,
    };
  }
  if (method === "c2c") {
    const n = stitch === "hdc" ? 5 : 6;
    return {
      display: `Ch ${n}`,
      hint: stitch === "hdc" ? "hdc · one block" : "dc · one block",
    };
  }
  const tapStitch = stitch;
  const fromHook = { sc: "2nd", hdc: "3rd", dc: "4th", tr: "5th" }[tapStitch];
  return {
    display: String(tapestryChain(gridW, tapStitch)),
    hint: `${tapStitch} · ${fromHook} from hook`,
  };
}
