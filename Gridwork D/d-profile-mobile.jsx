// redesign-v4-profile-mobile.jsx — Profile (B-style) + Mobile menu (B-style)
// — both retuned to D tokens (Lora + Nunito + A's deep-rose palette).

const { D_TOKENS: TDp, DNavbar: DNBp } = window;

// ─── PROFILE — B's journal-style header ─────────────────────────────────
function DProfile({ tokens = TDp }) {
  const patterns = (window.SAMPLE_PATTERNS || []).slice(0, 6);
  return (
    <GradientFrame>
      <DNBp active="profile" tokens={tokens} />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '108px 32px 48px' }}>

        {/* Journal-style header */}
        <div style={{
          background: tokens.card, borderRadius: 22,
          padding: '40px 48px',
          boxShadow: '0 10px 36px rgba(40,20,30,0.12), 0 0 0 1px rgba(255,255,255,0.5)',
          marginBottom: 28,
          position: 'relative',
        }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 92, height: 92, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F9A87A 0%, #F0569A 50%, #9B6FD4 100%)',
              color: '#fff', fontFamily: tokens.fontHead, fontWeight: 700,
              fontSize: 42, lineHeight: 1,
              border: '4px solid #fff',
              boxShadow: '0 6px 20px rgba(168,70,111,0.25)',
              flexShrink: 0,
            }}>M</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: tokens.fontMono, fontSize: 11, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: tokens.muted, marginBottom: 4, fontWeight: 600,
              }}>Maker profile</div>
              <h1 style={{
                fontFamily: tokens.fontHead, fontWeight: 700, fontSize: 40,
                margin: 0, color: tokens.textStrong, letterSpacing: '-0.02em',
                display: 'inline-flex', alignItems: 'center', gap: 10,
              }}>
                @marigold
                <button style={{
                  background: 'transparent', border: `1px solid ${tokens.divider}`,
                  borderRadius: 999, padding: '5px 10px',
                  fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted,
                  cursor: 'pointer', fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <Icon name="pencil" size={11} color={tokens.muted}/> Edit
                </button>
              </h1>
              <p style={{
                fontFamily: tokens.fontBody, fontSize: 14, color: tokens.muted,
                margin: '4px 0 0', fontWeight: 500,
              }}>marigold@gridwork.dev · joined March 2026</p>
            </div>
            <a style={{
              fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700,
              color: tokens.cta, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>View public profile <Icon name="arrow-right" size={12} color={tokens.cta} /></a>
          </div>

          {/* Stats strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
            paddingTop: 20, marginTop: 4,
            borderTop: `1px solid ${tokens.divider}`,
          }}>
            {[
              { v: '18', l: 'patterns' },
              { v: '7',  l: 'public'   },
              { v: '312',l: 'likes received' },
              { v: '84', l: 'copies'   },
            ].map((s, i) => (
              <div key={s.l} style={{
                paddingLeft: i === 0 ? 0 : 24,
                borderLeft: i === 0 ? 'none' : `1px solid ${tokens.divider}`,
              }}>
                <div style={{
                  fontFamily: tokens.fontHead, fontWeight: 700, fontSize: 32,
                  color: tokens.textStrong, lineHeight: 1, letterSpacing: '-0.015em',
                }}>{s.v}</div>
                <div style={{
                  fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted,
                  marginTop: 4, fontWeight: 600, letterSpacing: '0.02em',
                }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs + new pattern */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {['My patterns · 18', 'Liked · 23'].map((t, i) => (
              <span key={t} style={{
                padding: '8px 16px', borderRadius: 10,
                fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700,
                background: i === 0 ? tokens.card : 'transparent',
                color: i === 0 ? tokens.textStrong : 'rgba(255,255,255,0.95)',
                boxShadow: i === 0 ? '0 4px 14px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)' : 'none',
                cursor: 'pointer',
                textShadow: i === 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
              }}>{t}</span>
            ))}
          </div>
          <button style={{
            background: tokens.cta, color: tokens.ctaText, border: 'none',
            padding: '10px 18px', borderRadius: 999,
            fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(168,70,111,0.30)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="plus" size={13} /> New pattern
          </button>
        </div>

        {/* Pattern grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          {patterns.map((p, i) => (
            <div key={i} style={{
              background: tokens.card, borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 6px 20px rgba(40,20,30,0.10), 0 0 0 1px rgba(255,255,255,0.5)',
            }}>
              <div style={{ position: 'relative', background: '#F4ECE0', padding: 14, paddingBottom: 0 }}>
                <PatternThumb seed={p.seed} size={130} light="#F4ECE0" dark={tokens.textStrong} />
              </div>
              <div style={{ padding: '10px 13px 13px' }}>
                <div style={{
                  fontFamily: tokens.fontHead, fontSize: 15, fontWeight: 600,
                  color: tokens.textStrong, lineHeight: 1.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 999,
                    background: i % 2 === 0 ? tokens.pillBg : 'rgba(122,106,95,0.10)',
                    color: i % 2 === 0 ? tokens.pillText : tokens.muted,
                    fontFamily: tokens.fontBody, fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}>
                    <Icon name={i % 2 === 0 ? 'globe' : 'lock'} size={9} />
                    {i % 2 === 0 ? 'PUBLIC' : 'PRIVATE'}
                  </span>
                  <span style={{
                    fontFamily: tokens.fontMono, fontSize: 10, color: tokens.muted,
                  }}>{p.w}×{p.h}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GradientFrame>
  );
}

// ─── MOBILE menu — B's editorial overlay, retuned ───────────────────────
function DMobile({ tokens = TDp }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#1a1612', display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      padding: '24px 0',
    }}>
      <div style={{
        width: 360, height: 720, borderRadius: 36,
        background: '#000', padding: 6,
        boxShadow: '0 10px 50px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden',
          position: 'relative',
        }}>
          <GradientFrame style={{ position: 'absolute', inset: 0 }}>
            {/* status bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 22px', fontFamily: 'system-ui, sans-serif',
              fontSize: 14, fontWeight: 600, color: '#fff', zIndex: 20,
            }}>
              <span>9:41</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <svg width="16" height="11" viewBox="0 0 16 11" fill="#fff"><rect x="0" y="6" width="3" height="5" rx="0.5"/><rect x="4" y="4" width="3" height="7" rx="0.5"/><rect x="8" y="2" width="3" height="9" rx="0.5"/><rect x="12" y="0" width="3" height="11" rx="0.5"/></svg>
                <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="#fff" strokeWidth="1.2"><rect x="0.5" y="0.5" width="18" height="10" rx="2"/><rect x="2" y="2" width="14" height="7" rx="1" fill="#fff" stroke="none"/><rect x="19.5" y="3.5" width="1.5" height="4" rx="0.5" fill="#fff" stroke="none"/></svg>
              </span>
            </div>

            {/* nav bar — transparent like desktop */}
            <div style={{
              position: 'absolute', top: 38, left: 0, right: 0, height: 58,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 18px',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontFamily: tokens.fontHead, fontWeight: 700, fontSize: 20,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}>
                <CrochetMark size={20} color="#fff"/>
                Gridwork
              </span>
              <button style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,255,255,0.22)',
                border: '1px solid rgba(255,255,255,0.4)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(10px)',
              }}>
                <Icon name="close" size={18} color="#fff"/>
              </button>
            </div>

            {/* big menu over gradient — editorial style */}
            <div style={{
              position: 'absolute', top: 96, left: 0, right: 0, bottom: 0,
              padding: '32px 28px',
            }}>
              <div style={{
                fontFamily: tokens.fontMono, fontSize: 11, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)',
                marginBottom: 18, fontWeight: 700,
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}>Menu</div>

              {[
                { l: 'Home',    active: false },
                { l: 'Learn',   active: true  },
                { l: 'Gallery', active: false },
                { l: 'Editor',  active: false },
                { l: 'Profile', active: false },
              ].map((m, i) => (
                <div key={m.l} style={{
                  padding: '14px 0',
                  borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.22)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 14,
                    fontFamily: tokens.fontHead, fontWeight: 700, fontSize: 34,
                    color: '#fff', letterSpacing: '-0.02em',
                    textShadow: '0 1px 2px rgba(0,0,0,0.18)',
                    lineHeight: 1,
                  }}>
                    {m.active && (
                      <span style={{
                        display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                        background: '#fff', flexShrink: 0,
                        boxShadow: '0 0 0 4px rgba(255,255,255,0.18)',
                      }}/>
                    )}
                    {m.l}
                  </span>
                  {m.active && (
                    <span style={{
                      fontFamily: tokens.fontMono, fontSize: 10,
                      color: '#fff', fontWeight: 700, letterSpacing: '0.10em',
                      textShadow: '0 1px 2px rgba(0,0,0,0.18)',
                      opacity: 0.85,
                    }}>YOU ARE HERE</span>
                  )}
                </div>
              ))}

              <div style={{
                marginTop: 30,
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 14,
                padding: '12px 14px',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 6px 24px rgba(40,20,30,0.18)',
              }}>
                <Avatar name="M" size={38} tokens={tokens}/>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: tokens.fontHead, fontSize: 17, fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.18)',
                  }}>@marigold</div>
                  <div style={{
                    fontFamily: tokens.fontBody, fontSize: 12, color: 'rgba(255,255,255,0.85)',
                    fontWeight: 600,
                    textShadow: '0 1px 2px rgba(0,0,0,0.18)',
                  }}>Tap to log out</div>
                </div>
                <Icon name="logout" size={16} color="#fff" />
              </div>
            </div>
          </GradientFrame>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DProfile, DMobile });
