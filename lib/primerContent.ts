export const PRIMER_SECTIONS = [
  {
    id: "needs",
    title: "What you'll need",
    body: "Smooth cotton yarn, a matching hook, and scissors. Filet is a great first project.",
  },
  {
    id: "slip",
    title: "Slip knot",
    body: "Loop the yarn, pull the tail through, place it on your hook, and snug both ends. This anchors the piece.",
  },
  {
    id: "chain",
    title: "Foundation chain",
    body: "Squares × 2 + 4 = starting chain (10 squares → chain 24). First double crochet goes into the 5th chain from the hook.",
  },
  {
    id: "dc",
    title: "Double crochet (dc)",
    body: "Yarn over → insert → yarn over, pull up (3 loops) → pull through 2 → pull through 2. The only stitch filet uses; its height matches a chain-1 space.",
  },
  {
    id: "mesh",
    title: "Open mesh square (empty cell)",
    body: "Dc, chain 1, skip 1, dc. That gap is one open square.",
  },
  {
    id: "block",
    title: "Filled block square (filled cell)",
    body: "Three dc in a row (into the post, the chain space, then the next post) fill the square solid.",
  },
  {
    id: "turn",
    title: "Turning and working rows",
    body: "Chain 4 and turn at the end of every row (counts as first dc + chain-1). Filled = dc into the space; empty = chain 1, skip 1.",
  },
  {
    id: "read",
    title: "Reading the grid",
    body: "Start bottom-left, work right. Each turn flips your travel direction; the chart stays put. Work up row by row.",
  },
] as const;
