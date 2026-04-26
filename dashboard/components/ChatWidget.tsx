'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface Message { role: 'user' | 'assistant'; content: string; time: string; }

interface ScopeMeta {
  scope: string;
  label: string;
  greet: string;
  suggestions: { icon: string; text: string }[];
}

const SCOPE_META: Record<string, ScopeMeta> = {
  '/':         { scope: 'brain.health',  label: '/health',
    greet: "Hey — I'm Max, the Hermes Agent. I'm watching Brain Health right now. What do you want to know about your brain?",
    suggestions: [
      { icon: 'ph-stethoscope',    text: 'Why did the score change this week?' },
      { icon: 'ph-link-break',     text: 'Walk me through the dead links' },
      { icon: 'ph-warning',        text: 'Which orphan pages should I merge?' },
    ]},
  '/search':   { scope: 'brain.search',  label: '/search',
    greet: "I can search across your brain, summarize clusters, or find duplicate ideas. What are you looking for?",
    suggestions: [
      { icon: 'ph-list',    text: 'Summarize my recent search results' },
      { icon: 'ph-copy',    text: 'Find near-duplicate ideas to merge' },
      { icon: 'ph-quotes',  text: 'What are my strongest recurring themes?' },
    ]},
  '/graph':    { scope: 'brain.graph',   label: '/graph',
    greet: "Looking at your knowledge graph. I can find clusters, trace paths, or suggest missing links. What do you need?",
    suggestions: [
      { icon: 'ph-graph',  text: 'Find the most connected people' },
      { icon: 'ph-path',   text: 'Trace a path between two concepts' },
      { icon: 'ph-link',   text: 'Suggest missing edges in the graph' },
    ]},
  '/feed':     { scope: 'brain.feed',    label: '/feed',
    greet: "Caught up on your brain activity. I can give you a digest, surface themes, or flag anything to action. What do you want?",
    suggestions: [
      { icon: 'ph-newspaper', text: 'Give me a daily digest' },
      { icon: 'ph-funnel',    text: 'Show only decisions this week' },
      { icon: 'ph-bell',      text: 'Anything I should action by Friday?' },
    ]},
  '/jobs':     { scope: 'brain.jobs',    label: '/jobs',
    greet: "Watching the Minions queue. I can diagnose failures, retry jobs, or explain what's stuck. What do you want?",
    suggestions: [
      { icon: 'ph-arrow-clockwise', text: 'Retry all rate-limited failures' },
      { icon: 'ph-bug',             text: 'Diagnose the latest failures' },
      { icon: 'ph-gauge',           text: 'Why is the queue backing up?' },
    ]},
  '/meetings': { scope: 'brain.meetings', label: '/meetings',
    greet: "I can brief you on any meeting — attendees, prior interactions, decisions made. Which meeting?",
    suggestions: [
      { icon: 'ph-users',     text: 'Brief me on my next meeting' },
      { icon: 'ph-calendar',  text: "Summarize last week's meetings" },
      { icon: 'ph-list-star', text: 'What action items are still open?' },
    ]},
  '/people':   { scope: 'brain.people',  label: '/people',
    greet: "I know your 373 people. I can look up anyone, surface their timeline, or find connections. Who do you want to know about?",
    suggestions: [
      { icon: 'ph-user-circle',    text: 'Who have I interacted with most?' },
      { icon: 'ph-buildings',      text: 'Who works at a specific company?' },
      { icon: 'ph-clock-counter-clockwise', text: "Who haven't I talked to in 30+ days?" },
    ]},
  '/daily':    { scope: 'brain.daily',   label: '/daily',
    greet: "I see your daily brief. I can expand on any item, help you prioritize, or prep you for today's meetings.",
    suggestions: [
      { icon: 'ph-list-checks', text: 'Help me prioritize today' },
      { icon: 'ph-calendar',    text: 'Prep me for my first meeting' },
      { icon: 'ph-trend-up',    text: "What's the most urgent thing?" },
    ]},
  '/todos':    { scope: 'brain.todos',   label: '/todos',
    greet: "I see your task list. I can help prioritize, break down a task, or find related brain content.",
    suggestions: [
      { icon: 'ph-check-square', text: 'What should I work on first?' },
      { icon: 'ph-link',         text: 'Find brain pages related to a task' },
      { icon: 'ph-clock',        text: "What's overdue right now?" },
    ]},
  '/pages':    { scope: 'brain.pages',   label: '/pages',
    greet: "You have 15,000+ pages in your brain. I can search, summarize, or find connections between them.",
    suggestions: [
      { icon: 'ph-magnifying-glass', text: 'Find pages about a topic' },
      { icon: 'ph-trash',            text: 'What pages should I clean up?' },
      { icon: 'ph-tag',              text: 'What tags do I use most?' },
    ]},
  '/open-loops': { scope: 'brain.open_loops', label: '/open-loops',
    greet: "I'm watching stale tasks, promises, unresolved meeting actions, and abandoned drafts. Which loop should we close first?",
    suggestions: [
      { icon: 'ph-radar', text: 'What am I avoiding?' },
      { icon: 'ph-clock', text: 'Which stale loop is most expensive?' },
      { icon: 'ph-check', text: 'Help me close the top open loop' },
    ]},
  '/decisions': { scope: 'brain.decisions', label: '/decisions',
    greet: "Decision ledger is open. I can pressure-test pending decisions, explain evidence quality, or run CEO mode.",
    suggestions: [
      { icon: 'ph-scales', text: 'Show me the 5 decisions that matter this week' },
      { icon: 'ph-question', text: 'Generate board-level hard questions' },
      { icon: 'ph-arrows-clockwise', text: 'Which decisions are reversible?' },
    ]},
};

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scopeFor(pathname: string): ScopeMeta {
  return SCOPE_META[pathname] ?? SCOPE_META['/'];
}

