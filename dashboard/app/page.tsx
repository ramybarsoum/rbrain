import { getStats, listPages } from '@/lib/operations';

export const dynamic = 'force-dynamic';

function scoreColor(pct: number) {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 60) return 'var(--accent)';
  if (pct >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

function scoreLabel(pct: number) {
  if (pct >= 85) return 'excellent';
  if (pct >= 70) return 'healthy';
  if (pct >= 50) return 'fair';
  return 'needs work';
}

function ringOffset(score: number) {
  const circumference = 2 * Math.PI * 85; // r=85
  return circumference - (score / 100) * circumference;
}

export default async function OverviewPage() {
  const [stats, recent] = await Promise.all([
    getStats(),
    listPages({ limit: 8, days: 7 }),
  ]);

  const pages = Number(stats.pages);
  const chunks = Number(stats.chunks);
  const links = Number(stats.links);
  const embedded = Number(stats.embedded_chunks);
  const timeline = Number(stats.timeline_entries);

  const embedPct   = chunks > 0 ? Math.round((embedded / chunks) * 100) : 0;
  const linkDensity = pages > 0 ? (links / pages).toFixed(2) : '0';
  const linkDensityNum = pages > 0 ? links / pages : 0;
  const linkScore  = Math.min(100, Math.round((linkDensityNum / 4.0) * 100));
  const timelinePct = pages > 0 ? Math.min(100, Math.round((timeline / pages) * 100)) : 0;

  // Weighted brain score: embed 35%, link 25%, timeline 15%, stub 25%
  const score = Math.round(
    embedPct * 0.35 +
    linkScore * 0.25 +
    timelinePct * 0.15 +
    Math.min(100, pages / 100) * 0.25
  );

  const gauges = [
    {
      name: 'Embed coverage', weight: '35%',
      val: embedPct, unit: '%',
      barPct: embedPct, barColor: embedPct > 80 ? 'var(--success)' : 'var(--accent)',
      meta: `${embedded.toLocaleString()} / ${chunks.toLocaleString()}`,
    },
    {
      name: 'Link density', weight: '25%',
      val: linkDensity, unit: 'e/n',
      barPct: linkScore, barColor: 'var(--accent)',
      meta: `target: 4.0`,
    },
    {
      name: 'Timeline coverage', weight: '15%',
      val: timelinePct, unit: '%',
      barPct: timelinePct, barColor: 'var(--accent)',
      meta: `${timeline.toLocaleString()} entries`,
    },
    {
      name: 'Pages indexed', weight: '25%',
      val: pages.toLocaleString(), unit: '',
      barPct: Math.min(100, pages / 100), barColor: 'var(--brand-400)',
      meta: `${links.toLocaleString()} links`,
    },
  ];

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Brain Health</h1>
          <p className="page-sub">Overall integrity of your knowledge graph.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--s-5)' }}>
        {/* Score card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          <div className="card-head">
            <div className="card-title">Health score</div>
            <div className="card-sub mono">{today}</div>
          </div>
          <div style={{ display: 'grid', placeItems: 'center', position: 'relative', padding: 'var(--s-3) 0' }}>
            <svg className="score-ring" width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="85" stroke="var(--surface-3)" strokeWidth="14" fill="none"/>
              <circle
                cx="100" cy="100" r="85"
                stroke={scoreColor(score)}
                strokeWidth="14" fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 85}`}
                strokeDashoffset={ringOffset(score)}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div>
                <div className="score-num">{score}</div>
                <div className="score-of">/ 100 · {scoreLabel(score)}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)', borderTop: '1px solid var(--separator)', paddingTop: 'var(--s-4)' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages</div>
              <div style={{ fontSize: 18, color: 'var(--fg-strong)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{pages.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Links</div>
              <div style={{ fontSize: 18, color: 'var(--fg-strong)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{links.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg degree</div>
              <div style={{ fontSize: 18, color: 'var(--fg-strong)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                {linkDensity}<span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 400, marginLeft: 4 }}>e/node</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline</div>
              <div style={{ fontSize: 18, color: 'var(--fg-strong)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                {timeline.toLocaleString()}<span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 400, marginLeft: 4 }}>entries</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
          {/* Gauges */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Score components</div>
              <div className="card-sub">Weighted contribution</div>
            </div>
            <div className="gauge-grid">
              {gauges.map((g) => (
                <div className="gauge" key={g.name}>
                  <div className="gauge-head">
                    <span className="gauge-name">{g.name}</span>
                    <span className="gauge-weight">{g.weight}</span>
                  </div>
                  <div className="gauge-val">{g.val}<span className="gauge-unit">{g.unit}</span></div>
                  <div className="gauge-bar">
                    <div className="gauge-fill" style={{ width: `${g.barPct}%`, background: g.barColor }}></div>
                  </div>
                  <div className="gauge-meta"><span>{g.meta}</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Updated this week</div>
              <div className="card-sub">{(recent as any[]).length} pages</div>
            </div>
            {(recent as any[]).length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Nothing updated in the last 7 days.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(recent as any[]).map((p) => (
                  <div key={p.slug} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: '9px 0', borderBottom: '1px solid var(--separator)' }}>
                    <span className={`type-pill t-${p.type}`}><span className="swatch"></span>{p.type}</span>
                    <span style={{ fontSize: 13, color: 'var(--fg-strong)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title || <span style={{ color: 'var(--fg-disabled)', fontStyle: 'italic' }}>untitled</span>}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0 }}>
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
