export const PRIMER_SECTIONS = [
  {
    id: "needs",
    title: "What you'll need",
    body: "Smooth cotton yarn, a matching hook, scissors, and a tapestry needle for ends. Filet is a great first project.",
  },
  {
    id: "slip",
    title: "Slip knot",
    body: "Loop the yarn, pull the tail through, and place the knot on your hook. Pull both ends until it sits on the hook, still loose enough to slide.",
  },
  {
    id: "how-chain",
    title: "How to chain",
    body: "Yarn over and pull through the loop on the hook. That is one chain. Repeat until you have the count from Yarn’s Chain line.",
  },
  {
    id: "how-many",
    title: "How many to chain",
    body: "Dc, chain 1: squares × 2 + 4 if the first square is open (first dc in the 6th from the hook); × 2 + 2 if filled (4th from the hook). Tr, chain 2: squares × 3 + 6 open (9th from the hook); × 3 + 4 filled (5th from the hook). Yarn’s Chain line follows the bottom-right square. Tr, chain 2 is the author’s favorite.",
  },
  {
    id: "dc",
    title: "Double crochet (dc)",
    body: "Yarn over → insert → yarn over, pull up (3 loops) → pull through 2 → pull through 2.",
  },
  {
    id: "tr",
    title: "Treble crochet (tr)",
    body: "Yarn over twice → insert → yarn over, pull up (4 loops) → pull through 2 three times.",
  },
  {
    id: "mesh",
    title: "Open mesh square (empty cell)",
    body: "Dc, chain 1, skip 1, dc. That gap is one open square. For tr, chain 2: skip 2 and chain 2.",
  },
  {
    id: "block",
    title: "Filled block square (filled cell)",
    body: "Three dc in a row (into the post, the chain space, then the next post) fill the square solid. For tr, chain 2: four trebles in the same span. Adjacent filled squares share a post, so one filled block is four trebles and two in a row are seven, not eight.",
  },
  {
    id: "turn",
    title: "How to turn",
    body: "Chain 3 and turn when the next row starts with a filled square. Chain 4 only when the first stitch of the next row is an open mesh. Filled = dc into the space; empty = chain 1, skip 1.",
  },
  {
    id: "tools",
    title: "Yarn card and Flip",
    body: "Yarn holds method, stitch, chain count, and a yarn estimate. Flip mirrors the chart when you turn the work so it still matches the grid.",
  },
  {
    id: "finish",
    title: "Finishing",
    body: "After the last row, cut the yarn, pull the tail through the last loop, and weave ends on the wrong side with a tapestry needle.",
  },
  {
    id: "borders",
    title: "Borders",
    body: "A lot of people add a filet border around the motif. Look up a border you like online and work it after the chart.",
  },
] as const;

/** Tapestry crochet primer — Manual page 2. */
export const TAPESTRY_PRIMER_SECTIONS = [
  {
    id: "tap-needs",
    title: "What you'll need",
    body: "Yarn in each chart color, a matching hook, scissors, and a tapestry needle for ends. Pick colors with enough contrast to read on the grid.",
  },
  {
    id: "tap-sc",
    title: "Single crochet foundation",
    body: "Work in single crochet (sc). Chain the chart width; each cell is one stitch. Carry unused yarn or drop it until you need it again.",
  },
  {
    id: "tap-change",
    title: "Changing colors",
    body: "Finish the last yarn-over of a stitch in the new color so it sits on top of the next stitch. Keep unused yarn on the wrong side.",
  },
  {
    id: "tap-carry",
    title: "Carrying yarn",
    body: "For frequent changes, lay the unused strand along the previous row and crochet over it. Drop a color when you will not need it for many stitches.",
  },
  {
    id: "tap-read",
    title: "Reading the chart",
    body: "Each filled cell is one stitch in that ink; empty is usually background. Start where your pattern says (often bottom-right) and work row by row. Tracker Row highlights the active row.",
  },
  {
    id: "tap-ink",
    title: "Ink wells",
    body: "On Program, pick an Ink well to paint, ∅ to erase, + to add a color. Double-click or hold a well to set any hex in the Ink card.",
  },
  {
    id: "tap-tips",
    title: "Tension tips",
    body: "Keep carried floats loose so the fabric does not pucker. Check the wrong side occasionally. Weave ends as colors finish.",
  },
] as const;

