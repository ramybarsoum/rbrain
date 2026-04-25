import Link from 'next/link';
import { listPages, getPageTypes } from '@/lib/operations';

export const dynamic = 'force-dynamic';

// Color per type — falls back to fg-muted for unknown types
const TYPE_COLOR: Record<string, string> = {
  person:                'var(--type-person)',
  company:               'var(--type-company)',
  meeting:               'var(--type-meeting)',
  meeting_note:          'var(--type-meeting)',
  decision:              'var(--type-decision)',
  thought_decision:      'var(--type-decision)',
  idea:                  'var(--type-idea)',
  thought_idea:          'var(--type-idea)',
  thought_feature_request: 'var(--type-idea)',
  feature_request:       'var(--type-idea)',
  concept:               '#8b5cf6',
  topic:                 '#8b5cf6',
  learning:              'var(--success)',
  thought_learning:      'var(--success)',
  thought:               'var(--info)',
  thought_follow_up:     'var(--info)',
  project_update:        'var(--fg-subtle)',
  todo:                  'var(--info)',
};

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tag?: string }>;
}) {
  const { type, tag } = await searchParams;
  const [pages, allTypes] = await Promise.all([
    listPages({ type, tag, limit: 200 }),
    getPageTypes(),
  ]);

  // Top 10 types for filter chips
  const topTypes = allTypes.slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pages</h1>
          <p className="page-sub">
            {pages.length} shown
            {type ? ` · ${type}` : ` · ${allTypes.reduce((s, t) => s + t.count, 0).toLocaleString()} total`}
            {tag ? ` · #${tag}` : ''}
          </p>
        </div>
      </div>

      {/* Type filter chips — dynamic from DB */}
      <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-5)', flexWrap: 'wrap' }}>
        <Link href="/pages" className={`feed-chip${!type ? ' active' : ''}`}>
          All
        </Link>
        {topTypes.map(t => (
          <Link
            key={t.type}
            href={`/pages?type=${t.type}`}
            className={`feed-chip${type === t.type ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[t.type] ?? 'var(--fg-muted)', flexShrink: 0, display: 'inline-block' }}></span>
            {t.type}
            <span className="mono" style={{ fontSize: 10, color: type === t.type ? 'var(--accent)' : 'var(--fg-disabled)' }}>
              {t.count.toLocaleString()}
            </span>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
        <table className="rb-table">
          <thead>
            <tr>
              <th style={{ width: 160 }}>Type</th>
              <th>Title</th>
              <th style={{ width: 260 }}>Slug</th>
              <th style={{ width: 110, textAlign: 'right' }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(pages as any[]).map((p) => (
              <tr key={`${p.slug}-${p.id}`}>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 500,
                    color: TYPE_COLOR[p.type] ?? 'var(--fg-muted)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[p.type] ?? 'var(--fg-disabled)', flexShrink: 0 }}></span>
                    {p.type}
                  </span>
                </td>
                <td style={{ color: 'var(--fg-strong)', fontWeight: 500 }}>
                  {p.title || <span style={{ color: 'var(--fg-disabled)', fontStyle: 'italic' }}>untitled</span>}
                </td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.slug}
                </td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {new Date(p.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages.length === 0 && (
          <div style={{ padding: 'var(--s-8)', textAlign: 'center', fontSize: 13, color: 'var(--fg-subtle)' }}>
            No pages found.
          </div>
        )}
      </div>
    </>
  );
}
