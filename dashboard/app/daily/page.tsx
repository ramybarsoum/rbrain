import { getDailyBriefData } from '@/lib/operations';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function Section({ title, color, count, children }: {
  title: string; color: string; count: number; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title" style={{ color }}>{title}</div>
        <div className="card-sub">{count}</div>
      </div>
      {children}
    </div>
  );
}

function Row({ left, center, right, leftColor, centerColor }: {
  left?: string; center: string; right?: string; leftColor?: string; centerColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: '8px 0', borderBottom: '1px solid var(--separator)' }}>
      {left && <span className="mono" style={{ fontSize: 11, color: leftColor ?? 'var(--fg-subtle)', flexShrink: 0, width: 120 }}>{left}</span>}
      <span style={{ flex: 1, fontSize: 13, color: centerColor ?? 'var(--fg-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{center}</span>
      {right && <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0 }}>{right}</span>}
    </div>
  );
}

export default async function DailyPage() {
  const { openTodos, recentPages, todayTimeline, todayMeetings, today } = await getDailyBriefData();

  const overdue   = (openTodos as any[]).filter(t => { const d = t.frontmatter?.due_date; return d && d < today; });
  const dueToday  = (openTodos as any[]).filter(t => t.frontmatter?.due_date === today);
  const upcoming  = (openTodos as any[]).filter(t => { const d = t.frontmatter?.due_date; return !d || d > today; });

  const allClear = overdue.length === 0 && dueToday.length === 0 &&
    (todayMeetings as any[]).length === 0 && (recentPages as any[]).length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Daily Brief</h1>
          <p className="page-sub">{fmtDate(today)}</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>

        {/* Overdue */}
        <Section title="Overdue" color="var(--danger)" count={overdue.length}>
          {overdue.map((t: any) => (
            <Row key={t.slug}
              left={t.frontmatter?.due_date}
              center={t.title}
              right={t.frontmatter?.priority}
              leftColor="var(--danger)"
              centerColor="var(--danger)"
            />
          ))}
        </Section>

        {/* Due today */}
        <Section title="Due Today" color="var(--warning)" count={dueToday.length}>
          {dueToday.map((t: any) => (
            <Row key={t.slug}
              center={t.title}
              right={t.frontmatter?.priority}
              centerColor="var(--warning)"
            />
          ))}
        </Section>

        {/* Today's meetings */}
        <Section title="Meetings Today" color="var(--type-meeting)" count={(todayMeetings as any[]).length}>
          {(todayMeetings as any[]).map((m: any) => (
            <Row key={m.slug}
              center={m.title || m.slug}
              right={m.frontmatter?.time}
              centerColor="var(--fg-strong)"
            />
          ))}
        </Section>

        {/* Open todos */}
        <Section title="Open Tasks" color="var(--fg-muted)" count={upcoming.length}>
          {upcoming.slice(0, 10).map((t: any) => (
            <Row key={t.slug}
              left={t.frontmatter?.priority ?? 'p3'}
              center={t.title}
              right={t.frontmatter?.due_date}
            />
          ))}
          {upcoming.length > 10 && (
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)', padding: '6px 0' }}>
              +{upcoming.length - 10} more open tasks
            </div>
          )}
        </Section>

        {/* Today's timeline */}
        <Section title="Brain Activity Today" color="var(--accent)" count={(todayTimeline as any[]).length}>
          {(todayTimeline as any[]).map((e: any, i: number) => (
            <Row key={i}
              left={e.title || e.slug}
              center={e.summary}
              centerColor="var(--fg-muted)"
            />
          ))}
        </Section>

        {/* Recently updated */}
        <Section title="Updated Last 24h" color="var(--fg-subtle)" count={(recentPages as any[]).length}>
          {(recentPages as any[]).map((p: any) => (
            <Row key={p.slug}
              left={p.type}
              center={p.title || p.slug}
              right={new Date(p.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              centerColor="var(--fg-muted)"
            />
          ))}
        </Section>

        {allClear && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--s-10)' }}>
            <div style={{ fontSize: 32, marginBottom: 'var(--s-3)' }}>
              <i className="ph ph-check-circle" style={{ color: 'var(--success)' }}></i>
            </div>
            <div style={{ fontSize: 14, color: 'var(--fg-muted)' }}>All clear. Nothing due today, no meetings, no recent updates.</div>
          </div>
        )}
      </div>
    </>
  );
}
