// redesign-v4-editor.jsx — Editor page for Variation D
//
// Layout: transparent navbar over gradient + a floating cream "app panel"
// containing { sidebar | toolbar + canvas (with row checkboxes + progress bar) |
// right panel (yarn estimator OR image-import controls) }.
//
// Tutorial integration: every element the existing TutorialSpotlight targets
// has its matching `id` here (tutorial-grid-size, tutorial-pencil,
// tutorial-image-tools, tutorial-row-progress, tutorial-print, tutorial-login).
//
// Finished-size math: rendered explicitly from gridW × gridH and the user's
// gauge — NOT looked up from preset. See `FinishedSize` below; the formula is
// `cm = cells × 10 / gaugeSquaresPer10cm`, mirroring lib/yarnSettings.ts.

const { D_TOKENS: TDe, DNavbar: DNBe } = window;

// ── A sample pattern of filled cells for the grid preview (24×24) ──────
function makeGridState() {
  const W = 24, H = 24;
  const grid = Array.from({ length: H }, () => Array(W).fill(false));
  for (let x = 0; x < W; x++) { grid[0][x] = true; grid[H-1][x] = true; }
  for (let y = 0; y < H; y++) { grid[y][0] = true; grid[y][W-1] = true; }
  const motif = [
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0,0,0],
    [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,1,1,0,0,0],
    [0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,1,1,0,0],
    [0,1,0,0,1,1,0,0,0,1,1,0,0,1,1,0,1,1,0,1,0,0],
    [1,1,0,1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,0,1,1,0],
    [1,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0,1,0],
    [1,0,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,1,0],
    [1,0,0,0,1,1,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,0],
    [1,0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0,1],
    [1,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,1],
    [1,1,1,0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,1,1,1],
    [1,1,0,0,1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,0,1,1],
    [1,0,1,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,1,0,1],
    [1,0,0,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,0,0,1],
    [1,0,1,0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,1,0,1],
    [1,0,1,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,1,0,1],
    [0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,1,1,0],
    [0,0,1,1,0,0,1,1,0,1,1,1,1,1,0,0,1,1,0,1,0,0],
    [0,0,0,1,0,1,1,0,1,1,0,0,1,1,1,0,1,0,0,0,0,0],
    [0,0,1,1,1,1,0,0,1,0,1,1,0,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
  ];
  for (let y = 0; y < motif.length; y++) {
    for (let x = 0; x < motif[0].length; x++) {
      if (motif[y][x]) grid[y + 1][x + 1] = true;
    }
  }
  return grid;
}

// Per-row completion state — checkboxes use this. Rows are 1-indexed from the
// BOTTOM (filet conventions). User has checked off rows 1–12 already.
function makeRowProgress(H, currentRow) {
  return Array.from({ length: H }, (_, y) => {
    const rowNum = H - y; // top of svg = highest row
    return rowNum < currentRow;
  });
}

