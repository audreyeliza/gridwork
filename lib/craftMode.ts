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

export function filetDcChain(gridW: number): number {
  return Math.max(0, gridW) * 2 + 4;
}

/** US tr, ch-2 mesh: turning 4 + space 2 + skip 2 + stitch chain. First tr in 9th. */
export function filetTrChain(gridW: number): number {
  return Math.max(0, gridW) * 3 + 6;
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
): ChainReadout {
  if (method === "filet") {
    if (stitch === "tr") {
      return {
        display: String(filetTrChain(gridW)),
        hint: "tr, ch-2 · 9th from hook",
      };
    }
    return {
      display: String(filetDcChain(gridW)),
      hint: "dc, ch-1 · 6th from hook",
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
