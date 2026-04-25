import { search, getPageTypes } from '@/lib/operations';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const TYPE_COLOR: Record<string, string> = {
  person:   'var(--type-person)',  company:  'var(--type-company)',
  meeting:  'var(--type-meeting)', decision: 'var(--type-decision)',
  idea:     'var(--type-idea)',    thought:  'var(--info)',
  learning: 'var(--success)',      note:     'var(--type-note)',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const [results, allTypes] = await Promise.all([
    q ? search(q, { limit: 20, type }) : Promise.resolve([]),
    getPageTypes(),
  ]);

  const topTypes = allTypes.slice(0, 8);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Search</h1>
          <p className="page-sub">Full-text search across your brain.</p>
        </div>
      </div>

      {/* Search bar */}
      <form method="get" style={{ marginBottom: 'var(--s-5)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
          background: 'var(--surface)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-lg)', padding: '10px var(--s-4)',
        }}>
          <i className="ph ph-magnifying-glass" style={{ fontSize: 18, color: 'var(--fg-muted)', flexShrink: 0 }}></i>
          <input
            name="q" defaultValue={q ?? ''}
            placeholder="Search ideas, people, decisions, meetings…"
            autoFocus={!q}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--fg-strong)', fontFamily: 'var(--font-sans)',
            }}
          />
          {q && (
            <Link href="/search" style={{ fontSize: 12, color: 'var(--fg-subtle)', textDecoration: 'none' }}>
              Clear
            </Link>
          )}
          <button type="submit" className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
            Search
          </button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--s-5)' }}>
        {/* Filter sidebar */}
        <aside>
          <div style={{ marginBottom: 'var(--s-5)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Type</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Link href={q ? `/search?q=${encodeURIComponent(q)}` : '/search'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--r-xs)', textDecoration: 'none', background: !type ? 'var(--accent-soft)' : 'transparent', color: !type ? 'var(--accent)' : 'var(--fg-muted)', fontSize: 13 }}>
                All types
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-subtle)' }}>{allTypes.reduce((s, t) => s + t.count, 0).toLocaleString()}</span>
              </Link>
              {topTypes.map(t => (
                <Link key={t.type}
                  href={`/search?${q ? `q=${encodeURIComponent(q)}&` : ''}type=${t.type}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--r-xs)', textDecoration: 'none', background: type === t.type ? 'var(--accent-soft)' : 'transparent', color: type === t.type ? 'var(--accent)' : 'var(--fg-muted)', fontSize: 13 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[t.type] ?? 'var(--fg-disabled)', flexShrink: 0, display: 'inline-block' }}></span>
                  {t.type}
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-subtle)' }}>{t.count.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div>
          {!q ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13, paddingTop: 'var(--s-4)' }}>
              Type a query above to search your brain.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', fontSize: 12, color: 'var(--fg-muted)', marginBottom: 'var(--s-4)' }}>
                <span><span className="mono" style={{ color: 'var(--fg)' }}>{(results as any[]).length}</span> results for <span className="mono" style={{ color: 'var(--fg)' }}>"{q}"</span></span>
              </div>
              {(results as any[]).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No results found. Try a different query.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--s-3)' }}>
                  {(results as any[]).map((r: any) => (
                    <div key={r.slug} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--s-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: TYPE_COLOR[r.type] ?? 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[r.type] ?? 'var(--fg-disabled)', display: 'inline-block' }}></span>
                          {r.type}
                        </span>
                        <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                          {Number(r.score).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-strong)', letterSpacing: '-0.005em', lineHeight: 1.35 }}>
                        {r.title || r.slug}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {String(r.chunk_text).slice(0, 200)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', marginTop: 'auto' }}>{r.slug}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
