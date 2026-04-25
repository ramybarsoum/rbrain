'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setStreaming(true);

    // Append empty assistant message to stream into
    setMessages(m => [...m, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setMessages(m => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err.error ?? 'Failed to connect'}` };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const { text } = JSON.parse(data);
            if (text) {
              setMessages(m => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: copy[copy.length - 1].content + text,
                };
                return copy;
              });
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Chat with Max"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          width: 44, height: 44, borderRadius: '50%',
          background: open ? 'var(--surface-3)' : 'var(--accent)',
          border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'all 150ms ease',
        }}
      >
        <i className={`ph ${open ? 'ph-x' : 'ph-chat-circle-dots'}`}
           style={{ fontSize: 20, color: open ? 'var(--fg-muted)' : '#001a10' }}></i>
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 100,
          width: 380, height: 520,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px var(--s-4)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 0 3px var(--success-soft)' }}></div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-strong)' }}>Max</span>
            <span style={{ fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 2 }}>· brain-aware</span>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--fg-subtle)', cursor: 'pointer', fontSize: 11 }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-4)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
            {messages.length === 0 && (
              <div style={{ color: 'var(--fg-subtle)', fontSize: 12, lineHeight: 1.6, textAlign: 'center', marginTop: 'var(--s-8)' }}>
                <div style={{ fontSize: 24, marginBottom: 'var(--s-3)' }}>
                  <i className="ph ph-brain" style={{ color: 'var(--accent)' }}></i>
                </div>
                Ask Max anything about your brain — people, decisions, meetings, ideas.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
              }}>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: m.role === 'user' ? 'var(--r-lg) var(--r-lg) var(--r-xs) var(--r-lg)' : 'var(--r-lg) var(--r-lg) var(--r-lg) var(--r-xs)',
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                  color: m.role === 'user' ? '#001a10' : 'var(--fg)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {m.content || (streaming && i === messages.length - 1
                    ? <span style={{ opacity: 0.5 }}>▋</span>
                    : null
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: 'var(--s-3)',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex', gap: 'var(--s-2)',
            background: 'var(--bg-secondary)',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about your brain…"
              rows={1}
              style={{
                flex: 1, background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-md)',
                padding: '8px 10px',
                fontSize: 13, color: 'var(--fg)',
                fontFamily: 'var(--font-sans)',
                resize: 'none', outline: 'none',
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              style={{
                width: 36, height: 36,
                borderRadius: 'var(--r-md)',
                background: streaming || !input.trim() ? 'var(--surface-2)' : 'var(--accent)',
                border: 'none', cursor: streaming || !input.trim() ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <i className={`ph ${streaming ? 'ph-circle-notch' : 'ph-paper-plane-tilt'}`}
                 style={{
                   fontSize: 16,
                   color: streaming || !input.trim() ? 'var(--fg-disabled)' : '#001a10',
                   animation: streaming ? 'spin 1s linear infinite' : 'none',
                 }}></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
