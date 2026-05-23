// d-shared.jsx — Variation D primitives, tokens, sample data
// Self-contained: no external imports beyond React (loaded in the HTML).
//
// Tokens live in D_TOKENS. To port to Tailwind / CSS variables, see README.md.

// ───── Gradient background frame ─────────────────────────────────────────
//
// Mimics shadergradient with stacked radial-gradients. Wraps page content.
function GradientFrame({ children, style }) {
  return (
    <div className="d-screen d-gradient" style={style}>
      {children}
    </div>
  );
}

// ───── Crochet-block brand mark (4×4 grid) ──────────────────────────────
function CrochetMark({ size = 22, color = '#1F1410', cells }) {
  const c = cells || [
    [0,1,1,0],
    [1,1,1,1],
    [1,1,1,1],
    [0,1,1,0],
  ];
  const cell = (size - 3) / 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {c.map((row, y) => row.map((on, x) => (
        on ? (
          <rect key={`${x}-${y}`}
            x={x * (cell + 1) + 0.5}
            y={y * (cell + 1) + 0.5}
            width={cell} height={cell}
            rx="1" fill={color}/>
        ) : null
      )))}
    </svg>
  );
}

// ───── Inline icons (1.6 stroke) ────────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.6 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'arrow-right':  return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'heart':        return <svg {...p}><path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z"/></svg>;
    case 'copy':         return <svg {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>;
    case 'search':       return <svg {...p}><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'close':        return <svg {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case 'globe':        return <svg {...p}><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 010 16M12 4a12 12 0 000 16"/></svg>;
    case 'lock':         return <svg {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>;
    case 'plus':         return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'pencil':       return <svg {...p}><path d="M14 4l6 6-11 11H3v-6L14 4z"/></svg>;
    case 'logout':       return <svg {...p}><path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>;
    case 'chevron-down': return <svg {...p}><path d="m6 9 6 6 6-6"/></svg>;
    case 'book':         return <svg {...p}><path d="M4 4h10a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M4 16a4 4 0 014-4h10"/></svg>;
    default:             return null;
  }
}

// ───── Avatar with monogram ─────────────────────────────────────────────
function Avatar({ name = 'M', size = 32, tokens }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)',
      color: '#fff', fontFamily: tokens.fontBody, fontWeight: 700,
      fontSize: size * 0.42,
      border: '2px solid rgba(255,255,255,0.85)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
      flexShrink: 0,
    }}>{initial}</span>
  );
}

// ───── A miniature filet pattern thumbnail (for gallery/profile cards) ──
function PatternThumb({ seed = 'a', size = 84, light = '#F4ECE0', dark = '#3D2A1E', pad = 6 }) {
  const presets = {
    heart:   [[0,1,1,0,0,1,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],[0,0,1,1,1,1,0,0],[0,0,0,1,1,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
    leaf:    [[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,1,0,0,1,1,0],[1,1,0,0,0,0,1,1],[1,1,0,0,0,0,1,1],[0,1,1,0,0,1,1,0],[0,0,1,1,1,1,0,0],[0,0,0,1,1,0,0,0]],
    diamond: [[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,1,0,0,1,1,0],[1,1,0,0,0,0,1,1],[1,1,0,0,0,0,1,1],[0,1,1,0,0,1,1,0],[0,0,1,1,1,1,0,0],[0,0,0,1,1,0,0,0]],
    flower:  [[0,1,1,0,0,1,1,0],[1,1,1,1,1,1,1,1],[1,1,0,1,1,0,1,1],[0,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0],[1,1,0,1,1,0,1,1],[1,1,1,1,1,1,1,1],[0,1,1,0,0,1,1,0]],
    star:    [[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0]],
    grid:    [[1,0,1,0,1,0,1,0],[0,1,0,1,0,1,0,1],[1,0,1,0,1,0,1,0],[0,1,0,1,0,1,0,1],[1,0,1,0,1,0,1,0],[0,1,0,1,0,1,0,1],[1,0,1,0,1,0,1,0],[0,1,0,1,0,1,0,1]],
    cross:   [[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0]],
    waves:   [[0,0,1,1,0,0,1,1],[0,1,1,0,0,1,1,0],[1,1,0,0,1,1,0,0],[1,0,0,1,1,0,0,1],[0,0,1,1,0,0,1,1],[0,1,1,0,0,1,1,0],[1,1,0,0,1,1,0,0],[1,0,0,1,1,0,0,1]],
  };
  const p = presets[seed] ?? presets.diamond;
  const inner = size - pad * 2;
  const cells = 8;
  const cell = inner / cells;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} rx="6" fill={light} />
      {p.map((row, y) => row.map((on, x) => (
        on ? (
          <rect key={`${x}-${y}`}
            x={pad + x * cell} y={pad + y * cell}
            width={cell} height={cell} fill={dark}/>
        ) : null
      )))}
    </svg>
  );
}

