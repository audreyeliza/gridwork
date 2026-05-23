// redesign-v4-pages.jsx — Learn, Gallery, Profile, Mobile menu for Variation D

const { D_TOKENS: TD, DNavbar: DNB } = window;

// ─── LEARN — A's sticky-TOC + cream article card layout ─────────────────
const D_LEARN = [
  { id: 'needs',  title: "What you'll need",      blurb: "A smooth cotton yarn (worsted or fingering weight are easiest to learn with), a crochet hook sized for your yarn, and scissors. No prior experience required." },
  { id: 'slip',   title: 'Slip knot',             blurb: "Make a small loop, pull the tail through, and place it on your hook. Snug it up. This is your first stitch — it anchors everything that follows." },
  { id: 'chain',  title: 'Foundation chain',      blurb: "Yarn over and pull through the loop on your hook — one chain stitch. Repeat until your chain matches your pattern width, plus 3 extra turning chains." },
  { id: 'dc',     title: 'Double crochet (dc)',   blurb: "Yarn over → insert hook → yarn over and pull up a loop → yarn over and pull through two loops → yarn over and pull through the last two. That's one dc." },
  { id: 'mesh',   title: 'Open mesh square',      blurb: "Chain 2, skip 2 stitches, work 1 dc into the next stitch. The chain-2 and the surrounding dc posts form one open square in your grid." },
  { id: 'block',  title: 'Filled block square',   blurb: "Work 3 dc into consecutive stitches (or into the chain-2 space from the row below). Those 3 dc fill one square's footprint as a solid block." },
  { id: 'read',   title: 'Reading the grid',      blurb: "Start at the bottom-left of your pattern and work across row 1. Chain 3, turn. Row 2 reads left to right again. Follow the grid row by row to the top." },
];

