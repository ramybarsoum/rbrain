import { headers } from 'next/headers';
import { getCodexTelemetryDashboard, type CodexToolStat } from '@/lib/codexTelemetry';

export const dynamic = 'force-dynamic';

function fmtNum(value: number) {
  return value.toLocaleString();
}

function fmtTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function fmtMs(value: number) {
  if (!value) return '0ms';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function relTime(value: string) {
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff)) return 'unknown';
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function baseName(cwd: string) {
  const clean = cwd.replace(/^\/Users\/[^/]+/, '~');
  const parts = clean.split('/').filter(Boolean);
  return parts.at(-1) ?? clean;
}

function Bar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'danger' | 'warning' | 'success' }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const color = tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : tone === 'success' ? 'var(--success)' : 'var(--accent)';
  return <div className="codex-bar"><span style={{ width: `${pct}%`, background: color }} /></div>;
}

function ToolTable({ rows, empty }: { rows: CodexToolStat[]; empty: string }) {
  const max = Math.max(...rows.map(r => r.p95), 1);
  if (rows.length === 0) return <p className="empty-copy">{empty}</p>;
  return (
    <table className="rb-table codex-table">
      <thead>
        <tr><th>Tool</th><th>p50</th><th>p95</th><th>Max</th><th>N</th><th>Err</th></tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.name}>
            <td>
              <div className="codex-tool-name">{row.name}</div>
              <Bar value={row.p95} max={max} tone={row.p95 >= 10_000 ? 'danger' : row.p95 < 500 ? 'success' : 'accent'} />
            </td>
            <td className="mono tnum">{fmtMs(row.p50)}</td>
            <td className="mono tnum">{fmtMs(row.p95)}</td>
            <td className="mono tnum">{fmtMs(row.max)}</td>
            <td className="mono tnum">{row.count}</td>
            <td className={row.errors ? 'mono tnum codex-danger' : 'mono tnum'}>{row.errors}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function CodexTelemetryPage() {
  const headerList = await headers();
  const hostHeader = (headerList.get('host') ?? '').toLowerCase();
  const host = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  if (!isLocalhost) {
    return (
      <section className="card codex-command-card">
        <div>
          <div className="card-title">Codex telemetry is localhost-only</div>
          <p className="codex-copy">This view reads local Codex JSONL session metadata and is intentionally blocked outside loopback hosts.</p>
        </div>
        <span className="pill pill-warning"><span className="pill-dot" /> blocked</span>
      </section>
    );
  }

  const data = await getCodexTelemetryDashboard();
  const maxDailyTokens = Math.max(...data.daily.map(d => d.approxTokens), 1);
  const maxDailyTools = Math.max(...data.daily.map(d => d.toolCalls), 1);

  const kpis = [
    { label: 'Today sessions', value: fmtNum(data.totals.sessionsToday), sub: `${fmtNum(data.totals.sessions7d)} in 7d`, icon: 'ph-terminal-window' },
    { label: 'Approx tokens', value: fmtTokens(data.totals.approxTokensToday), sub: `${fmtTokens(data.totals.approxTokens7d)} in 7d`, icon: 'ph-chart-bar' },
    { label: 'Tool calls', value: fmtNum(data.totals.toolCalls7d), sub: 'from Codex JSONL pairs', icon: 'ph-wrench' },
    { label: 'Rate pressure', value: `${data.totals.rateLimitPeak}%`, sub: 'peak local Codex signal', icon: 'ph-gauge' },
  ];

  return (
    <>
      <div className="page-head codex-hero">
        <div>
          <div className="codex-kicker">Local agent observability</div>
          <h1 className="page-title">Codex Telemetry</h1>
          <p className="page-sub">A localhost-only view of what Codex is doing with OpenClaw and Discord in the loop.</p>
        </div>
        <div className="page-actions">
          <span className="pill pill-info"><span className="pill-dot" /> ~/.codex/sessions</span>
          <span className="pill pill-success"><span className="pill-dot" /> no cloud</span>
        </div>
      </div>

      <div className="codex-grid codex-kpis">
        {kpis.map(kpi => (
          <div className="card codex-kpi" key={kpi.label}>
            <div className="codex-kpi-icon"><i className={`ph ${kpi.icon}`} /></div>
            <div className="codex-kpi-label">{kpi.label}</div>
            <div className="codex-kpi-value">{kpi.value}</div>
            <div className="codex-kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="card codex-command-card">
        <div>
          <div className="card-title">What changed from the attached prompt</div>
          <p className="codex-copy">This dashboard watches Codex, not Claude Code. It reads <code>~/.codex/sessions/**/*.jsonl</code>, keeps data local, and treats Discord as the human-in-the-loop channel. Telegram-specific pager language has been replaced with Discord/OpenClaw routing.</p>
        </div>
        <div className="codex-flow">
          <span>Codex JSONL</span><b>→</b><span>RBrain dashboard</span><b>→</b><span>OpenClaw Discord</span>
        </div>
      </div>

      <div className="codex-grid two">
        <section className="card">
          <div className="card-head">
            <div><div className="card-title">Live sessions</div><div className="codex-card-note">Modified in the last five minutes.</div></div>
            <div className="card-sub">{data.liveSessions.length} active</div>
          </div>
          {data.liveSessions.length === 0 ? (
            <p className="empty-copy">No Codex session has written to disk in the last five minutes.</p>
          ) : data.liveSessions.map(session => (
            <div className="codex-session-row" key={session.id}>
              <div className="codex-session-main">
                <div className="codex-session-title">{session.title}</div>
                <div className="codex-session-meta">{baseName(session.cwd)} · {session.model} · {fmtNum(session.toolCount)} tools</div>
              </div>
              <div className="codex-session-side mono" title={new Date(session.updatedAt).toLocaleString()}>{relTime(session.updatedAt)}</div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head">
            <div><div className="card-title">Session outcomes</div><div className="codex-card-note">Last seven days, inferred from Codex event markers.</div></div>
          </div>
          <div className="codex-outcomes">
            {data.outcomes.map(outcome => (
              <div className={`codex-outcome ${outcome.tone}`} key={outcome.label}>
                <div className="codex-outcome-count">{outcome.count}</div>
                <div className="codex-outcome-label">{outcome.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div><div className="card-title">Seven-day activity</div><div className="codex-card-note">Approximate tokens use visible message text because Codex JSONLs do not expose billing-grade token usage in this build.</div></div>
          <div className="card-sub">{data.scannedSessions} / {data.totalSessions} sessions scanned</div>
        </div>
        {data.daily.length === 0 ? <p className="empty-copy">No sessions landed in the last seven days.</p> : (
          <div className="codex-days">
            {data.daily.map(day => (
              <div className="codex-day" key={day.date}>
                <div className="codex-day-date mono">{day.date.slice(5)}</div>
                <div className="codex-day-bars">
                  <Bar value={day.approxTokens} max={maxDailyTokens} />
                  <Bar value={day.toolCalls} max={maxDailyTools} tone="success" />
                </div>
                <div className="codex-day-meta"><span>{fmtTokens(day.approxTokens)} tok</span><span>{day.toolCalls} tools</span><span>{day.sessions} sessions</span></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="codex-grid two">
        <section className="card codex-centerpiece">
          <div className="card-head">
            <div><div className="card-title">Tool latency</div><div className="codex-card-note">Paired from function call and output events, plus explicit Codex *_end events.</div></div>
          </div>
          <ToolTable rows={data.toolLatency} empty="No paired tool latency events found yet." />
        </section>

        <section className="card codex-centerpiece mcp">
          <div className="card-head">
            <div><div className="card-title">MCP drill-down</div><div className="codex-card-note">Server/tool timing when Codex emits mcp_tool_call_end events.</div></div>
          </div>
          <ToolTable rows={data.mcp} empty="No MCP timing events found in the scanned Codex sessions." />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div><div className="card-title">Recent Codex sessions</div><div className="codex-card-note">Local diary view, newest first.</div></div>
          <div className="card-sub">source: ~/.codex/sessions</div>
        </div>
        <table className="rb-table codex-table">
          <thead><tr><th>Session</th><th>Workspace</th><th>Model</th><th>Tools</th><th>Approx tokens</th><th>Updated</th></tr></thead>
          <tbody>
            {data.recentSessions.map(session => (
              <tr key={session.id}>
                <td><div className="codex-session-title">{session.title}</div><div className="codex-session-meta mono">{session.id}</div></td>
                <td>{baseName(session.cwd)}</td>
                <td><span className="tag">{session.model}</span></td>
                <td className="mono tnum">{session.toolCount}</td>
                <td className="mono tnum">{fmtTokens(session.approxTokens)}</td>
                <td className="mono tnum" title={new Date(session.updatedAt).toLocaleString()}>{relTime(session.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
