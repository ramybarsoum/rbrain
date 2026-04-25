import { getGraphData, listPages } from '@/lib/operations';
import ForceGraph from '@/components/ForceGraph';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const [people, graph] = await Promise.all([
    listPages({ type: 'person', limit: 200 }),
    getGraphData({ type: 'person', limit: 200 }),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs text-zinc-500">
          {people.length} people · {graph.links.length} connections
        </span>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-56 shrink-0 border-r border-zinc-800 overflow-y-auto py-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(people as any[]).map((p) => (
            <div
              key={p.slug}
              className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-default truncate"
            >
              {p.title || p.slug}
            </div>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          <ForceGraph nodes={graph.nodes} links={graph.links} />
        </div>
      </div>
    </div>
  );
}
