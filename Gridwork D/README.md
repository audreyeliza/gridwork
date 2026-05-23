# Gridwork — Variation D (handoff)

Self-contained mockups for the redesigned Gridwork. Drop this folder anywhere
and open `Gridwork D.html` in a browser — no build step, no install.

## Files

| File | What's in it |
| --- | --- |
| `Gridwork D.html`      | Entry. Loads React + Babel from unpkg, then the four `d-*.jsx` files. Renders every screen vertically with section headers. |
| `d-shared.jsx`         | **Tokens (`D_TOKENS`)**, sample data, primitives (`GradientFrame`, `Icon`, `Avatar`, `CrochetMark`, `PatternThumb`). Read this first. |
| `d-home.jsx`           | `DNavbar` (transparent over gradient) + `DHome`. |
| `d-learn-gallery.jsx`  | `DLearn` + `DGallery`. |
| `d-profile-mobile.jsx` | `DProfile` + `DMobile`. |
| `d-editor.jsx`         | `DEditor`, `DEditorImport`, plus all editor sub-components (`EditorToolbar`, `EditorSidebar`, `EditorGrid`, `YarnPanel`, `ImageImportPanel`, `FinishedSize`, `TutorialSpotlightCallout`). |

## Design tokens (port to `globals.css` / Tailwind)

From `d-shared.jsx`:

```
fontHead     "Lora", Georgia, serif
fontBody     "Nunito", system-ui, sans-serif
fontMono     "JetBrains Mono", ui-monospace, monospace

text         #3D2A1E   warm brown body
textStrong   #1F1410   near-black headings
muted        #7A6A5F
mutedStrong  #5C4D43

card         #FBF7EF   warm cream surfaces
divider      rgba(61,42,30,0.10)

cta          #A8466F   deep rose — primary
ctaHover     #8B345A
ctaText      #FBF7EF
accent       #B85A35   warm terracotta (links, accents)
accentSoft   #E8B89F

pillBg       rgba(184,90,53,0.10)
pillText     #8E4128
```

Suggested Tailwind mapping (`tailwind.config.ts`):

```ts
extend: {
  colors: {
    brand:         { DEFAULT: '#A8466F', dark: '#8B345A' },
    accent:        { DEFAULT: '#B85A35', dark: '#8E4128', soft: '#E8B89F' },
    text:          { DEFAULT: '#3D2A1E', strong: '#1F1410' },
    surface:       { DEFAULT: '#FBF7EF' },
  },
  fontFamily: {
    serif:  ['Lora', 'Georgia', 'serif'],
    sans:   ['Nunito', 'system-ui', 'sans-serif'],
    mono:   ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
  },
}
```

## Per-screen notes

### Home (`DHome`)
- Title **"Gridwork"** is `textStrong` (dark brown). Subtitle (italic Lora) + body
  stay white over the gradient so it still feels lively.
- Primary CTA: filled `cta`, pill. Secondary: frosted white with `cta` text on click.
- Eyebrow blurb deliberately removed.

### Learn (`DLearn`)
- Sticky left TOC (white text over gradient), cream article card.
- Italic Lora intro paragraph under the H1 — keep this on the real page.
- One CTA at the end: "Open the editor".

### Gallery (`DGallery`)
- 6-column grid. Each card: thumbnail (size chip overlay) + name + maker handle
  (deep-rose) + likes/copies.
- Header has sort pills (Newest / Popular) and a search input.

### Profile (`DProfile`)
- Journal-style card header: gradient-monogram avatar + name + edit button + view-public link.
- Stats strip (patterns / public / likes received / copies) divides the card.
- Tabs (My patterns / Liked) + "New pattern" CTA, then 6-col grid.

### Editor — Draw mode (`DEditor`)
- **Floating cream app panel** on the gradient.
- Sidebar: pattern list with **search** + per-pattern **saved-date** stamps
  ("Saved · today, 2:14 PM"). No duplicate avatar at the bottom — the navbar
  avatar is the single source of truth.
- Toolbar: name + saved indicator + grid sizing (`tutorial-grid-size`) + undo/redo,
  row controls, print, save.