/** Corner-to-corner primer — Manual page 3. */
export const C2C_PRIMER_SECTIONS = [
  {
    id: "c2c-needs",
    title: "What you'll need",
    body: "Yarn in each chart color, a matching hook, scissors, and a tapestry needle. C2C uses the same colored grid as tapestry, worked on the diagonal.",
  },
  {
    id: "c2c-block",
    title: "One cell = one block",
    body: "Each square is one C2C block (typically ch 3 + 3 dc, or mini-C2C). Build from one corner toward the opposite corner.",
  },
  {
    id: "c2c-increase",
    title: "Increase diagonals",
    body: "Early diagonals grow longer each turn until you reach the chart’s longest diagonal, then you begin decreasing.",
  },
  {
    id: "c2c-decrease",
    title: "Decrease diagonals",
    body: "After the midpoint, slip-stitch to the next block edge and work shorter diagonals until one block remains.",
  },
  {
    id: "c2c-read",
    title: "Reading with Diag Tracker",
    body: "Set Tracker to Diag↘ (top-left origin) or Diag↗ (top-right). Index 01 is the first diagonal in that family. Checkboxes sit on the starting edge for early diagonals and along the bottom for the rest.",
  },
  {
    id: "c2c-color",
    title: "Color changes",
    body: "Change color on the last yarn-over of a block when the next block needs a new ink. Match yarn to Ink wells on the chart.",
  },
  {
    id: "c2c-tips",
    title: "Tips",
    body: "Keep block tension even so the fabric stays square. Weave ends as colors finish.",
  },
] as const;

/** Overlay mosaic primer — Manual page 4. */
export const MOSAIC_PRIMER_SECTIONS = [
  {
    id: "mos-needs",
    title: "What you'll need",
    body: "Two main yarn colors (high contrast helps), a matching hook, scissors, and a tapestry needle. Classic overlay mosaic is two-tone.",
  },
  {
    id: "mos-grid",
    title: "Chart = mosaic graph",
    body: "Paint with two Ink wells: one for background rows, one for overlay (front-post / drop-down) stitches. Stay consistent with empty vs filled.",
  },
  {
    id: "mos-rows",
    title: "Odd and even rows",
    body: "Alternate colors each row. Overlay stitches drop into the row below on the contrast color. Follow your written mosaic key with this chart as the map.",
  },
  {
    id: "mos-read",
    title: "Reading the chart",
    body: "Work row by row with Tracker in Row mode. Many mosaic graphs read right-to-left on WS rows—match your written key.",
  },
  {
    id: "mos-borders",
    title: "Borders and edges",
    body: "Mosaic fabrics often need a border to hide floats or edge bumps. Plan it outside the chart or add a frame after the motif.",
  },
  {
    id: "mos-tips",
    title: "Tips",
    body: "Keep overlays loose enough to lie flat. Count every few rows against the chart.",
  },
] as const;

/** Program console primer — Manual page 5. */
export const CONSOLE_PRIMER_SECTIONS = [
  {
    id: "con-bar",
    title: "Program bar",
    body: "Stock tints the card. Size sets W·H; Custom plus Link keeps proportions. Edit to draw; Lock while you stitch. Import opens the image card.",
  },
  {
    id: "con-import",
    title: "Import",
    body: "Crop, then choose Reference (trace behind the grid) or Auto-convert (threshold to cells). Apply lives with that tool. Layers stack if you add more than one image.",
  },
  {
    id: "con-yarn",
    title: "Yarn",
    body: "Method and stitch drive size and Chain. For filet, Chain follows whether the bottom-right square is open or filled. Amount is an estimate from weight, hook, and gauge.",
  },
  {
    id: "con-tracker",
    title: "Tracker",
    body: "Row, Col, Diag↘, or Diag↗. Check off tracks on the grid; the highlight follows. Steppers move one track at a time.",
  },
  {
    id: "con-flip",
    title: "Flip",
    body: "Face is the chart as drawn. Flip mirrors it horizontally so turned work still matches what you see.",
  },
  {
    id: "con-notes",
    title: "Notes",
    body: "Private to you. Hopper copies do not include notes.",
  },
  {
    id: "con-copy",
    title: "Copy from Hopper",
    body: "A copy brings the drawing, import settings, and yarn card. Checkboxes, highlight, Flip, and notes start fresh.",
  },
  {
    id: "con-save",
    title: "Save, print, public",
    body: "Sign in for autosave. Print opens a print-ready chart. Public lists the card in Hopper; Private keeps it on your Deck. Delete removes it.",
  },
] as const;
