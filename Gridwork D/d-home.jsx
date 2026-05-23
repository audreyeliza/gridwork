// redesign-v4.jsx — Variation D · Mixed
// A's palette (deep rose + warm cream) + B's fonts (Lora + Nunito)
// + C₁ transparent navbar, A's home (no eyebrow)/learn/gallery,
// B's profile + mobile menu, and a NEW editor page.

const D_TOKENS = {
  name: 'Mixed',
  subtitle: 'Lora + Nunito · deep rose · transparent nav',
  // ── B's fonts ──
  fontHead: '"Lora", Georgia, serif',
  fontBody: '"Nunito", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',
  // ── A's palette ──
  text:        '#3D2A1E',
  textStrong:  '#1F1410',
  muted:       '#7A6A5F',
  mutedStrong: '#5C4D43',
  card:        '#FBF7EF',
  cardEdge:    'rgba(255,255,255,0.55)',
  navCard:     'rgba(251,247,239,0.78)', // for frosted fallback if ever needed
  cta:         '#A8466F',  // deep rose
  ctaHover:    '#8B345A',
  ctaText:     '#FBF7EF',
  accent:      '#B85A35',
  accentSoft:  '#E8B89F',
  divider:     'rgba(61,42,30,0.10)',
  pillBg:      'rgba(184,90,53,0.10)',
  pillText:    '#8E4128',
};

// ─── Navbar — C₁ transparent, with deep-rose dot indicator ───────────────
function DNavbar({ active = 'home', tokens = D_TOKENS }) {
  const link = (key, label) => {
    const isActive = key === active;
    return (
      <span style={{
        position: 'relative',
        display: 'inline-flex', alignItems: 'center', gap: 7, height: 28,
        padding: '0 4px',
        fontFamily: tokens.fontBody,
        fontSize: 14, fontWeight: isActive ? 700 : 600,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
        cursor: 'pointer',
        letterSpacing: '0.005em',
        textShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }}>
        {isActive && (
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: '#fff', flexShrink: 0,
          }}/>
        )}
        {label}
      </span>
    );
  };

  return (
    <header style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 68,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      background: 'transparent',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          fontFamily: tokens.fontHead,
          fontSize: 24, fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.01em', lineHeight: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}>
          <CrochetMark size={22} color="#fff"/>
          Gridwork
        </span>
        <nav style={{ display: 'flex', gap: 28 }}>
          {link('home',    'Home')}
          {link('learn',   'Learn')}
          {link('gallery', 'Gallery')}
          {link('editor',  'Editor')}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.45)',
          padding: '6px 14px 6px 6px', borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700,
          color: '#fff',
          backdropFilter: 'blur(10px)',
          cursor: 'pointer',
          textShadow: '0 1px 1px rgba(0,0,0,0.10)',
        }}>
          <Avatar name="M" size={28} tokens={tokens} />
          @marigold
        </button>
      </div>
    </header>
  );
}

// ─── Home — A's layout WITHOUT the eyebrow blurb (tweakable) ────────────
function DHome({ tokens = D_TOKENS }) {
  const tweaks = React.useContext(window.GridworkTweaksContext || React.createContext({}));
  const titleDark = tweaks.homeHeroDark !== false; // default DARK per user request
  const italic    = tweaks.homeSubtitleItalic !== false;
  const cta       = tweaks.ctaColor || tokens.cta;

  // Only the *title* responds to the dark tweak. Subtitle + body always stay
  // white over the gradient — keeps the gradient feeling alive.
  const titleColor  = titleDark ? tokens.textStrong : '#fff';
  const titleShadow = titleDark ? 'none' : '0 2px 6px rgba(40,20,40,0.18)';

  return (
    <GradientFrame>
      <DNavbar active="home" tokens={tokens} />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '120px 60px 60px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 720 }}>
          <h1 style={{
            fontFamily: tokens.fontHead,
            fontSize: 112, lineHeight: 0.95, fontWeight: 700,
            margin: 0,
            color: titleColor,
            letterSpacing: '-0.025em',
            textShadow: titleShadow,
          }}>
            Gridwork
          </h1>

          <p style={{
            fontFamily: tokens.fontHead,
            fontStyle: italic ? 'italic' : 'normal',
            fontWeight: italic ? 400 : 500,
            fontSize: 24, lineHeight: 1.4,
            margin: '20px auto 0',
            maxWidth: 540,
            color: '#fff',
            textShadow: '0 1px 2px rgba(40,20,40,0.18)',
          }}>
            Design filet crochet patterns by tapping squares on a grid.
          </p>

          <p style={{
            fontFamily: tokens.fontBody,
            fontSize: 17, lineHeight: 1.55, fontWeight: 500,
            margin: '14px auto 40px',
            maxWidth: 480,
            color: 'rgba(255,255,255,0.95)',
            textShadow: '0 1px 2px rgba(40,20,40,0.18)',
          }}>
            Save them, share them, stitch them. A browser tool for charting filet — no signup needed for your first save.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center' }}>
            <button style={{
              background: cta, color: tokens.ctaText, border: 'none',
              padding: '15px 30px', borderRadius: 999,
              fontFamily: tokens.fontBody, fontSize: 15, fontWeight: 700,
              letterSpacing: '0.01em', cursor: 'pointer',
              boxShadow: `0 8px 26px ${cta}66`,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              Start a pattern
              <Icon name="arrow-right" size={16} />
            </button>
            <button style={{
              background: 'rgba(255,255,255,0.85)',
              color: tokens.textStrong,
              border: '1px solid rgba(255,255,255,0.6)',
              padding: '14px 26px', borderRadius: 999,
              fontFamily: tokens.fontBody, fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 18px rgba(40,20,30,0.10)',
            }}>
              Browse gallery
            </button>
          </div>

          <a style={{
            display: 'inline-block', marginTop: 30,
            fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 600,
            color: 'rgba(255,255,255,0.95)',
            textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.5)',
            paddingBottom: 2,
            textShadow: '0 1px 2px rgba(40,20,40,0.18)',
          }}>
            New to filet crochet? Read the primer →
          </a>
        </div>
      </div>
    </GradientFrame>
  );
}

Object.assign(window, { D_TOKENS, DNavbar, DHome });