function DLearn({ tokens = TD }) {
  return (
    <GradientFrame>
      <DNB active="learn" tokens={tokens} />
      <div style={{
        display: 'grid', gridTemplateColumns: '220px 1fr', gap: 48,
        maxWidth: 1080, margin: '0 auto',
        padding: '108px 48px 48px',
      }}>
        {/* Sticky TOC */}
        <aside style={{ paddingTop: 8 }}>
          <div style={{
            fontFamily: tokens.fontMono, fontSize: 11, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)',
            marginBottom: 14, fontWeight: 700,
            textShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}>
            On this page
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {D_LEARN.map((s, i) => (
              <li key={s.id} style={{
                fontFamily: tokens.fontBody, fontSize: 13,
                color: i === 1 ? '#fff' : 'rgba(255,255,255,0.78)',
                fontWeight: i === 1 ? 700 : 500,
                display: 'flex', alignItems: 'baseline', gap: 8,
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}>
                <span style={{
                  fontFamily: tokens.fontMono, fontSize: 10,
                  opacity: 0.7, minWidth: 16,
                }}>{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </li>
            ))}
          </ol>
        </aside>

        {/* Article */}
        <article style={{
          background: tokens.card,
          borderRadius: 18,
          padding: '40px 48px 48px',
          boxShadow: '0 10px 40px rgba(40,20,30,0.12), 0 0 0 1px rgba(255,255,255,0.5)',
        }}>
          <div style={{
            fontFamily: tokens.fontMono, fontSize: 11, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: tokens.cta, marginBottom: 12,
            fontWeight: 700,
          }}>
            Primer · 7 sections
          </div>
          <h1 style={{
            fontFamily: tokens.fontHead, fontWeight: 700,
            fontSize: 46, lineHeight: 1.05, letterSpacing: '-0.02em',
            margin: 0, color: tokens.textStrong,
          }}>
            How to make filet crochet
          </h1>
          <p style={{
            fontFamily: tokens.fontHead, fontStyle: 'italic', fontWeight: 400,
            fontSize: 18, lineHeight: 1.5,
            color: tokens.text, margin: '12px 0 32px', maxWidth: '60ch',
          }}>
            Two squares — open and filled — and you can stitch anything you can draw on graph paper.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {D_LEARN.map((s, i) => (
              <section key={s.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                  <span style={{
                    fontFamily: tokens.fontMono, fontSize: 11,
                    color: tokens.muted, letterSpacing: '0.1em', fontWeight: 600,
                  }}>{String(i + 1).padStart(2, '0')}</span>
                  <h2 style={{
                    fontFamily: tokens.fontHead, fontWeight: 700,
                    fontSize: 22, lineHeight: 1.2, letterSpacing: '-0.01em',
                    margin: 0, color: tokens.textStrong,
                  }}>{s.title}</h2>
                </div>
                <p style={{
                  fontFamily: tokens.fontBody, fontSize: 15.5, lineHeight: 1.65,
                  color: tokens.text, margin: 0, fontWeight: 500,
                }}>{s.blurb}</p>
              </section>
            ))}
          </div>

          {/* Finish CTA */}
          <div style={{
            marginTop: 44, paddingTop: 32,
            borderTop: `1px solid ${tokens.divider}`,
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: tokens.fontBody, fontSize: 14, color: tokens.muted, margin: 0, fontWeight: 500,
            }}>Ready to design your own pattern?</p>
            <button style={{
              marginTop: 14,
              background: tokens.cta, color: tokens.ctaText, border: 'none',
              padding: '13px 28px', borderRadius: 999,
              fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(168,70,111,0.30)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>Open the editor <Icon name="arrow-right" size={14}/></button>
          </div>
        </article>
      </div>
    </GradientFrame>
  );
}

// ─── GALLERY — A's 6-col grid with sort+search ──────────────────────────
function DGallery({ tokens = TD }) {
  const patterns = window.SAMPLE_PATTERNS || [];
  return (
    <GradientFrame>
      <DNB active="gallery" tokens={tokens} />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '108px 48px 48px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{
              fontFamily: tokens.fontMono, fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', marginBottom: 8,
              fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}>Community patterns</div>
            <h1 style={{
              fontFamily: tokens.fontHead, fontWeight: 700, fontSize: 48,
              margin: 0, color: '#fff', letterSpacing: '-0.02em',
              textShadow: '0 2px 6px rgba(40,20,40,0.18)',
            }}>The Gallery</h1>
            <p style={{
              fontFamily: tokens.fontHead, fontStyle: 'italic',
              fontSize: 16, color: 'rgba(255,255,255,0.92)', margin: '4px 0 0',
              textShadow: '0 1px 2px rgba(40,20,40,0.18)',
            }}>Browse, like, and copy patterns shared by the community.</p>
          </div>
          {/* Sort + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'inline-flex',
              background: tokens.card, borderRadius: 999, padding: 4,
              boxShadow: '0 4px 14px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)',
            }}>
              {['Newest', 'Popular'].map((s, i) => (
                <span key={s} style={{
                  padding: '7px 16px', borderRadius: 999,
                  fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700,
                  background: i === 1 ? tokens.cta : 'transparent',
                  color: i === 1 ? tokens.ctaText : tokens.mutedStrong,
                  cursor: 'pointer',
                }}>{s}</span>
              ))}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: tokens.card, borderRadius: 999, padding: '8px 14px',
              boxShadow: '0 4px 14px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)',
              fontFamily: tokens.fontBody, fontSize: 13, color: tokens.muted, fontWeight: 500,
              minWidth: 220,
            }}>
              <Icon name="search" size={15} color={tokens.muted} />
              Search patterns…
            </div>
          </div>
        </div>

        {/* Pattern grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 18 }}>
          {patterns.map((p, i) => (
            <div key={i} style={{
              background: tokens.card, borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 6px 20px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)',
            }}>
              <div style={{ position: 'relative', background: '#F4ECE0', padding: 16, paddingBottom: 0 }}>
                <PatternThumb seed={p.seed} size={138} light="#F4ECE0" dark={tokens.textStrong} />
                <span style={{
                  position: 'absolute', bottom: 8, right: 22,
                  background: 'rgba(31,20,16,0.7)', color: '#fff',
                  fontFamily: tokens.fontMono, fontSize: 10,
                  padding: '3px 8px', borderRadius: 999, fontWeight: 500,
                }}>{p.w}×{p.h}</span>
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{
                  fontFamily: tokens.fontHead, fontSize: 15, fontWeight: 600,
                  color: tokens.textStrong, lineHeight: 1.2,
                  letterSpacing: '-0.005em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.name}</div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 6,
                }}>
                  <span style={{
                    fontFamily: tokens.fontBody, fontSize: 12,
                    color: tokens.cta, fontWeight: 700,
                  }}>@{p.maker}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted, fontWeight: 600,
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="heart" size={12} color={tokens.cta} />{p.likes}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="copy" size={12} />{p.copies}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GradientFrame>
  );
}

Object.assign(window, { DLearn, DGallery });