export default function ChatWidget() {
  const pathname = usePathname() || '/';
  const [open, setOpen]         = useState(true);
  const [messages, setMessages] = useState<Message[]>(() => {
    return [{ role: 'assistant', content: scopeFor(pathname).greet, time: '' }];
  });
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const [scopeOn, setScopeOn]   = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 220);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ⌘J shortcut focuses the always-on command surface
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: text, time: nowTime() };
    const history = [...messages, userMsg];
    setMessages(history);
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '', time: nowTime() };
    setMessages(m => [...m, assistantMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          scope: scopeOn ? scopeFor(pathname).scope : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setMessages(m => { const c = [...m]; c[c.length-1] = { role: 'assistant', content: `Error: ${err.error ?? 'Failed'}`, time: nowTime() }; return c; });
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
            const { text: chunk } = JSON.parse(data);
            if (chunk) setMessages(m => { const c = [...m]; c[c.length-1] = { ...c[c.length-1], content: c[c.length-1].content + chunk }; return c; });
          } catch { /* skip */ }
        }
      }
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming, pathname, scopeOn]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const meta = scopeFor(pathname);
  const showSuggestions = messages.length <= 1;

  return (
    <>
      {/* Max is always-on in AI-native mode. */}
      {/* Chat panel */}
      <aside className={`chat-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        {/* Header */}
        <div className="chat-head">
          <div className="chat-avatar">M</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="chat-name">Max</div>
              <span className="pill pill-success" style={{ fontSize: 10, padding: '1px 6px' }}>
                <span className="pill-dot"></span>online
              </span>
            </div>
            <div className="chat-sub">
              Hermes Agent · scope <span className="scope-tag">{meta.label}</span>
            </div>
          </div>
          <div className="chat-head-actions">
            <button className="chat-head-btn" title="New thread" onClick={() => setMessages([])}>
              <i className="ph ph-plus"></i>
            </button>
          </div>
        </div>

        {/* Context bar */}
        <div className="chat-context">
          <i className="ph ph-target"></i>
          <span>Scoped to <span className="scope">{meta.scope}</span></span>
          <span className="ctx-count">{meta.label}</span>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i}>
              <div className={`msg ${m.role}`}>
                {m.role === 'assistant' && <div className="msg-avatar">M</div>}
                <div>
                  <div className="msg-bubble">
                    {m.content || (streaming && i === messages.length - 1
                      ? <span className="thinking-dots"><span></span><span></span><span></span></span>
                      : null)}
                  </div>
                  <div className="msg-time">{m.time}</div>
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="chat-suggestions">
            {meta.suggestions.map((s, i) => (
              <button key={i} className="suggest-chip" onClick={() => { setInput(s.text); setTimeout(() => inputRef.current?.focus(), 50); }}>
                <i className={`ph ${s.icon}`}></i>
                {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="chat-composer">
          <div className="composer-row">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask Max about this view…"
              rows={1}
            />
            <button className="composer-send" onClick={send} disabled={streaming || !input.trim()} title="Send">
              <i className={`ph ${streaming ? 'ph-circle-notch' : 'ph-arrow-up'}`}
                 style={streaming ? { animation: 'spin 1s linear infinite' } : undefined}></i>
            </button>
          </div>
          <div className="composer-tools">
            <button className={`composer-tool${scopeOn ? ' on' : ''}`} onClick={() => setScopeOn(s => !s)} title="Include view context">
              <i className="ph ph-target"></i>Scope
            </button>
            <button className="composer-tool" title="Search the brain" onClick={() => { setInput('Search my brain for: '); inputRef.current?.focus(); }}>
              <i className="ph ph-magnifying-glass"></i>Search
            </button>
            <span className="composer-hint">⏎ send · ⇧⏎ newline</span>
          </div>
        </div>
      </aside>
    </>
  );
}
