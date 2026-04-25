import { getFeedData } from '@/lib/operations';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const TYPE_COLOR: Record<string, string> = {
  person:   'var(--type-person)',   company:  'var(--type-company)',
  meeting:  'var(--type-meeting)',  decision: 'var(--type-decision)',
  idea:     'var(--type-idea)',     thought:  'var(--info)',
  learning: 'var(--success)',       note:     'var(--type-note)',
  thought_learning: 'var(--success)', thought_decision: 'var(--type-decision)',
};

const TYPE_ICON: Record<string, string> = {
  person: 'ph-user', company: 'ph-buildings', meeting: 'ph-calendar',
  decision: 'ph-check-square', idea: 'ph-lightbulb', thought: 'ph-chat-circle',
  learning: 'ph-graduation-cap', thought_learning: 'ph-graduation-cap',
  thought_decision: 'ph-check-square', thought_follow_up: 'ph-arrow-clockwise',
  project_update: 'ph-kanban',
};

const FEED_TYPES = ['all', 'person', 'company', 'meeting', 'decision', 'idea', 'learning'];

function groupByDay(pages: any[]) {
  const groups: Record<string, any[]> = {};
  for (const p of pages) {
    const day = new Date(p.updated_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(p);
  }
  return groups;
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; days?: string }>;
}) {
  const { type, days: daysStr } = await searchParams;
  const days = daysStr ? parseInt(daysStr) : 7;
  const { recentPages } = await getFeedData({ type: type === 'all' || !type ? undefined : type, days });
  const groups = groupByDay(recentPages as any[]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Feed</h1>
          <p className="page-sub">Chronological stream of brain activity.</p>
        </div>
        <div className="page-actions">
          {[7, 14, 30].map(d => (
            <Link key={d} href={`/feed?${type ? `type=${type}&` : ''}days=${d}`}
              className={`btn${days === d ? ' btn-primary' : ' btn-ghost'}`} style={{ fontSize: 12 }}>
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {/* Type chips */}
      <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-6)', flexWrap: 'wrap' }}>
        {FEED_TYPES.map(t => (
          <Link key={t} href={`/feed?type=${t}&days=${days}`}
            className={`feed-chip${(!type && t === 'all') || type === t ? ' active' : ''}`}>
            {t !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[t] ?? 'var(--fg-muted)', display: 'inline-block', marginRight: 4 }}></span>}
            {t}
          </Link>
        ))}
      </div>

      {(recentPages as any[]).length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>No activity in the last {days} days.</div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 120 }}>
          {/* Vertical timeline line */}
          <div style={{ position: 'absolute', left: 105, top: 8, bottom: 0, width: 1, background: 'var(--separator)' }}></div>

          {Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: 'var(--s-6) 0 var(--s-3)', position: 'relative' }}>
                <span style={{ position: 'absolute', left: -120, width: 100, textAlign: 'right', fontSize: 12, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>{day.split(',')[0]}</span>
                <span style={{ position: 'absolute', left: -19, top: 7, width: 9, height: 9, background: 'var(--accent)', borderRadius: '50%', border: '2px solid var(--bg)', boxShadow: '0 0 0 1px var(--accent)' }}></span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-strong)' }}>{day.split(',').slice(1).join(',').trim()}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>· {items.length} updates</span>
              </div>

              {/* Entries */}
              {items.map((p: any) => (
                <div key={`${p.slug}-${p.id}`} style={{
                  position: 'relative', marginBottom: 'var(--s-3)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', padding: '12px var(--s-4)',
                  display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 'var(--s-3)', alignItems: 'start',
                }}>
                  <span style={{ position: 'absolute', left: -19, top: 18, width: 7, height: 7, background: 'var(--surface)', border: '1.5px solid var(--border-strong)', borderRadius: '50%' }}></span>
                  <span style={{ position: 'absolute', left: -12, top: 22, width: 12, height: 1, background: 'var(--separator)' }}></span>

                  <div style={{
                    width: 28, height: 28, borderRadius: 'var(--r-sm)',
                    display: 'grid', placeItems: 'center',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    fontSize: 14, color: TYPE_COLOR[p.type] ?? 'var(--fg-subtle)',
                  }}>
                    <i className={`ph ${TYPE_ICON[p.type] ?? 'ph-file'}`}></i>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-strong)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title || p.slug}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: TYPE_COLOR[p.type] ?? 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: TYPE_COLOR[p.type] ?? 'var(--fg-disabled)', display: 'inline-block' }}></span>
                        {p.type}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{p.slug}</span>
                    </div>
                  </div>

                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', paddingTop: 2 }}>
                    {new Date(p.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
