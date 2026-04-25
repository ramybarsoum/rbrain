import { getMeetings, getMeetingAttendees } from '@/lib/operations';

export const dynamic = 'force-dynamic';

// Normalize date from either Circleback ('date') or Granola ('v0_meeting_at')
function meetingDateTime(fm: Record<string, any>) {
  const ts = fm?.date
    ? fm.date + 'T00:00:00'        // Circleback: plain date
    : fm?.v0_meeting_at ?? null;   // Granola: ISO timestamp
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: fm?.date ? null : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    iso:  d.toISOString().slice(0, 10),
  };
}

function isCircleback(fm: Record<string, any>) {
  return fm?.source_type === 'circleback' || !!fm?.date;
}

// For Circleback: attendees come as a JSON array in frontmatter
function CirclebbackAttendees({ fm }: { fm: Record<string, any> }) {
  const list: string[] = Array.isArray(fm?.attendees) ? fm.attendees : [];
  if (!list.length) return null;
  return (
    <div style={{ marginTop: 'var(--s-4)' }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s-3)' }}>
        Attendees · {list.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {list.map((name, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px var(--s-3)' }}>
            <span style={{ fontSize: 11, color: 'var(--type-person)', fontWeight: 500 }}>person</span>
            <span style={{ fontSize: 13, color: 'var(--fg-strong)' }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// For old Granola meetings: attendees come from graph links
async function LinkedAttendees({ slug }: { slug: string }) {
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
          const afm = a.frontmatter ?? {};
          return (
            <div key={a.slug} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px var(--s-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                <span style={{ fontSize: 11, color: 'var(--type-person)', fontWeight: 500 }}>person</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-strong)' }}>{a.title || a.slug}</span>
                {afm.v0_company && <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>· {afm.v0_company}</span>}
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-disabled)' }}>{a.link_type}</span>
              </div>
              {afm.email && <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{afm.email}</div>}
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
          {(meetings as any[]).length} meetings
        </div>
        {(meetings as any[]).length === 0 && (
          <div style={{ padding: 'var(--s-4)', fontSize: 12, color: 'var(--fg-disabled)' }}>No meetings yet.</div>
        )}
        {(meetings as any[]).map((m: any) => {
          const dt = meetingDateTime(m.frontmatter);
          const isActive = m.slug === activeSlug;
          const cb = isCircleback(m.frontmatter);
          return (
            <a key={m.slug} href={`/meetings?slug=${encodeURIComponent(m.slug)}`} style={{
              display: 'block', padding: '9px var(--s-4)',
              textDecoration: 'none',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: cb ? 'var(--accent)' : 'var(--fg-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  {cb ? 'CB' : 'arc'}
                </span>
                <span style={{ fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.title || m.slug}
                </span>
              </div>
              {dt && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2, paddingLeft: 20 }}>
                  {dt.date}{dt.time ? ` · ${dt.time}` : ''}
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
            Select a meeting to see the brief and attendees.
          </div>
        ) : (() => {
          const meeting = (meetings as any[]).find(m => m.slug === activeSlug);
          if (!meeting) return <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Meeting not found.</div>;
          const fm = meeting.frontmatter ?? {};
          const dt = meetingDateTime(fm);
          const cb = isCircleback(fm);
          return (
            <div style={{ maxWidth: 640 }}>
              {/* Source badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-2)' }}>
                <span className="pill" style={{ color: cb ? 'var(--accent)' : 'var(--fg-subtle)', borderColor: cb ? 'var(--accent-strong)' : undefined, background: cb ? 'var(--accent-soft)' : undefined }}>
                  {cb ? 'Circleback' : 'Archive (Granola)'}
                </span>
              </div>

              <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-strong)', letterSpacing: '-0.01em', margin: '0 0 var(--s-3)' }}>
                {meeting.title || meeting.slug}
              </h1>

              {/* Meta pills */}
              <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-6)' }}>
                {dt && <span className="pill"><i className="ph ph-calendar" style={{ marginRight: 4 }}></i>{dt.date}</span>}
                {dt?.time && <span className="pill"><i className="ph ph-clock" style={{ marginRight: 4 }}></i>{dt.time}</span>}
                {fm.duration && <span className="pill"><i className="ph ph-timer" style={{ marginRight: 4 }}></i>{fm.duration}</span>}
                {fm.location && <span className="pill"><i className="ph ph-video-camera" style={{ marginRight: 4 }}></i>{fm.location}</span>}
              </div>

              {/* Circleback: attendees from frontmatter array */}
              {cb && <CirclebbackAttendees fm={fm} />}

              {/* Archive: attendees from graph links */}
              {!cb && <LinkedAttendees slug={activeSlug} />}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
