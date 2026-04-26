import Link from 'next/link';
import { getOpenLoopsData } from '@/lib/operations';

export const dynamic = 'force-dynamic';

type Loop = {
  slug: string;
  type?: string;
  title?: string | null;
  loop_type: string;
  reason: string;
  suggested_action: string;
  updated_at?: string;
  frontmatter?: Record<string, unknown>;
};

function LoopSection({ title, loops, tone }: { title: string; loops: Loop[]; tone: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title" style={{ color: tone }}>{title}</div>
        <div className="card-sub">{loops.length}</div>
      </div>
      {loops.length === 0 ? (
        <p className="empty-copy">No loops detected by this heuristic.</p>
      ) : (
        <div className="loop-list">
          {loops.map(loop => (
            <div key={`${loop.loop_type}-${loop.slug}`} className="loop-row">
              <div className="loop-row-main">
                <div className="loop-row-kicker mono">{loop.loop_type} · {loop.reason}</div>
                <div className="loop-row-title">{loop.title ?? loop.slug}</div>
                <div className="loop-row-action">{loop.suggested_action}</div>
              </div>
              <div className="loop-row-side">
                {loop.frontmatter?.priority != null && <span className="pill">{String(loop.frontmatter.priority)}</span>}
                {loop.updated_at && <span className="mono loop-date">{new Date(loop.updated_at).toLocaleDateString()}</span>}
                <Link className="btn btn-ghost" href={`/pages?q=${encodeURIComponent(loop.slug)}`}>Source</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function OpenLoopsPage() {
  const data = await getOpenLoopsData();
  const total = data.todos.length + data.meetingActions.length + data.promises.length + data.drafts.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Open Loops Radar</h1>
          <p className="page-sub">Every stale task, unresolved meeting action, forgotten promise, and abandoned draft Max can detect.</p>
        </div>
        <div className="page-actions">
          <span className="pill pill-warning">{total} loops</span>
          <Link className="btn" href="/daily"><i className="ph ph-sun-horizon"></i>Today</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--s-5)', maxWidth: 980 }}>
        <div className="card" style={{ borderColor: total ? 'rgba(255,178,44,0.28)' : undefined }}>
          <div className="card-head">
            <div className="card-title">Radar summary</div>
            <div className="card-sub mono">{data.today}</div>
          </div>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
            Phase 1 is deterministic: Max flags loops from overdue/stale dashboard tasks, meeting pages with action language,
            recent promise language, and old draft-like pages. Each item shows why it was flagged so the heuristic stays honest.
          </p>
        </div>

        <LoopSection title="Stale / overdue tasks" loops={data.todos as Loop[]} tone="var(--danger)" />
        <LoopSection title="Unresolved meeting actions" loops={data.meetingActions as Loop[]} tone="var(--type-meeting)" />
        <LoopSection title="Ramy, you said… / promises" loops={data.promises as Loop[]} tone="var(--warning)" />
        <LoopSection title="Abandoned drafts" loops={data.drafts as Loop[]} tone="var(--fg-subtle)" />
      </div>
    </>
  );
}
