import { getMeetings, getMeetingAttendees } from '@/lib/operations';

export const dynamic = 'force-dynamic';

function fmtMeetingDate(fm: Record<string, any>) {
  const ts = fm?.v0_meeting_at;
  if (!ts) return null;
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    iso:  d.toISOString().slice(0, 10),
  };
}

async function AttendeeList({ slug }: { slug: string }) {
  const attendees = await getMeetingAttendees(slug);
  if (!(attendees as any[]).length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--fg-subtle)', marginTop: 'var(--s-4)' }}>
        No linked attendees in brain. Attendees are wired from the v0 archive migration.
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                <span style={{ fontSize: 11, color: 'var(--type-person)', fontWeight: 500 }}>person</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-strong)' }}>{a.title || a.slug}</span>
                {fm.v0_company && <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>· {fm.v0_company}</span>}
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-disabled)' }}>{a.link_type}</span>
              </div>
              {fm.email && <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{fm.email}</div>}
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
      <aside style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
        <div style={{ padding: '12px var(--s-4) 8px', fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {(meetings as any[]).length} meetings · Granola
        </div>
        {(meetings as any[]).length === 0 && (
          <div style={{ padding: 'var(--s-4)', fontSize: 12, color: 'var(--fg-disabled)' }}>No meeting pages in brain yet.</div>
        )}
        {(meetings as any[]).map((m: any) => {
          const dt = fmtMeetingDate(m.frontmatter);
          const isActive = m.slug === activeSlug;
          return (
            <a key={m.slug} href={`/meetings?slug=${encodeURIComponent(m.slug)}`} style={{
              display: 'block', padding: '9px var(--s-4)',
              textDecoration: 'none',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
              <div style={{ fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.title || m.slug}
              </div>
              {dt && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>
                  {dt.date} · {dt.time}
                </div>
              )}
            </a>
          );
        })}
      </aside>

      {/* Brief panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-8)' }}>
        {!activeSlug ? (
          <div style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>
            Select a meeting to see attendee profiles and notes.
          </div>
        ) : (() => {
          const meeting = (meetings as any[]).find(m => m.slug === activeSlug);
          if (!meeting) return <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Meeting not found.</div>;
          const fm = meeting.frontmatter ?? {};
          const dt = fmtMeetingDate(fm);
          return (
            <div style={{ maxWidth: 640 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s-2)' }}>
                Meeting Brief
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-strong)', letterSpacing: '-0.01em', margin: '0 0 var(--s-3)' }}>
                {meeting.title || meeting.slug}
              </h1>
              <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', marginBottom: 'var(--s-6)' }}>
                {dt && <span className="pill"><i className="ph ph-calendar" style={{ marginRight: 4 }}></i>{dt.date}</span>}
                {dt && <span className="pill"><i className="ph ph-clock" style={{ marginRight: 4 }}></i>{dt.time}</span>}
                {fm.v0_source && <span className="pill">{fm.v0_source}</span>}
              </div>
              <AttendeeList slug={activeSlug} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
