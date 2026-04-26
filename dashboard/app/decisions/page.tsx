import Link from 'next/link';
import { getDecisionLedgerData } from '@/lib/operations';

export const dynamic = 'force-dynamic';

type Decision = {
  slug: string;
  type: string;
  title?: string | null;
  owner: string;
  deadline?: string | null;
  reversibility: string;
  why: string;
  updated_at: string;
  evidence: { score: number; label: 'Low' | 'Medium' | 'High' };
};

const EVIDENCE_CLASS: Record<Decision['evidence']['label'], string> = {
  Low: 'pill-danger',
  Medium: 'pill-warning',
  High: 'pill-success',
};

function DecisionTable({ title, rows, tone }: { title: string; rows: Decision[]; tone: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title" style={{ color: tone }}>{title}</div>
        <div className="card-sub">{rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <p className="empty-copy">No decisions detected by this heuristic.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="rb-table decision-table">
            <thead>
              <tr>
                <th>Decision</th>
                <th>Owner</th>
                <th>Deadline</th>
                <th>Reversible?</th>
                <th>Evidence</th>
                <th>Why this mattered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.slug}>
                  <td>
                    <Link href={`/pages?q=${encodeURIComponent(row.slug)}`} style={{ color: 'var(--fg-strong)', textDecoration: 'none' }}>
                      {row.title ?? row.slug}
                    </Link>
                    <div className="mono" style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>{row.type} · {new Date(row.updated_at).toLocaleDateString()}</div>
                  </td>
                  <td>{row.owner}</td>
                  <td>{row.deadline ?? <span style={{ color: 'var(--fg-disabled)' }}>none</span>}</td>
                  <td>{row.reversibility}</td>
                  <td><span className={`pill ${EVIDENCE_CLASS[row.evidence.label]}`}>{row.evidence.label} · {row.evidence.score}</span></td>
                  <td style={{ maxWidth: 340, color: 'var(--fg-muted)' }}>{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function DecisionsPage() {
  const { made, pending } = await getDecisionLedgerData();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Decision Ledger</h1>
          <p className="page-sub">Decisions made, pending, reversibility, owner, deadline, evidence quality, and why it mattered.</p>
        </div>
        <div className="page-actions">
          <span className="pill pill-info">heuristic v1</span>
          <Link className="btn" href="/daily"><i className="ph ph-sun-horizon"></i>Today</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--s-5)' }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Ledger rules</div>
            <div className="card-sub">transparent scoring</div>
          </div>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
            Evidence quality is deterministic for now: backlinks ×2 + timeline entries ×2 + up to 10 content chunks.
            Unknown owner, reversibility, and rationale are shown explicitly instead of hallucinated.
          </p>
        </div>

        <DecisionTable title="Pending decisions" rows={pending as Decision[]} tone="var(--warning)" />
        <DecisionTable title="Decisions made" rows={made as Decision[]} tone="var(--type-decision)" />
      </div>
    </>
  );
}
