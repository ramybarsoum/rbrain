import Link from 'next/link';
import { getGraphData } from '@/lib/operations';
import ForceGraph from '@/components/ForceGraph';

export const dynamic = 'force-dynamic';

// Types worth filtering on in the graph
const TYPE_FILTERS = ['all', 'person', 'company', 'meeting', 'decision', 'concept', 'thought', 'learning'];

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; limit?: string }>;
}) {
  const { type, limit } = await searchParams;
  const data = await getGraphData({
    type: type === 'all' || !type ? undefined : type,
    limit: limit ? parseInt(limit) : 500,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: 'calc(-1 * var(--s-6)) calc(-1 * var(--s-8))', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: '8px var(--s-5)', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-secondary)' }}>
        <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
          <span style={{ color: 'var(--fg-strong)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{data.nodes.length}</span> nodes ·{' '}
          <span style={{ color: 'var(--fg-strong)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{data.links.length}</span> edges
        </span>
        <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(t => (
            <Link
              key={t}
              href={t === 'all' ? '/graph' : `/graph?type=${t}`}
              className={`feed-chip${(t === 'all' && !type) || type === t ? ' active' : ''}`}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ForceGraph nodes={data.nodes} links={data.links} />
      </div>
    </div>
  );
}
