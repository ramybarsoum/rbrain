import { getDailyBriefData } from '@/lib/operations';

export const dynamic = 'force-dynamic';

const PRIORITY_LABEL: Record<string, string> = { p1: '🔴', p2: '🟡', p3: '⚪' };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function DailyPage() {
  const { openTodos, recentPages, todayTimeline, todayMeetings, today } = await getDailyBriefData();

  const overdue = (openTodos as any[]).filter(t => {
    const d = t.frontmatter?.due_date;
    return d && d < today;
  });
  const dueToday = (openTodos as any[]).filter(t => t.frontmatter?.due_date === today);
  const upcoming = (openTodos as any[]).filter(t => {
    const d = t.frontmatter?.due_date;
    return !d || d > today;
  });

  return (
    <div className="p-8 max-w-3xl space-y-10">
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Daily Brief</div>
        <h1 className="text-xl font-semibold text-zinc-100">{fmtDate(today)}</h1>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-red-400 uppercase tracking-widest mb-3">
            Overdue ({overdue.length})
          </h2>
          <ul className="space-y-1.5">
            {overdue.map((t: any) => (
              <li key={t.slug} className="flex items-center gap-3 py-1.5 border-b border-zinc-900">
                <span className="text-xs">{PRIORITY_LABEL[t.frontmatter?.priority] ?? '⚪'}</span>
                <span className="text-sm text-red-300 flex-1">{t.title}</span>
                <span className="text-xs text-red-500">{t.frontmatter?.due_date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Due today */}
      {dueToday.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-amber-400 uppercase tracking-widest mb-3">
            Due Today ({dueToday.length})
          </h2>
          <ul className="space-y-1.5">
            {dueToday.map((t: any) => (
              <li key={t.slug} className="flex items-center gap-3 py-1.5 border-b border-zinc-900">
                <span className="text-xs">{PRIORITY_LABEL[t.frontmatter?.priority] ?? '⚪'}</span>
                <span className="text-sm text-amber-200 flex-1">{t.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Today's meetings */}
      {(todayMeetings as any[]).length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-purple-400 uppercase tracking-widest mb-3">
            Meetings Today ({(todayMeetings as any[]).length})
          </h2>
          <ul className="space-y-1.5">
            {(todayMeetings as any[]).map((m: any) => (
              <li key={m.slug} className="flex items-center gap-3 py-1.5 border-b border-zinc-900">
                <span className="text-sm text-purple-200 flex-1">{m.title || m.slug}</span>
                {m.frontmatter?.time && (
                  <span className="text-xs text-purple-500">{m.frontmatter.time}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Open todos (no due date or future) */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
            Open ({upcoming.length})
          </h2>
          <ul className="space-y-1.5">
            {upcoming.slice(0, 10).map((t: any) => (
              <li key={t.slug} className="flex items-center gap-3 py-1.5 border-b border-zinc-900">
                <span className="text-xs">{PRIORITY_LABEL[t.frontmatter?.priority] ?? '⚪'}</span>
                <span className="text-sm text-zinc-300 flex-1">{t.title}</span>
                {t.frontmatter?.due_date && (
                  <span className="text-xs text-zinc-600">{t.frontmatter.due_date}</span>
                )}
              </li>
            ))}
            {upcoming.length > 10 && (
              <li className="text-xs text-zinc-600 pt-1">+{upcoming.length - 10} more</li>
            )}
          </ul>
        </section>
      )}

      {/* Today's timeline */}
      {(todayTimeline as any[]).length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-teal-400 uppercase tracking-widest mb-3">
            Brain Activity Today ({(todayTimeline as any[]).length})
          </h2>
          <ul className="space-y-1.5">
            {(todayTimeline as any[]).map((e: any, i: number) => (
              <li key={i} className="flex items-start gap-3 py-1.5 border-b border-zinc-900">
                <span className="text-xs text-zinc-600 w-32 shrink-0 pt-0.5">{e.title || e.slug}</span>
                <span className="text-sm text-zinc-400 flex-1">{e.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recently updated */}
      {(recentPages as any[]).length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
            Updated Last 24h ({(recentPages as any[]).length})
          </h2>
          <ul className="space-y-1">
            {(recentPages as any[]).map((p: any) => (
              <li key={p.slug} className="flex items-center gap-3 py-1 border-b border-zinc-900">
                <span className="text-xs text-zinc-600 w-20 shrink-0">{p.type}</span>
                <span className="text-sm text-zinc-400 flex-1 truncate">{p.title || p.slug}</span>
                <span className="text-xs text-zinc-700">{new Date(p.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openTodos.length === 0 && todayMeetings.length === 0 && recentPages.length === 0 && (
        <p className="text-sm text-zinc-600">All clear. Nothing due today, no meetings, no recent updates.</p>
      )}
    </div>
  );
}
