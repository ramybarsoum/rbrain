import Link from 'next/link';
import { listPages } from '@/lib/operations';

export const dynamic = 'force-dynamic';

const TYPE_COLORS: Record<string, string> = {
  person: 'text-blue-400',
  company: 'text-emerald-400',
  concept: 'text-purple-400',
  decision: 'text-amber-400',
  note: 'text-zinc-400',
  guide: 'text-cyan-400',
  analysis: 'text-rose-400',
};

function typeColor(type: string) {
  return TYPE_COLORS[type] ?? 'text-zinc-500';
}

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tag?: string }>;
}) {
  const { type, tag } = await searchParams;
  const pages = await listPages({ type, tag, limit: 200 });

  const types = ['person', 'company', 'concept', 'decision', 'note', 'guide', 'analysis'];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Pages</h1>
        <span className="text-xs text-zinc-500">{pages.length} shown</span>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/pages"
          className={`px-2 py-0.5 rounded text-xs border ${!type ? 'border-zinc-400 text-zinc-100' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
        >
          all
        </Link>
        {types.map(t => (
          <Link
            key={t}
            href={`/pages?type=${t}`}
            className={`px-2 py-0.5 rounded text-xs border ${type === t ? 'border-zinc-400 text-zinc-100' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500">
              <th className="text-left px-4 py-2 font-medium w-24">Type</th>
              <th className="text-left px-4 py-2 font-medium">Title</th>
              <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Slug</th>
              <th className="text-right px-4 py-2 font-medium hidden lg:table-cell w-32">Updated</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(pages as any[]).map((p) => (
              <tr key={p.slug} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className={`px-4 py-2 text-xs ${typeColor(p.type)}`}>{p.type}</td>
                <td className="px-4 py-2 text-zinc-200 max-w-xs truncate">
                  {p.title || <span className="text-zinc-600 italic">untitled</span>}
                </td>
                <td className="px-4 py-2 text-zinc-600 text-xs hidden md:table-cell max-w-xs truncate">
                  {p.slug}
                </td>
                <td className="px-4 py-2 text-zinc-600 text-xs text-right hidden lg:table-cell whitespace-nowrap">
                  {new Date(p.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages.length === 0 && (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">No pages found.</div>
        )}
      </div>
    </div>
  );
}