// ── The grid canvas itself, with checkbox column + progress strip ──────
function EditorGrid({ tokens }) {
  const grid = makeGridState();
  const W = grid[0].length, H = grid.length;
  const currentRow = 13;
  const cell = 22;
  const totalW = W * cell;
  const totalH = H * cell;
  const rowComplete = makeRowProgress(H, currentRow);
  const completedCount = rowComplete.filter(Boolean).length;
  const pct = Math.round((completedCount / H) * 100);

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: '#FFFCF6',
      borderRadius: 16,
      padding: 20,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 0 0 1px rgba(61,42,30,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)',
    }}>
      {/* Top: pattern label + legend + draw-mode toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: tokens.fontMono, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: tokens.muted, fontWeight: 700,
        }}>Pattern · 24 × 24</div>

        {/* Pencil / block / mesh draw-mode tool — tutorial: pencil */}
        <div id="tutorial-pencil" style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          background: tokens.card, border: `1px solid ${tokens.divider}`,
          borderRadius: 999, padding: 3,
        }}>
          {[
            { l: 'Block',  icon: 'block',  active: true },
            { l: 'Mesh',   icon: 'mesh',   active: false },
            { l: 'Eraser', icon: 'eraser', active: false },
          ].map((m) => (
            <span key={m.l} style={{
              padding: '5px 12px', borderRadius: 999,
              fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700,
              background: m.active ? tokens.textStrong : 'transparent',
              color: m.active ? tokens.card : tokens.mutedStrong,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {m.icon === 'block'  && <span style={{ width: 9, height: 9, background: m.active ? tokens.card : tokens.textStrong, borderRadius: 1, display: 'inline-block' }}/>}
              {m.icon === 'mesh'   && <span style={{ width: 9, height: 9, background: 'transparent', border: `1.5px solid ${m.active ? tokens.card : tokens.textStrong}`, borderRadius: 1, display: 'inline-block' }}/>}
              {m.icon === 'eraser' && <span style={{ width: 9, height: 9, background: 'transparent', border: `1.5px dashed ${tokens.muted}`, borderRadius: 1, display: 'inline-block' }}/>}
              {m.l}
            </span>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: tokens.fontMono, fontSize: 11, color: tokens.muted, fontWeight: 600,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, background: tokens.textStrong, borderRadius: 1 }}/>
            block
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, background: '#FFFCF6', border: `1px solid ${tokens.divider}`, borderRadius: 1 }}/>
            mesh
          </span>
          <span style={{ width: 1, height: 14, background: tokens.divider }}/>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, background: 'rgba(168,70,111,0.22)', border: `1px solid ${tokens.cta}`, borderRadius: 1 }}/>
            current row
          </span>
        </div>
      </div>

      {/* Main: row#-col | checkbox-col | grid */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 0,
      }}>
        <div style={{
          position: 'relative',
          paddingLeft: 0, paddingTop: 18,
          display: 'flex', alignItems: 'flex-start',
        }}>
          {/* Row numbers */}
          <div style={{
            position: 'relative', width: 26, marginTop: 18,
            height: totalH,
          }}>
            {Array.from({ length: H }).map((_, y) => {
              const rowNum = H - y;
              const showNum = rowNum % 5 === 0 || rowNum === 1 || rowNum === currentRow;
              const isCurrent = rowNum === currentRow;
              return (
                <span key={y} style={{
                  position: 'absolute', top: y * cell, height: cell, width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 6,
                  fontFamily: tokens.fontMono, fontSize: 10,
                  color: isCurrent ? tokens.cta : tokens.muted,
                  fontWeight: isCurrent ? 700 : 500,
                  opacity: showNum ? 1 : 0,
                }}>{rowNum}</span>
              );
            })}
          </div>

          {/* Row-complete checkboxes (per row, beside row number) */}
          <div id="tutorial-row-progress" style={{
            position: 'relative', width: 22, marginRight: 6, marginTop: 18,
            height: totalH,
          }}>
            {Array.from({ length: H }).map((_, y) => {
              const rowNum = H - y;
              const checked = rowComplete[y];
              const isCurrent = rowNum === currentRow;
              return (
                <span key={y} style={{
                  position: 'absolute', top: y * cell, height: cell, width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 4,
                    border: `1.5px solid ${checked ? tokens.cta : isCurrent ? tokens.cta : tokens.divider}`,
                    background: checked ? tokens.cta : isCurrent ? 'rgba(168,70,111,0.10)' : '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}>
                    {checked && (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1.5 4.5 L3.7 6.7 L7.5 2.5"/>
                      </svg>
                    )}
                  </span>
                </span>
              );
            })}
          </div>

          {/* Grid area with column numbers above */}
          <div style={{ position: 'relative' }}>
            {/* Column numbers */}
            <div style={{
              height: 14, display: 'flex',
              fontFamily: tokens.fontMono, fontSize: 10,
              color: tokens.muted, marginBottom: 4,
            }}>
              {Array.from({ length: W }).map((_, x) => (
                <span key={x} style={{
                  width: cell, textAlign: 'center',
                  opacity: (x + 1) % 5 === 0 || x === 0 ? 0.85 : 0,
                  fontWeight: 600,
                }}>{x + 1}</span>
              ))}
            </div>
            {/* SVG grid */}
            <svg width={totalW} height={totalH} style={{ display: 'block' }}>
              <rect x={0} y={(H - currentRow) * cell} width={totalW} height={cell} fill="rgba(168,70,111,0.10)"/>
              {Array.from({ length: W + 1 }).map((_, x) => (
                <line key={`v${x}`} x1={x * cell} y1={0} x2={x * cell} y2={totalH}
                  stroke={x % 5 === 0 ? 'rgba(61,42,30,0.32)' : 'rgba(61,42,30,0.12)'}
                  strokeWidth={x % 5 === 0 ? 1.2 : 0.7}/>
              ))}
              {Array.from({ length: H + 1 }).map((_, y) => (
                <line key={`h${y}`} x1={0} y1={y * cell} x2={totalW} y2={y * cell}
                  stroke={y % 5 === 0 ? 'rgba(61,42,30,0.32)' : 'rgba(61,42,30,0.12)'}
                  strokeWidth={y % 5 === 0 ? 1.2 : 0.7}/>
              ))}
              {grid.map((row, y) => row.map((on, x) => on ? (
                <rect key={`${x}-${y}`}
                  x={x * cell + 1} y={y * cell + 1}
                  width={cell - 2} height={cell - 2}
                  fill={tokens.textStrong}/>
              ) : null))}
              <rect x={0.5} y={(H - currentRow) * cell + 0.5}
                width={totalW - 1} height={cell - 1}
                fill="none" stroke={tokens.cta} strokeWidth={1.5} strokeDasharray="3,2"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom: progress bar + counts */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700,
          marginBottom: 6,
        }}>
          <span style={{ color: tokens.textStrong }}>
            <span style={{ color: tokens.cta }}>{completedCount}</span>
            <span style={{ color: tokens.muted, fontWeight: 600 }}> / {H} rows complete</span>
          </span>
          <span style={{ color: tokens.muted, fontWeight: 600, fontFamily: tokens.fontMono, fontSize: 11 }}>
            {pct}% · row {currentRow}
          </span>
        </div>
        <div style={{
          height: 8, borderRadius: 999,
          background: 'rgba(168,70,111,0.10)',
          overflow: 'hidden',
          border: `1px solid ${tokens.divider}`,
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${tokens.cta}, #C7649B)`,
            borderRadius: 999,
          }}/>
        </div>
        <div style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted, fontWeight: 600,
        }}>
          <span>
            <strong style={{ color: tokens.textStrong, fontWeight: 700 }}>248</strong> blocks ·{' '}
            <strong style={{ color: tokens.textStrong, fontWeight: 700 }}>328</strong> mesh squares
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button style={iconBtn(tokens)}><Icon name="plus" size={12}/></button>
            <span style={{ minWidth: 36, textAlign: 'center' }}>100%</span>
            <button style={iconBtn(tokens)}><span style={{ display: 'inline-block', width: 10, height: 1.5, background: tokens.text }}/></button>
          </span>
        </div>
      </div>
    </div>
  );
}

