import { getJobsData } from '@/lib/operations';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  waiting:   { color: 'var(--warning)',  bg: 'var(--warning-soft)',  border: 'rgba(255,178,44,0.25)' },
  active:    { color: 'var(--info)',     bg: 'var(--info-soft)',     border: 'rgba(96,165,250,0.28)' },
  completed: { color: 'var(--success)',  bg: 'var(--success-soft)',  border: 'rgba(59,206,118,0.25)' },
  failed:    { color: 'var(--danger)',   bg: 'var(--danger-soft)',   border: 'rgba(239,68,55,0.28)'  },
  dead:      { color: 'var(--fg-subtle)',bg: 'var(--surface-2)',     border: 'var(--border)'          },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.dead;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 11, fontWeight: 500, borderRadius: 'var(--r-sm)', border: `1px solid ${s.border}`, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }}></span>
      {status}
    </span>
  );
}

export default async function JobsPage() {
  const { stats, jobs } = await getJobsData();

  const statMap = Object.fromEntries((stats as any[]).map((s: any) => [s.status, s.count]));
  const total = (stats as any[]).reduce((acc: number, s: any) => acc + s.count, 0);

  const statCards = [
    { label: 'Active',    key: 'active',    color: 'var(--info)',    dot: 'var(--info)' },
    { label: 'Waiting',   key: 'waiting',   color: 'var(--warning)', dot: 'var(--warning)' },
    { label: 'Completed', key: 'completed', color: 'var(--success)', dot: 'var(--success)' },
    { label: 'Failed',    key: 'failed',    color: 'var(--danger)',  dot: 'var(--danger)' },
    { label: 'Total',     key: '_total',    color: 'var(--fg)',      dot: 'var(--fg-subtle)' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Jobs monitor</h1>
          <p className="page-sub">Background Minions — embeddings, summaries, link inference.</p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--s-3)', marginBottom: 'var(--s-5)' }}>
        {statCards.map(({ label, key, color, dot }) => (
          <div key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--s-4)' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }}></span>
              {label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 6, letterSpacing: '-0.02em' }}>
              {key === '_total' ? total : (statMap[key] ?? 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Jobs table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
        <table className="rb-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th>Job name</th>
              <th style={{ width: 80 }}>Queue</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 90 }}>Attempts</th>
              <th style={{ width: 100 }}>Tokens in</th>
              <th style={{ width: 100 }}>Tokens out</th>
              <th style={{ width: 130, textAlign: 'right' }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(jobs as any[]).map((j: any) => (
              <tr key={j.id}>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>#{j.id}</td>
                <td style={{ color: 'var(--fg-strong)', fontWeight: 500 }}>{j.name}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{j.queue}</td>
                <td><StatusPill status={j.status} /></td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{j.attempts_made}/{j.max_attempts}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{j.tokens_input > 0 ? j.tokens_input.toLocaleString() : '—'}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{j.tokens_output > 0 ? j.tokens_output.toLocaleString() : '—'}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'right' }}>{new Date(j.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(jobs as any[]).length === 0 && (
          <div style={{ padding: 'var(--s-10)', textAlign: 'center', fontSize: 13, color: 'var(--fg-subtle)' }}>
            No jobs yet. Jobs appear here when gbrain runs background tasks (embed, extract, sync).
          </div>
        )}
      </div>
    </>
  );
}
