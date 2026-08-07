# Gridwork design system

IBM 129 card data recorder aesthetics: manila punch cards, console knobs and lamps, chassis blues/grays on an off-white desk (`#EDE8D5`). Patterns are punched cards in the Hopper; editing happens on the Program console.

Tokens and button classes live in [`app/globals.css`](../app/globals.css).

## Two visual systems

### 1. Machine chrome (console / lamps)

Solid lamp caps and cream keys on the chassis. Zone keyboard:

| Color | Class | Meaning |
|-------|--------|---------|
| Blue | `punch-lamp-blue`, `--key-blue` `#5B7EC9` | Manual, instructions, tutorial |
| Red | `punch-lamp-red` `#C62828` | Hopper / shared gallery |
| Green | `punch-lamp-green` `#2E7D4F` | Program / save / new |
| Amber | `punch-lamp-amber` `#C9A227` | User / maker / log in |
| Violet | `punch-lamp-violet` | Program view tools (Print, Full, Fit / − / +) |
| Orange | `punch-lamp-orange` `#E06A1A` | Edit history / row step |
| Cream | `punch-key` (`--key-body` `#E8E4DA`) | Neutral chassis keys only |

Manual surfaces (Primer, Privacy, Terms) stay **white + blue** (`#2F5F9E`), not manila. Body copy uses IBM Plex Sans; chrome labels use JetBrains Mono.

### 2. Operator popups (manila punch cards)

Dialog shells that look like punched operator cards: cut corner (`.punch-card`), print ink, hole row.

**Header pattern** (use [`OperatorCardHeader`](../components/OperatorCardHeader.tsx)):

1. Left: `{Function} card` (9px mono, faint, uppercase)
2. Right: job code (`JOB AUTH`, etc.) or tutorial step columns (`Col 01-NN`)
3. Sparse 12-hole row under the titles
4. Default padding `px-6 py-5` (tutorial may stay compact)

**Not** for hopper/gallery/reader tray cards — those use pattern name + meta plate only (no operator header).

## Fonts

| Surface | Font |
|---------|------|
| Body default, chrome, cards, lamps | JetBrains Mono (`font-mono`) |
| Manual / legal body paragraphs | IBM Plex Sans (`font-sans`) |

Loaded in `app/layout.tsx`.

## Naming rules

- **Popups:** always `{Function} card` — never generic “Operator card”.
- **Console chrome:** drop redundant `Card` prefix; zone context already implies the machine (`Program`, `Reader`, `Import`, `Tracker`, `Hopper`, `Deck`).
- **“Card”** is reserved for manila artifacts: operator popups, hopper deck items, reader tray copy (“Select a card”).

### Popup titles

| Surface | Left title | Right label |
|---------|------------|-------------|
| Auth | `Log in card` / `Sign up card` | `JOB AUTH` |
| Display name | `Display name card` | `JOB NAME` |
| Tutorial | `Tutorial card` | `Col {step}-{total}` |
| Empty program | `Program card` | `JOB PROG` |
| Yarn | `Yarn card` | `JOB YARN` |
| Crop | `Crop card` | `JOB CROP` |
| Import panel | `Import card` | `JOB IMP` |

### Console labels

| Chrome | Label |
|--------|-------|
| Program console face | Program |
| Row progress bar | Tracker |
| Image import aside | Import |
| Reader preview aside | Reader |
| Public gallery zone | Hopper |
| Maker patterns | Deck |

Keyboard lamps: Manual / Hopper / Program / Profile (or Log in) — unchanged.

## Manila stock

Card paper colors for pattern grids/thumbs: [`lib/manilaStock.ts`](../lib/manilaStock.ts). Empty cells remap to the chosen stock so the grid matches the frame.

Row highlight and Tracker progress use a reciprocal opposite per stock:

| Stock | Opposite |
|-------|----------|
| White | Blue |
| Blue | White |
| Yellow | Brown |
| Brown | Yellow |
| Green | Red |
| Red | Green |
