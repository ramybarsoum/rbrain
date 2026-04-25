import { listPages, getPersonDetail } from '@/lib/operations';

export const dynamic = 'force-dynamic';

function fmtDate(ts: string | null | undefined) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function PersonPanel({ slug }: { slug: string }) {
  const { page, outLinks, inLinks, timeline } = await getPersonDetail(slug);
  if (!page) return <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Person not found.</div>;

  const fm = page.frontmatter as Record<string, any> ?? {};

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--s-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-2)' }}>
          <span style={{ fontSize: 11, color: 'var(--type-person)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>person</span>
          {fm.v0_priority === 'high' && <span className="pill pill-warning">high priority</span>}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-strong)', letterSpacing: '-0.01em', margin: 0 }}>
          {page.title}
        </h2>
        {fm.v0_role && (
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>{fm.v0_role}</div>
        )}
      </div>

      {/* Properties */}
      <div className="card" style={{ marginBottom: 'var(--s-4)' }}>
        <div className="card-head"><div className="card-title">Properties</div></div>
        {[
          { k: 'Email',       v: fm.v0_email },
          { k: 'Company',     v: fm.v0_company },
          { k: 'Interactions', v: fm.v0_interaction_count != null ? String(fm.v0_interaction_count) : null },
          { k: 'First seen',  v: fmtDate(fm.v0_first_interaction) },
          { k: 'Last touch',  v: fmtDate(fm.v0_last_interaction ?? fm.v0_last_touched) },
        ].filter(r => r.v).map(({ k, v }) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 'var(--s-3)', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--separator)' }}>
            <span style={{ color: 'var(--fg-subtle)' }}>{k}</span>
            <span className="mono" style={{ color: 'var(--fg)' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Connections */}
      {(outLinks as any[]).length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--s-4)' }}>
          <div className="card-head">
            <div className="card-title">Connections</div>
            <div className="card-sub">{(outLinks as any[]).length}</div>
          </div>
          {(outLinks as any[]).map((l: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', padding: '6px 0', borderBottom: '1px solid var(--separator)' }}>
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)', width: 80, flexShrink: 0 }}>{l.link_type}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: `var(--type-${l.target_type})`, flexShrink: 0 }}>{l.target_type}</span>
              <span style={{ fontSize: 13, color: 'var(--fg-strong)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.target_title || l.target_slug}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {(timeline as any[]).length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Recent timeline</div>
            <div className="card-sub">{(timeline as any[]).length} entries</div>
          </div>
          {(timeline as any[]).map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--s-3)', padding: '7px 0', borderBottom: '1px solid var(--separator)', alignItems: 'flex-start' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0, width: 80 }}>{t.date}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-muted)', flex: 1, lineHeight: 1.45 }}>{t.summary}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; q?: string }>;
}) {
  const { slug: activeSlug, q } = await searchParams;
  const people = await listPages({ type: 'person', limit: 200 });

  // Filter client-side by search query
  const filtered = q
    ? (people as any[]).filter(p =>
        (p.title ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (p.frontmatter?.v0_company ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : (people as any[]);

  return (
    <div style={{ display: 'flex', height: '100%', margin: 'calc(-1 * var(--s-6)) calc(-1 * var(--s-8))', overflow: 'hidden' }}>
      {/* People list */}
      <aside style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
        {/* Search */}
        <div style={{ padding: 'var(--s-3) var(--s-3)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <form method="get">
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Search people…"
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '6px 10px',
                fontSize: 12, color: 'var(--fg)', fontFamily: 'var(--font-sans)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </form>
        </div>

        <div style={{ padding: '6px var(--s-4) 4px', fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0 }}>
          {filtered.length} of {people.length} people
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map((p: any) => {
            const fm = p.frontmatter ?? {};
            const isActive = p.slug === activeSlug;
            const interactions = fm.v0_interaction_count ?? 0;
            return (
              <a
                key={p.slug}
                href={`/people?slug=${encodeURIComponent(p.slug)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                style={{
                  display: 'block', padding: '8px var(--s-4)',
                  textDecoration: 'none',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                  <span style={{ fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--fg-strong)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {p.title || p.slug}
                  </span>
                  {interactions > 0 && (
                    <span className="mono" style={{ fontSize: 10, color: 'var(--fg-disabled)', flexShrink: 0 }}>{interactions}</span>
                  )}
                </div>
                {fm.v0_company && (
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 0 }}>
                    {fm.v0_company}
                  </div>
                )}
              </a>
            );
          })}
        </div>
      </aside>

      {/* Detail panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-8)' }}>
        {!activeSlug ? (
          <div style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>
            Select a person to see their profile, connections, and timeline.
          </div>
        ) : (
          <PersonPanel slug={activeSlug} />
        )}
      </div>
    </div>
  );
}