const iconBtn = (tokens) => ({
  width: 24, height: 24, borderRadius: 6,
  background: tokens.card, border: `1px solid ${tokens.divider}`,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: tokens.text,
});

// ── Sidebar — pattern list. No duplicate user footer; the avatar in the
// global navbar is the single source of truth for "who you are".
function EditorSidebar({ tokens }) {
  const patterns = [
    { name: 'Cottage rose square', pub: true,  updated: 'Saved · today, 2:14 PM', active: true },
    { name: 'Tideline trim',       pub: true,  updated: 'Saved · yesterday' },
    { name: 'Linden leaf border',  pub: true,  updated: 'Saved · Mar 6' },
    { name: 'Garden window',       pub: false, updated: 'Saved · Feb 28' },
    { name: 'Honeycomb mesh',      pub: false, updated: 'Saved · Feb 21' },
    { name: 'Pinwheel star',       pub: true,  updated: 'Saved · Feb 18' },
    { name: 'Granny\'s hearts',    pub: false, updated: 'Saved · Feb 14' },
    { name: 'Sampler cross',       pub: true,  updated: 'Saved · Feb 9' },
  ];
  return (
    <aside style={{
      width: 244, flexShrink: 0,
      borderRight: `1px solid ${tokens.divider}`,
      display: 'flex', flexDirection: 'column',
      background: 'transparent',
    }}>
      <div style={{
        padding: '18px 18px 14px',
        borderBottom: `1px solid ${tokens.divider}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: tokens.fontMono, fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: tokens.muted, fontWeight: 700, marginBottom: 2,
          }}>Your library</div>
          <div style={{
            fontFamily: tokens.fontHead, fontSize: 18, fontWeight: 700,
            color: tokens.textStrong, letterSpacing: '-0.01em',
          }}>Patterns</div>
        </div>
        <button style={{
          background: tokens.cta, color: tokens.ctaText, border: 'none',
          padding: '6px 10px', borderRadius: 999,
          fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(168,70,111,0.30)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Icon name="plus" size={11}/> New
        </button>
      </div>

      {/* search */}
      <div style={{ padding: '10px 12px 6px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          width: '100%',
          background: tokens.card, borderRadius: 999, padding: '6px 12px',
          border: `1px solid ${tokens.divider}`,
          fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted, fontWeight: 500,
        }}>
          <Icon name="search" size={13} color={tokens.muted} />
          Search patterns…
        </div>
      </div>

      <div style={{ padding: '4px 8px 14px', flex: 1, overflow: 'hidden' }}>
        {patterns.map((p) => (
          <div key={p.name} style={{
            padding: '9px 12px',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: p.active ? 'rgba(168,70,111,0.10)' : 'transparent',
            border: p.active ? `1px solid rgba(168,70,111,0.30)` : '1px solid transparent',
            marginBottom: 2,
            cursor: 'pointer',
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontFamily: tokens.fontBody, fontSize: 13, fontWeight: p.active ? 700 : 600,
                color: p.active ? tokens.textStrong : tokens.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{p.name}</div>
              <div style={{
                fontFamily: tokens.fontMono, fontSize: 10, color: tokens.muted, marginTop: 2,
                fontWeight: 500,
              }}>
                {p.pub && <span style={{ color: tokens.cta, fontWeight: 700 }}>Public · </span>}
                {p.updated}
              </div>
            </div>
            {p.pub ? <Icon name="globe" size={12} color={tokens.muted}/> : <Icon name="lock" size={12} color={tokens.muted}/>}
          </div>
        ))}
      </div>
    </aside>
  );
}

// ── Yarn estimator — finished-size math is RENDERED, not stored ─────────
function YarnPanel({ tokens, gridW = 24, gridH = 24, gaugePer10cm = 6 }) {
  // Mirrors lib/yarnSettings.ts: finished cm = cells × 10 / gauge
  const widthCm  = (gridW / gaugePer10cm) * 10;
  const heightCm = (gridH / gaugePer10cm) * 10;
  const widthIn  = widthCm / 2.54;
  const heightIn = heightCm / 2.54;

  return (
    <aside style={{
      width: 296, flexShrink: 0,
      borderLeft: `1px solid ${tokens.divider}`,
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 18,
      overflowY: 'auto',
    }}>
      <div>
        <div style={{
          fontFamily: tokens.fontMono, fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: tokens.muted, fontWeight: 700, marginBottom: 2,
        }}>Estimator</div>
        <div style={{
          fontFamily: tokens.fontHead, fontSize: 22, fontWeight: 700,
          color: tokens.textStrong, letterSpacing: '-0.01em',
        }}>Yarn needed</div>
      </div>

      {/* Big yarn estimate */}
      <div style={{
        background: tokens.pillBg, borderRadius: 14,
        padding: '18px',
        border: `1px solid rgba(168,70,111,0.18)`,
      }}>
        <div style={{
          fontFamily: tokens.fontHead, fontWeight: 700, fontSize: 38,
          color: tokens.cta, lineHeight: 1, letterSpacing: '-0.02em',
        }}>~ 168<span style={{ fontSize: 18, fontWeight: 600 }}>g</span></div>
        <div style={{
          fontFamily: tokens.fontBody, fontSize: 12, color: tokens.pillText,
          marginTop: 6, fontWeight: 600,
        }}>about 420 m · 1 skein of DK cotton</div>
      </div>

      {/* Yarn settings — these feed both estimates AND finished size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { l: 'Weight', v: 'DK (light worsted)' },
          { l: 'Hook',   v: '3.5 mm' },
          { l: 'Gauge',  v: `${gaugePer10cm} squares / 10 cm`, accent: true },
        ].map((row) => (
          <div key={row.l} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            background: tokens.card, borderRadius: 10,
            border: `1px solid ${row.accent ? 'rgba(168,70,111,0.30)' : tokens.divider}`,
          }}>
            <span style={{
              fontFamily: tokens.fontBody, fontSize: 12,
              color: row.accent ? tokens.cta : tokens.muted, fontWeight: 700,
              letterSpacing: row.accent ? '0.04em' : '0',
              textTransform: row.accent ? 'uppercase' : 'none',
            }}>{row.l}</span>
            <span style={{ fontFamily: tokens.fontBody, fontSize: 13, color: tokens.textStrong, fontWeight: 700 }}>{row.v}</span>
          </div>
        ))}
      </div>

      {/* Finished size — math is rendered live, derived from grid + gauge */}
      <FinishedSize tokens={tokens} gridW={gridW} gridH={gridH}
        gaugePer10cm={gaugePer10cm}
        widthCm={widthCm} heightCm={heightCm}
        widthIn={widthIn} heightIn={heightIn}/>

      <div style={{
        marginTop: 'auto',
        background: '#FFFBF1', borderRadius: 10,
        padding: '10px 12px',
        border: `1px dashed ${tokens.divider}`,
        fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted, lineHeight: 1.5, fontWeight: 500,
      }}>
        <strong style={{ color: tokens.text, fontWeight: 700 }}>Tip:</strong> estimates assume ~5% loss for turning chains and weaving in ends.
      </div>
    </aside>
  );
}

function FinishedSize({ tokens, gridW, gridH, gaugePer10cm, widthCm, heightCm, widthIn, heightIn }) {
  const fmt = (n) => Number(n.toFixed(1)).toString();
  return (
    <div>
      <div style={{
        fontFamily: tokens.fontMono, fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: tokens.muted, fontWeight: 700, marginBottom: 8,
      }}>Finished size</div>
      <div style={{
        fontFamily: tokens.fontHead, fontSize: 26, fontWeight: 700,
        color: tokens.textStrong, letterSpacing: '-0.01em', lineHeight: 1,
      }}>{fmt(widthCm)} × {fmt(heightCm)}<span style={{ fontSize: 16, fontWeight: 600, color: tokens.muted, marginLeft: 6 }}>cm</span></div>
      <div style={{
        fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted, marginTop: 2, fontWeight: 600,
      }}>≈ {fmt(widthIn)} × {fmt(heightIn)} in</div>

      {/* Math shown explicitly so it works for ANY grid size, preset or custom. */}
      <div style={{
        marginTop: 10, padding: '10px 12px',
        background: '#FFF8E8',
        border: `1px solid ${tokens.divider}`,
        borderRadius: 10,
        fontFamily: tokens.fontMono, fontSize: 11, color: tokens.text, fontWeight: 500,
        lineHeight: 1.55,
      }}>
        <div style={{ color: tokens.muted, marginBottom: 4 }}>
          width = grid<sub>W</sub> × 10 ÷ gauge
        </div>
        <div>
          <span style={{ color: tokens.cta, fontWeight: 700 }}>{gridW}</span>
          <span style={{ color: tokens.muted }}> × 10 ÷ </span>
          <span style={{ color: tokens.cta, fontWeight: 700 }}>{gaugePer10cm}</span>
          <span style={{ color: tokens.muted }}> = </span>
          <span style={{ color: tokens.textStrong, fontWeight: 700 }}>{fmt(widthCm)} cm</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <span style={{ color: tokens.cta, fontWeight: 700 }}>{gridH}</span>
          <span style={{ color: tokens.muted }}> × 10 ÷ </span>
          <span style={{ color: tokens.cta, fontWeight: 700 }}>{gaugePer10cm}</span>
          <span style={{ color: tokens.muted }}> = </span>
          <span style={{ color: tokens.textStrong, fontWeight: 700 }}>{fmt(heightCm)} cm</span>
        </div>
      </div>
    </div>
  );
}

// ── Top toolbar inside the app panel ────────────────────────────────────
function EditorToolbar({ tokens, savedAt = 'a moment ago' }) {
  const btn = {
    background: tokens.card, color: tokens.text,
    border: `1px solid ${tokens.divider}`,
    padding: '7px 13px', borderRadius: 999,
    fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  };
  const ctaBtn = {
    ...btn,
    background: tokens.cta, color: tokens.ctaText,
    border: `1px solid ${tokens.cta}`,
    boxShadow: '0 4px 14px rgba(168,70,111,0.30)',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px',
      borderBottom: `1px solid ${tokens.divider}`,
      gap: 16, flexWrap: 'wrap',
    }}>
      {/* Left: name + save indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: tokens.fontMono, fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: tokens.muted, fontWeight: 700,
          }}>Editing</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: tokens.fontHead, fontSize: 22, fontWeight: 700,
            color: tokens.textStrong, letterSpacing: '-0.01em',
          }}>
            Cottage rose square
            <button style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: tokens.muted, padding: 0,
            }}><Icon name="pencil" size={13} color={tokens.muted}/></button>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(20,140,80,0.10)',
              fontFamily: tokens.fontMono, fontSize: 10,
              color: '#1F7A4E', fontWeight: 700, letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border: '1px solid rgba(20,140,80,0.20)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1F7A4E' }}/>
              Saved {savedAt}
            </span>
          </div>
        </div>
      </div>

      {/* Middle: grid sizing — tutorial: grid-size */}
      <div id="tutorial-grid-size" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 4px 4px 12px', borderRadius: 999,
          background: tokens.card, border: `1px solid ${tokens.divider}`,
          fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 600,
          color: tokens.muted,
        }}>
          Preset
          <span style={{
            background: '#fff', borderRadius: 999, padding: '4px 10px',
            color: tokens.textStrong, fontWeight: 700, fontSize: 12,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: `1px solid ${tokens.divider}`,
          }}>
            Pillow front 40×40
            <Icon name="chevron-down" size={11} color={tokens.muted}/>
          </span>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: tokens.card, border: `1px solid ${tokens.divider}`,
          borderRadius: 999, padding: 2,
        }}>
          <span style={{ padding: '4px 10px', fontFamily: tokens.fontBody, fontSize: 11, color: tokens.muted, fontWeight: 700 }}>W</span>
          <span style={{ background: '#fff', borderRadius: 999, padding: '4px 10px', fontFamily: tokens.fontMono, fontSize: 12, fontWeight: 700, color: tokens.textStrong, border: `1px solid ${tokens.divider}` }}>24</span>
          <button style={{ background: 'transparent', border: 'none', padding: '0 8px', cursor: 'pointer', color: tokens.cta }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="12" height="8" rx="1.5" />
              <path d="M5 7V5a3 3 0 016 0v2" />
            </svg>
          </button>
          <span style={{ padding: '4px 10px', fontFamily: tokens.fontBody, fontSize: 11, color: tokens.muted, fontWeight: 700 }}>H</span>
          <span style={{ background: '#fff', borderRadius: 999, padding: '4px 10px', fontFamily: tokens.fontMono, fontSize: 12, fontWeight: 700, color: tokens.textStrong, border: `1px solid ${tokens.divider}` }}>24</span>
        </div>
      </div>

      {/* Right: row controls + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button style={btn} title="Undo">Undo</button>
        <button style={{ ...btn, opacity: 0.5 }}>Redo</button>
        <span style={{ width: 1, height: 22, background: tokens.divider, margin: '0 4px' }}/>
        <button style={btn}>← Row</button>
        <button style={btn}>Row →</button>
        <span style={{ width: 1, height: 22, background: tokens.divider, margin: '0 4px' }}/>
        <button id="tutorial-print" style={btn}><Icon name="copy" size={12}/> Print</button>
        <button style={ctaBtn}>Save</button>
      </div>
    </div>
  );
}

// ── Mode bar (Draw / Import image / Row tracker) ────────────────────────
function EditorModeBar({ tokens, mode = 'draw' }) {
  const tabs = [
    { l: 'Draw',         icon: 'pencil', key: 'draw' },
    { l: 'Import image', icon: 'plus',   key: 'import' },
    { l: 'Row tracker',  icon: 'book',   key: 'rows' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px',
      borderBottom: `1px solid ${tokens.divider}`,
      background: 'rgba(168,70,111,0.04)',
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {tabs.map((t) => (
          <span key={t.key} style={{
            padding: '7px 14px', borderRadius: 999,
            fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700,
            background: t.key === mode ? tokens.textStrong : 'transparent',
            color: t.key === mode ? tokens.card : tokens.mutedStrong,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name={t.icon} size={12} color={t.key === mode ? tokens.card : tokens.mutedStrong}/>
            {t.l}
          </span>
        ))}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        fontFamily: tokens.fontBody, fontSize: 12, color: tokens.muted, fontWeight: 600,
      }}>
        <span>Row <strong style={{ color: tokens.cta, fontWeight: 700 }}>13</strong> of 24</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: tokens.card, border: `1px solid ${tokens.divider}`,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: tokens.cta }}/>
          {mode === 'import' ? 'Tune crop, opacity & threshold below' : 'Click cells to toggle block / mesh'}
        </span>
      </div>
    </div>
  );
}

// ── Image-Import panel — replaces the YarnPanel when in Import mode ─────
// Mirrors the actual ImageTools controls: upload, crop (expandable), pan,
// underlay opacity, threshold (with auto), dark/light toggle, apply.
function ImageImportPanel({ tokens }) {
  return (
    <aside id="tutorial-image-tools" style={{
      width: 320, flexShrink: 0,
      borderLeft: `1px solid ${tokens.divider}`,
      padding: 18,
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto',
    }}>
      <div>
        <div style={{
          fontFamily: tokens.fontMono, fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: tokens.muted, fontWeight: 700, marginBottom: 2,
        }}>Reference image</div>
        <div style={{
          fontFamily: tokens.fontHead, fontSize: 20, fontWeight: 700,
          color: tokens.textStrong, letterSpacing: '-0.01em',
        }}>Import & convert</div>
      </div>

      {/* File row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: tokens.card, borderRadius: 10,
        border: `1px solid ${tokens.divider}`,
      }}>
        <span style={{
          flex: 1, minWidth: 0,
          fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 600,
          color: tokens.textStrong,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>cottage-rose.jpg</span>
        <button style={{
          background: tokens.pillBg, color: tokens.pillText,
          border: `1px solid rgba(168,70,111,0.25)`,
          padding: '4px 10px', borderRadius: 999,
          fontFamily: tokens.fontBody, fontSize: 11, fontWeight: 700,
          cursor: 'pointer',
        }}>Replace</button>
        <button style={{
          background: 'transparent', color: tokens.muted,
          border: 'none', cursor: 'pointer', padding: 4,
          fontFamily: tokens.fontBody, fontSize: 11, fontWeight: 700,
        }}>Clear</button>
      </div>

      {/* Crop preview */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span style={{
            fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700, color: tokens.textStrong,
          }}>Crop</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{
              background: tokens.cta, color: tokens.ctaText, border: 'none',
              padding: '3px 10px', borderRadius: 999,
              fontFamily: tokens.fontBody, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}>Apply crop</button>
            <button style={{
              background: 'transparent', color: tokens.muted,
              border: `1px solid ${tokens.divider}`,
              padding: '3px 10px', borderRadius: 999,
              fontFamily: tokens.fontBody, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}>Reset</button>
            <button style={{
              background: tokens.card, color: tokens.text,
              border: `1px solid ${tokens.divider}`,
              padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
              fontFamily: tokens.fontBody, fontSize: 10, fontWeight: 700,
            }}>⤢</button>
          </div>
        </div>
        {/* Crop canvas mock */}
        <div style={{
          position: 'relative',
          aspectRatio: '7/4',
          background: 'linear-gradient(135deg, #C99B7A 0%, #A8634A 100%)',
          borderRadius: 10,
          overflow: 'hidden',
          border: `1px solid ${tokens.divider}`,
        }}>
          {/* darker rose silhouette pattern */}
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }}>
            <circle cx="50" cy="30" r="14" fill="#3a1a1a"/>
            <circle cx="42" cy="22" r="6"  fill="#3a1a1a"/>
            <circle cx="58" cy="22" r="6"  fill="#3a1a1a"/>
            <circle cx="42" cy="38" r="6"  fill="#3a1a1a"/>
            <circle cx="58" cy="38" r="6"  fill="#3a1a1a"/>
            <circle cx="50" cy="14" r="6"  fill="#3a1a1a"/>
            <circle cx="50" cy="46" r="6"  fill="#3a1a1a"/>
            <circle cx="34" cy="30" r="6"  fill="#3a1a1a"/>
            <circle cx="66" cy="30" r="6"  fill="#3a1a1a"/>
          </svg>
          {/* dim overlay outside crop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}/>
          {/* crop window with handles */}
          <div style={{
            position: 'absolute', top: '14%', left: '18%', right: '18%', bottom: '14%',
            boxShadow: '0 0 0 9999px transparent',
            border: '1.5px solid #fff',
            background: 'transparent',
          }}>
            {/* clear the inside */}
            <div style={{
              position: 'absolute', inset: 0,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
            }}/>
            {/* rule-of-thirds */}
            <div style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.45)' }}/>
            <div style={{ position: 'absolute', top: '67%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.45)' }}/>
            <div style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.45)' }}/>
            <div style={{ position: 'absolute', left: '67%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.45)' }}/>
            {/* handles */}
            {[
              { t: -4, l: -4 }, { t: -4, r: -4 }, { b: -4, l: -4 }, { b: -4, r: -4 },
              { t: -4, l: '50%', mx: -4 }, { b: -4, l: '50%', mx: -4 },
              { l: -4, t: '50%', my: -4 }, { r: -4, t: '50%', my: -4 },
            ].map((h, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: h.t, left: h.l, right: h.r, bottom: h.b,
                width: 8, height: 8, background: '#fff', borderRadius: 1,
                transform: `translate(${h.mx ?? 0}px, ${h.my ?? 0}px)`,
              }}/>
            ))}
          </div>
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: tokens.fontMono, fontSize: 10, color: tokens.muted, fontWeight: 500,
        }}>Applied 64% × 72% · pan 2%, -4%</div>
      </div>

      {/* Mode */}
      <div>
        <div style={{
          fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700,
          color: tokens.textStrong, marginBottom: 6,
        }}>Mode</div>
        <div style={{
          display: 'inline-flex',
          background: tokens.card, border: `1px solid ${tokens.divider}`,
          borderRadius: 999, padding: 3, width: '100%',
        }}>
          {['Underlay', 'Convert'].map((m, i) => (
            <span key={m} style={{
              flex: 1, padding: '6px 12px', borderRadius: 999, textAlign: 'center',
              fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700,
              background: i === 0 ? tokens.textStrong : 'transparent',
              color: i === 0 ? tokens.card : tokens.mutedStrong,
              cursor: 'pointer',
            }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Underlay opacity slider */}
      <SliderRow tokens={tokens} label="Underlay opacity" value={65} unit="%"/>

      {/* Threshold slider with Auto */}
      <SliderRow tokens={tokens}
        label="Threshold"
        sub={<><span style={{ color: tokens.muted, fontWeight: 500 }}>pixels below this value fill cells</span></>}
        value={140} max={255}
        rightAction={<button style={{
          background: tokens.pillBg, color: tokens.pillText,
          border: `1px solid rgba(168,70,111,0.25)`,
          padding: '2px 9px', borderRadius: 999,
          fontFamily: tokens.fontMono, fontSize: 10, fontWeight: 700, cursor: 'pointer',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Auto</button>}
      />

      {/* Dark/light toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: tokens.card, borderRadius: 10,
        border: `1px solid ${tokens.divider}`,
      }}>
        <span style={{
          fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700, color: tokens.textStrong,
        }}>Dark pixels become blocks</span>
        <span style={{
          width: 32, height: 18, borderRadius: 999,
          background: tokens.cta,
          position: 'relative', cursor: 'pointer',
        }}>
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 14, height: 14, borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}/>
        </span>
      </div>

      {/* Apply */}
      <button style={{
        marginTop: 'auto',
        background: tokens.cta, color: tokens.ctaText, border: 'none',
        padding: '12px 18px', borderRadius: 12,
        fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(168,70,111,0.30)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        Apply to grid <Icon name="arrow-right" size={14}/>
      </button>
      <div style={{
        fontFamily: tokens.fontBody, fontSize: 11, color: tokens.muted, lineHeight: 1.5, fontWeight: 500,
        marginTop: -6,
      }}>
        Crop and pan apply before conversion. Result merges as a normal edit — undo available.
      </div>
    </aside>
  );
}

function SliderRow({ tokens, label, sub, value, max = 100, unit = '', rightAction }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{
          fontFamily: tokens.fontBody, fontSize: 12, fontWeight: 700, color: tokens.textStrong,
        }}>{label} <span style={{ color: tokens.muted, fontFamily: tokens.fontMono, fontWeight: 600, marginLeft: 4 }}>({value}{unit})</span></span>
        {rightAction}
      </div>
      {sub && <div style={{
        fontFamily: tokens.fontBody, fontSize: 11, color: tokens.muted, marginBottom: 6, fontWeight: 500,
      }}>{sub}</div>}
      <div style={{
        position: 'relative', height: 6, borderRadius: 999,
        background: 'rgba(168,70,111,0.10)',
        border: `1px solid ${tokens.divider}`,
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 999,
          background: tokens.cta,
        }}/>
        <div style={{
          position: 'absolute', top: -5, left: `calc(${pct}% - 8px)`,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', border: `2px solid ${tokens.cta}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}/>
      </div>
    </div>
  );
}

// ── A tiny tutorial-spotlight callout, rendered on top to show how the
// existing TutorialSpotlight will sit on the new layout. Pure mockup —
// real one lives in components/TutorialSpotlight.tsx.
function TutorialSpotlightCallout({ tokens, step = 4, x, y, w = 240 }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w,
      background: tokens.card,
      borderRadius: 14, padding: '12px 14px 14px',
      boxShadow: '0 18px 50px rgba(40,20,30,0.30), 0 0 0 1px rgba(168,70,111,0.40)',
      zIndex: 50,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontFamily: tokens.fontMono, fontSize: 9, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: tokens.cta, fontWeight: 700,
        }}>Step {step} of 6 · tutorial</div>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', background: tokens.pillBg,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: tokens.pillText, fontSize: 11, fontWeight: 700,
        }}>×</span>
      </div>
      <div style={{
        fontFamily: tokens.fontHead, fontSize: 17, fontWeight: 700,
        color: tokens.textStrong, letterSpacing: '-0.01em', marginBottom: 4,
      }}>Track your progress</div>
      <div style={{
        fontFamily: tokens.fontBody, fontSize: 12.5, color: tokens.text, lineHeight: 1.5, fontWeight: 500,
      }}>Tick a row's checkbox as you finish it. The current row stays highlighted on the chart, and the bar below fills up.</div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 12,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2,3,4,5].map((i) => (
            <span key={i} style={{
              width: 14, height: 4, borderRadius: 2,
              background: i === step - 1 ? tokens.cta : tokens.divider,
            }}/>
          ))}
        </div>
        <button style={{
          background: tokens.cta, color: tokens.ctaText, border: 'none',
          padding: '5px 12px', borderRadius: 999,
          fontFamily: tokens.fontBody, fontSize: 11, fontWeight: 700,
          cursor: 'pointer',
        }}>Next →</button>
      </div>
    </div>
  );
}