- Grid: row numbers, **per-row checkboxes** (`tutorial-row-progress`), grid SVG
  with current-row dashed outline + tinted bg, draw-mode toggle (`tutorial-pencil`),
  block/mesh/current-row legend.
- Below grid: **progress bar** ("12 / 24 rows complete · 50%") + cell counts.
- Right panel: **yarn estimator** with finished-size **math rendered live**:
  `cm = cells × 10 / gauge`. Works for ANY grid size, not just presets.

### Editor — Import mode (`DEditorImport`)
- Same shell; right panel swaps to image-import controls (`tutorial-image-tools`):
  file row, crop preview with handles + rule-of-thirds, Underlay / Convert mode
  toggle, **Underlay opacity** slider, **Threshold** slider with **Auto**, dark/light
  pixel toggle, "Apply to grid" button.
- Mirrors the actual `components/ImageTools.tsx` state shape:
  `mode | imageDataUrl | underlayOpacityPct | threshold | darkIsFilled | cropRect | appliedCrop | panX | panY | positionLocked`.

### Mobile menu (`DMobile`)
- Big Lora headings on the gradient. Active item: **white dot** before the word
  + "YOU ARE HERE" in mono (matches desktop navbar exactly).
- Profile / log-out card is **frosted-translucent** (`rgba(255,255,255,0.18)` +
  `backdrop-filter: blur(14px)`), not a solid cream card.

## Tutorial integration

The existing `components/TutorialSpotlight.tsx` walks through targets by `id`. The
new editor preserves all of them so the existing tutorial works unchanged:

| Step | targetId | Where it now lives |
| --- | --- | --- |
| 1 | `tutorial-grid-size`   | Preset + W/H pill cluster in `EditorToolbar` |
| 2 | `tutorial-pencil`      | Block/Mesh/Eraser segmented toggle above the grid in `EditorGrid` |
| 3 | `tutorial-image-tools` | Whole `ImageImportPanel` (Import mode) |
| 4 | `tutorial-row-progress`| The checkbox column down the left of the grid |
| 5 | `tutorial-print`       | Print button in `EditorToolbar` |
| 6 | `tutorial-login`       | Add to the navbar's account button — same as before |

The Editor mockup includes a `TutorialSpotlightCallout` example (see
`d-editor.jsx`) showing the popover targeting the row-checkbox column. Match its
visual treatment when you rebuild `TutorialSpotlight.tsx`.

## Finished-size math (`FinishedSize` in `d-editor.jsx`)

Critical: the finished-size display in the yarn panel must be **computed live**
from grid dimensions + gauge, not stored per-preset. The formula:

```
widthCm  = gridWidth  × 10 ÷ gaugeSquaresPer10cm
heightCm = gridHeight × 10 ÷ gaugeSquaresPer10cm
widthIn  = widthCm / 2.54
heightIn = heightCm / 2.54
```

This mirrors `lib/yarnSettings.ts`. Render the formula explicitly under the
big number (as the mockup does) so users understand where it comes from — works
for any custom grid, not just `GRID_PRESETS`.

## Save-state UX

- Sidebar items show `"Saved · today, 2:14 PM" / "Saved · yesterday" / "Saved · Mar 6"` — relative for recent, absolute date for older. Re-render after every autosave.
- Toolbar saved pill: green dot + "Saved <time-ago>". After a save success, show "Saved a moment ago"; degrade to "Saved 2 min ago" etc.
- The orange "Unsaved changes" + amber "Saving…" states from the existing code stay; just restyle the pill to match the green one.

## What's mockup vs production

- All filled-grid data, sample patterns, gauge numbers, and dates are **mock data**. Wire to real Supabase queries.
- The gradient is a CSS approximation — keep using your existing `<AppGradient>` / `<AppGradientInner>` in production.
- `Avatar`, `CrochetMark`, `Icon`, `PatternThumb` are inline SVG components; replace `PatternThumb` with `thumbnail` data URLs from the DB.
- Tutorial spotlight popover styling is a mock — copy the rectangle's typography/box-shadow/colors into the real `TutorialSpotlight.tsx`.
