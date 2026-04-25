import Link from 'next/link';
import { getGraphData } from '@/lib/operations';
import ForceGraph from '@/components/ForceGraph';

export const dynamic = 'force-dynamic';

const TYPE_FILTERS = ['all', 'person', 'company', 'concept', 'decision', 'note'];

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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs text-zinc-500">
          {data.nodes.length} nodes · {data.links.length} edges
        </span>
        <div className="flex gap-1.5 ml-4">
          {TYPE_FILTERS.map(t => (
            <Link
              key={t}
              href={t === 'all' ? '/graph' : `/graph?type=${t}`}
              className={`px-2 py-0.5 rounded text-xs border ${
                (t === 'all' && !type) || type === t
                  ? 'border-zinc-400 text-zinc-100'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ForceGraph nodes={data.nodes} links={data.links} />
      </div>
    </div>
  );
}