// ───── Variation D tokens (Mixed: A's palette + B's fonts) ──────────────
const D_TOKENS = {
  name: 'Mixed',
  subtitle: 'Lora + Nunito · deep rose · transparent nav',
  fontHead: '"Lora", Georgia, serif',
  fontBody: '"Nunito", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',
  text:        '#3D2A1E',
  textStrong:  '#1F1410',
  muted:       '#7A6A5F',
  mutedStrong: '#5C4D43',
  card:        '#FBF7EF',
  cardEdge:    'rgba(255,255,255,0.55)',
  navCard:     'rgba(251,247,239,0.78)',
  cta:         '#A8466F',
  ctaHover:    '#8B345A',
  ctaText:     '#FBF7EF',
  accent:      '#B85A35',
  accentSoft:  '#E8B89F',
  divider:     'rgba(61,42,30,0.10)',
  pillBg:      'rgba(184,90,53,0.10)',
  pillText:    '#8E4128',
};

// ───── Sample patterns (for gallery + profile mockups) ──────────────────
const SAMPLE_PATTERNS = [
  { seed: 'heart',   name: 'Sweetheart sampler',   maker: 'ellie_k',   w: 24, h: 32, likes: 142, copies: 38 },
  { seed: 'leaf',    name: 'Linden leaf border',   maker: 'marigold',  w: 32, h: 12, likes: 89,  copies: 24 },
  { seed: 'diamond', name: 'Diamond chain runner', maker: 'rosalia',   w: 40, h: 16, likes: 67,  copies: 19 },
  { seed: 'flower',  name: 'Cottage rose square',  maker: 'beewren',   w: 28, h: 28, likes: 213, copies: 71 },
  { seed: 'star',    name: 'Northstar coaster',    maker: 'finn_yarn', w: 16, h: 16, likes: 54,  copies: 12 },
  { seed: 'grid',    name: 'Honeycomb mesh',       maker: 'thicket',   w: 36, h: 36, likes: 31,  copies: 8  },
  { seed: 'cross',   name: 'Sampler cross',        maker: 'ellie_k',   w: 20, h: 20, likes: 102, copies: 27 },
  { seed: 'waves',   name: 'Tideline trim',        maker: 'marigold',  w: 48, h: 8,  likes: 76,  copies: 18 },
  { seed: 'flower',  name: 'Garden window',        maker: 'thicket',   w: 32, h: 40, likes: 124, copies: 34 },
  { seed: 'heart',   name: "Granny's hearts",      maker: 'rosalia',   w: 24, h: 24, likes: 198, copies: 52 },
  { seed: 'star',    name: 'Pinwheel star',        maker: 'finn_yarn', w: 20, h: 20, likes: 47,  copies: 11 },
  { seed: 'leaf',    name: 'Ivy edging',           maker: 'beewren',   w: 40, h: 10, likes: 38,  copies: 9  },
];

Object.assign(window, {
  D_TOKENS, SAMPLE_PATTERNS,
  GradientFrame, CrochetMark, Icon, Avatar, PatternThumb,
});
