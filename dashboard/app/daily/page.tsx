import Link from 'next/link';
import { getCommandCenterData } from '@/lib/operations';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function Card({ title, sub, children, tone }: {
  title: string; sub?: string; tone?: string; children: React.ReactNode;
}) {
  return (
    <div className="card cockpit-card">
      <div className="card-head">
        <div className="card-title" style={tone ? { color: tone } : undefined}>{title}</div>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniRow({ label, title, meta, tone, href }: {
  label?: string; title: string; meta?: string; tone?: string; href?: string;
}) {
  const body = (
    <div className="cockpit-row">
      {label && <span className="mono cockpit-row-label" style={tone ? { color: tone } : undefined}>{label}</span>}
      <span className="cockpit-row-title" style={tone ? { color: tone } : undefined}>{title}</span>
      {meta && <span className="mono cockpit-row-meta">{meta}</span>}
    </div>
  );
  return href ? <Link href={href} className="cockpit-row-link">{body}</Link> : body;
}

function fmtMaybeDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : undefined;
}

function fmtMaybeTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined;
}

type RowWithFrontmatter = {
  slug: string;
  title?: string | null;
  type?: string;
  status?: string;
  id?: string | number;
  name?: string | null;
  updated_at?: string;
  touch_count?: number;
  frontmatter?: Record<string, string | number | boolean | null | undefined>;
};

export default async function DailyPage() {
  const data = await getCommandCenterData();
  const { overdue, dueToday, upcoming } = data.todoState;
  const todayMeetings = data.todayMeetings as unknown as RowWithFrontmatter[];
  const hotPeople = data.hotPeople as unknown as RowWithFrontmatter[];
  const decisions = data.candidateDecisions as unknown as RowWithFrontmatter[];
  const recentPages = data.recentPages as unknown as RowWithFrontmatter[];
  const failedJobs = data.failedJobs as unknown as RowWithFrontmatter[];
  const recentMeetings = data.recentMeetings as unknown as RowWithFrontmatter[];
  const oneThing = data.oneThingNow;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Today Command Center</h1>
          <p className="page-sub">{fmtDate(data.today)} · meetings, loops, people, decisions, and one thing now.</p>
        </div>
        <div className="page-actions">
          <Link className="btn" href="/open-loops"><i className="ph ph-radar"></i>Open loops</Link>
          <Link className="btn" href="/decisions"><i className="ph ph-scales"></i>Decision ledger</Link>
        </div>
      </div>

      <div className="cockpit-grid">
        <section className={`card one-thing one-thing-${oneThing.urgency}`}>
          <div className="card-head">
            <div className="card-title">One thing to do now</div>
            <div className="card-sub">{oneThing.kind.replace('_', ' ')}</div>
          </div>
          <h2>{oneThing.title}</h2>
          <p>{oneThing.reason}</p>
          {oneThing.href && <Link className="btn btn-primary" href={oneThing.href}>Open source</Link>}
        </section>

        <Card title="Tasks" sub={`${overdue.length} overdue · ${dueToday.length} due today`} tone={overdue.length ? 'var(--danger)' : 'var(--fg-strong)'}>
          {overdue.slice(0, 5).map((t) => (
            <MiniRow key={t.slug} label={String(t.frontmatter?.priority ?? 'p3')} title={t.title ?? t.slug} meta={String(t.frontmatter?.due_date ?? '')} tone="var(--danger)" href="/todos" />
          ))}
          {dueToday.slice(0, 5).map((t) => (
            <MiniRow key={t.slug} label={String(t.frontmatter?.priority ?? 'p3')} title={t.title ?? t.slug} meta="today" tone="var(--warning)" href="/todos" />
          ))}
          {!overdue.length && !dueToday.length && upcoming.slice(0, 4).map((t) => (
            <MiniRow key={t.slug} label={String(t.frontmatter?.priority ?? 'p3')} title={t.title ?? t.slug} meta={String(t.frontmatter?.due_date ?? 'open')} href="/todos" />
          ))}
          {!overdue.length && !dueToday.length && !upcoming.length && <p className="empty-copy">No open tasks detected.</p>}
        </Card>

        <Card title="Meetings" sub={`${todayMeetings.length} today`} tone="var(--type-meeting)">
          {todayMeetings.length ? todayMeetings.map((m) => (
            <MiniRow key={m.slug} label="today" title={m.title ?? m.slug} meta={m.frontmatter?.time == null ? undefined : String(m.frontmatter.time)} href={`/meetings?slug=${encodeURIComponent(m.slug)}`} />
          )) : recentMeetings.slice(0, 4).map((m) => (
            <MiniRow key={m.slug} label="recent" title={m.title ?? m.slug} meta={m.frontmatter?.date == null ? undefined : String(m.frontmatter.date)} href={`/meetings?slug=${encodeURIComponent(m.slug)}`} />
          ))}
        </Card>

        <Card title="Hot people" sub={`${hotPeople.length} active`} tone="var(--type-person)">
          {hotPeople.length ? hotPeople.map((p) => (
            <MiniRow key={p.slug} label={`${p.touch_count ?? 0} links`} title={p.title ?? p.slug} meta={fmtMaybeDate(p.updated_at)} href={`/people?slug=${encodeURIComponent(p.slug)}`} />
          )) : <p className="empty-copy">No recently active people detected in the last 14 days.</p>}
        </Card>

        <Card title="Unresolved decisions" sub={`${decisions.length} candidates`} tone="var(--type-decision)">
          {decisions.length ? decisions.slice(0, 6).map((d) => (
            <MiniRow key={d.slug} label={d.type} title={d.title ?? d.slug} meta={fmtMaybeDate(d.updated_at)} href="/decisions" />
          )) : <p className="empty-copy">No decision candidates detected.</p>}
        </Card>

        <Card title="Open loops radar" sub="stale + promises" tone="var(--warning)">
          <MiniRow label="radar" title="Review stale tasks, meeting actions, promises, and drafts" meta="live" href="/open-loops" />
          {failedJobs.length > 0 && failedJobs.slice(0, 3).map((j) => (
            <MiniRow key={j.id} label="agent" title={j.name ?? `Job ${j.id}`} meta={j.status} tone="var(--danger)" href="/jobs" />
          ))}
        </Card>

        <Card title="Brain activity" sub="last 24h" tone="var(--accent)">
          {recentPages.length ? recentPages.slice(0, 6).map((p) => (
            <MiniRow key={p.slug} label={p.type} title={p.title ?? p.slug} meta={fmtMaybeTime(p.updated_at)} href={`/pages?q=${encodeURIComponent(p.slug)}`} />
          )) : <p className="empty-copy">No recent updates in the last 24 hours.</p>}
        </Card>
      </div>
    </>
  );
}
