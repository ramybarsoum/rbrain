import { getMeetings, getMeetingAttendees } from '@/lib/operations';

export const dynamic = 'force-dynamic';

async function MeetingBrief({ slug }: { slug: string }) {
  const attendees = await getMeetingAttendees(slug);

  if (!(attendees as any[]).length) {
    return <p className="text-sm text-zinc-600 mt-4">No linked attendees found in brain.</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Attendees</div>
      {(attendees as any[]).map((a: any) => {
        const fm = a.frontmatter ?? {};
        return (
          <div key={a.slug} className="border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-100">{a.title || a.slug}</span>
              {fm.v0_company && (
                <span className="text-xs text-zinc-500">· {fm.v0_company}</span>
              )}
              <span className="ml-auto text-xs text-zinc-700">{a.link_type}</span>
            </div>
            {fm.title && fm.title !== a.title && (
              <div className="text-xs text-zinc-500">{fm.title}</div>
            )}
            {fm.email && (
              <div className="text-xs text-zinc-600 mt-0.5">{fm.email}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug: activeSlug } = await searchParams;
  const meetings = await getMeetings({ limit: 100 });

  return (
    <div className="flex h-full">
      {/* Meeting list */}
      <div className="w-64 shrink-0 border-r border-zinc-800 overflow-y-auto py-2">
        <div className="px-4 py-2 text-xs text-zinc-500 uppercase tracking-widest mb-1">
          {(meetings as any[]).length} meetings
        </div>
        {(meetings as any[]).length === 0 && (
          <div className="px-4 py-4 text-xs text-zinc-600">No meeting pages in brain yet.</div>
        )}
        {(meetings as any[]).map((m: any) => {
          const date = m.frontmatter?.date ?? m.updated_at?.slice(0, 10);
          const isActive = m.slug === activeSlug;
          return (
            <a
              key={m.slug}
              href={`/meetings?slug=${encodeURIComponent(m.slug)}`}
              className={`block px-4 py-2 hover:bg-zinc-800 transition-colors ${isActive ? 'bg-zinc-800' : ''}`}
            >
              <div className="text-sm text-zinc-200 truncate">{m.title || m.slug}</div>
              {date && <div className="text-xs text-zinc-600 mt-0.5">{date}</div>}
            </a>
          );
        })}
      </div>

      {/* Meeting brief panel */}
      <div className="flex-1 overflow-y-auto p-8">
        {!activeSlug ? (
          <div className="text-sm text-zinc-600">
            Select a meeting on the left to see the pre-meeting brief.
          </div>
        ) : (
          (() => {
            const meeting = (meetings as any[]).find(m => m.slug === activeSlug);
            if (!meeting) return <div className="text-sm text-zinc-600">Meeting not found.</div>;
            const fm = meeting.frontmatter ?? {};
            return (
              <div className="max-w-2xl">
                <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Pre-Meeting Brief</div>
                <h1 className="text-xl font-semibold text-zinc-100 mb-1">
                  {meeting.title || meeting.slug}
                </h1>
                <div className="flex gap-4 text-xs text-zinc-500 mb-6">
                  {fm.date && <span>{fm.date}</span>}
                  {fm.time && <span>{fm.time}</span>}
                  {fm.location && <span>{fm.location}</span>}
                </div>
                {fm.agenda && (
                  <div className="mb-6">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Agenda</div>
                    <p className="text-sm text-zinc-300 whitespace-pre-line">{fm.agenda}</p>
                  </div>
                )}
                <MeetingBrief slug={activeSlug} />
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
