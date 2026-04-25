'use client';

import { useState } from 'react';

type State = 'idle' | 'loading' | 'done' | 'error';

export default function SyncUpstreamButton() {
  const [state, setState]     = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [url, setUrl]         = useState('');

  async function trigger() {
    setState('loading');
    setMessage('');
    try {
      const res  = await fetch('/api/sync-upstream', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState('done');
        setMessage('Workflow triggered on GitHub.');
        setUrl(data.actions_url ?? '');
      } else {
        setState('error');
        setMessage(data.error ?? data.detail ?? 'Unknown error');
      }
    } catch (e: any) {
      setState('error');
      setMessage(e.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--s-2)' }}>
      <button
        className={`btn${state === 'done' ? ' btn-primary' : ''}`}
        onClick={trigger}
        disabled={state === 'loading'}
        style={{ fontSize: 12 }}
      >
        <i className={`ph ${state === 'loading' ? 'ph-circle-notch' : state === 'done' ? 'ph-check' : 'ph-arrows-clockwise'}`}
           style={state === 'loading' ? { animation: 'spin 1s linear infinite' } : undefined}
        ></i>
        {state === 'loading' ? 'Triggering…' : state === 'done' ? 'Triggered' : 'Sync upstream'}
      </button>

      {message && (
        <div style={{
          fontSize: 12,
          color: state === 'error' ? 'var(--danger)' : 'var(--fg-muted)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {message}
          {url && (
            <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}>
              View run →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
