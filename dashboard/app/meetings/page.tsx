import { getMeetings, getMeetingAttendees } from '@/lib/operations';

export const dynamic = 'force-dynamic';

async function AttendeeList({ slug }: { slug: string }) {
  const attendees = await getMeetingAttendees(slug);
  if (!(attendees as any[]).length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--fg-subtle)', marginTop: 'var(--s-4)' }}>
        No linked attendees found in brain.
      </p>
    );
  }
  return (
    <div style={{ marginTop: 'var(--s-4)' }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s-3)' }}>
        Attendees · {(attendees as any[]).length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {(attendees as any[]).map((a: any) => {
          const fm = a.frontmatter ?? {};
          return (
            <div key={a.slug} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--s-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 2 }}>
                <span className={`type-pill t-person`}><span className="swatch"></span>person</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-strong)' }}>{a.title || a.slug}</span>
                {fm.v0_company && (
                  <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>· {fm.v0_company}</span>
                )}
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-disabled)' }}>{a.link_type}</span>
              </div>
              {fm.email && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{fm.email}</div>
              )}
            </div>
          );
        })}
      </div>
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
    <div style={{ display: 'flex', height: '100%', margin: 'calc(-1 * var(--s-6)) calc(-1 * var(--s-8))', overflow: 'hidden' }}>
      {/* Meeting list */}
      <aside style={{
        width: 260, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto', paddingTop: 'var(--s-2)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ padding: '4px var(--s-4) 8px', fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {(meetings as any[]).length} meetings
        </div>
        {(meetings as any[]).length === 0 && (
          <div style={{ padding: 'var(--s-4)', fontSize: 12, color: 'var(--fg-disabled)' }}>
            No meeting pages in brain yet.
          </div>
        )}
        {(meetings as any[]).map((m: any) => {
          const date = m.frontmatter?.date ?? m.updated_at?.slice(0, 10);
          const isActive = m.slug === activeSlug;
          return (
            <a
              key={m.slug}
              href={`/meetings?slug=${encodeURIComponent(m.slug)}`}
              style={{
                display: 'block', padding: '8px var(--s-4)',
                textDecoration: 'none',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <div style={{ fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.title || m.slug}
              </div>
              {date && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{date}</div>
              )}
            </a>
          );
        })}
      </aside>

      {/* Brief panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-8)' }}>
        {!activeSlug ? (
          <div style={{ color: 'var(--fg-subtle)', fontSize: 13, paddingTop: 'var(--s-4)' }}>
            <i className="ph ph-arrow-left" style={{ marginRight: 8 }}></i>
            Select a meeting to see the pre-meeting brief.
          </div>
        ) : (() => {
          const meeting = (meetings as any[]).find(m => m.slug === activeSlug);
          if (!meeting) return <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Meeting not found.</div>;
          const fm = meeting.frontmatter ?? {};
          return (
            <div style={{ maxWidth: 640 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s-2)' }}>
                Pre-Meeting Brief
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-strong)', letterSpacing: '-0.01em', margin: '0 0 var(--s-2)' }}>
                {meeting.title || meeting.slug}
              </h1>
              <div style={{ display: 'flex', gap: 'var(--s-4)', marginBottom: 'var(--s-6)' }}>
                {fm.date && <span className="pill">{fm.date}</span>}
                {fm.time && <span className="pill">{fm.time}</span>}
                {fm.location && <span className="pill"><i className="ph ph-map-pin"></i>{fm.location}</span>}
              </div>
              {fm.agenda && (
                <div style={{ marginBottom: 'var(--s-6)' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s-2)' }}>Agenda</div>
                  <p style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{fm.agenda}</p>
                </div>
              )}
              <AttendeeList slug={activeSlug} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
