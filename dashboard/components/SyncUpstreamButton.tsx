'use client';

import { useState } from 'react';

type State = 'idle' | 'previewing' | 'applying' | 'done' | 'error';

export default function SyncUpstreamButton() {
  const [state, setState] = useState<State>('idle');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'ran' | 'instructions' | 'error' | null>(null);

  async function run(apply: boolean) {
    setState(apply ? 'applying' : 'previewing');
    setOutput('');
    try {
      const res = await fetch('/api/sync-upstream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json();
      setMode(data.mode);
      if (data.mode === 'instructions') {
        setOutput(data.commands.join('\n'));
      } else {
        setOutput(data.output ?? data.message ?? '');
      }
      setState(res.ok ? 'done' : 'error');
    } catch (e: any) {
      setOutput(e.message);
      setMode('error');
      setState('error');
    }
  }

  const busy = state === 'previewing' || state === 'applying';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--s-2)' }}>
      <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
        <button
          className="btn btn-ghost"
          onClick={() => run(false)}
          disabled={busy}
          style={{ fontSize: 12 }}
        >
          <i className="ph ph-eye"></i>
          {state === 'previewing' ? 'Checking…' : 'Preview sync'}
        </button>
        <button
          className="btn"
          onClick={() => run(true)}
          disabled={busy}
          style={{ fontSize: 12 }}
        >
          <i className="ph ph-arrows-clockwise"></i>
          {state === 'applying' ? 'Syncing…' : 'Sync upstream'}
        </button>
      </div>

      {output && (
        <pre style={{
          marginTop: 'var(--s-2)',
          background: 'var(--surface-2)',
          border: `1px solid ${state === 'error' ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-3) var(--s-4)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: state === 'error' ? 'var(--danger)' : mode === 'instructions' ? 'var(--accent)' : 'var(--fg-muted)',
          whiteSpace: 'pre-wrap',
          maxWidth: 560,
          maxHeight: 200,
          overflowY: 'auto',
          lineHeight: 1.6,
        }}>
          {mode === 'instructions' && (
            <span style={{ display: 'block', color: 'var(--fg-subtle)', marginBottom: 6 }}>
              ↓ Run locally from RBrain root:
            </span>
          )}
          {output}
        </pre>
      )}
    </div>
  );
}