// ── The editor page (Draw mode) ────────────────────────────────────────
function DEditor({ tokens = TDe, showTutorial = false, mode = 'draw' }) {
  return (
    <GradientFrame>
      <DNBe active="editor" tokens={tokens} />

      <div style={{
        position: 'absolute', inset: '88px 24px 24px',
        background: tokens.card,
        borderRadius: 22,
        boxShadow: '0 24px 60px rgba(40,20,30,0.25), 0 0 0 1px rgba(255,255,255,0.55)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <EditorToolbar tokens={tokens}/>
        <EditorModeBar tokens={tokens} mode={mode}/>
        <div style={{
          flex: 1, minHeight: 0,
          display: 'flex',
          position: 'relative',
        }}>
          <EditorSidebar tokens={tokens}/>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', padding: 18 }}>
            <EditorGrid tokens={tokens}/>
          </div>
          {mode === 'import' ? <ImageImportPanel tokens={tokens}/> : <YarnPanel tokens={tokens}/>}

          {showTutorial && (
            <TutorialSpotlightCallout tokens={tokens} step={4} x={310} y={28}/>
          )}
        </div>
      </div>
    </GradientFrame>
  );
}

// Variants exposed so the canvas can show Draw + Import + Tutorial side-by-side.
function DEditorImport({ tokens = TDe }) { return <DEditor tokens={tokens} mode="import"/>; }
function DEditorTutorial({ tokens = TDe }) { return <DEditor tokens={tokens} showTutorial={true}/>; }

Object.assign(window, { DEditor, DEditorImport, DEditorTutorial });
