import Link from 'next/link';
import { listPages } from '@/lib/operations';

export const dynamic = 'force-dynamic';

const TYPE_COLORS: Record<string, string> = {
  person:   'var(--type-person)',
  company:  'var(--type-company)',
  concept:  'var(--type-meeting)',
  decision: 'var(--type-decision)',
  note:     'var(--type-note)',
  guide:    'var(--accent)',
  analysis: 'var(--type-idea)',
  meeting:  'var(--type-meeting)',
  todo:     'var(--info)',
};

const TYPES = ['person', 'company', 'meeting', 'concept', 'decision', 'note', 'guide', 'analysis'];

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tag?: string }>;
}) {
  const { type, tag } = await searchParams;
  const pages = await listPages({ type, tag, limit: 200 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pages</h1>
          <p className="page-sub">{pages.length} shown{type ? ` · type: ${type}` : ''}{tag ? ` · tag: ${tag}` : ''}</p>
        </div>
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-5)', flexWrap: 'wrap' }}>
        <Link href="/pages" className={`feed-chip${!type ? ' active' : ''}`}>All</Link>
        {TYPES.map(t => (
          <Link key={t} href={`/pages?type=${t}`} className={`feed-chip${type === t ? ' active' : ''}`}>
            <span className={`type-pill t-${t}`} style={{ padding: 0, border: 'none', background: 'transparent' }}>
              <span className="swatch"></span>
            </span>
            {t}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
        <table className="rb-table">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Type</th>
              <th>Title</th>
              <th style={{ width: 240 }}>Slug</th>
              <th style={{ width: 110, textAlign: 'right' }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(pages as any[]).map((p) => (
              <tr key={p.slug}>
                <td>
                  <span className={`type-pill t-${p.type}`} style={{ color: TYPE_COLORS[p.type] ?? 'var(--fg-muted)' }}>
                    <span className="swatch"></span>{p.type}
                  </span>
                </td>
                <td style={{ color: 'var(--fg-strong)', fontWeight: 500 }}>
                  {p.title || <span style={{ color: 'var(--fg-disabled)', fontStyle: 'italic' }}>untitled</span>}
                </td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
