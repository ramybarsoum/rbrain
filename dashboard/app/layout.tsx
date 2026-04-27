import type { Metadata } from 'next';
import Link from 'next/link';
import { getStats } from '@/lib/operations';
import ChatWidget from '@/components/ChatWidget';
import './globals.css';

export const metadata: Metadata = {
  title: 'RBrain',
  description: 'Personal knowledge brain dashboard',
};

const nav = [
  { href: '/daily',      label: 'Today',          icon: 'ph-sun-horizon' },
  { href: '/open-loops', label: 'Open Loops',     icon: 'ph-radar' },
  { href: '/decisions',  label: 'Decisions',      icon: 'ph-scales' },
  { href: '/todos',      label: 'To-Do',          icon: 'ph-check-square' },
  { href: '/meetings',   label: 'Meetings',       icon: 'ph-users' },
  { href: '/',           label: 'Brain Health',   icon: 'ph-pulse' },
  { href: '/search',     label: 'Search',         icon: 'ph-magnifying-glass' },
  { href: '/feed',       label: 'Feed',           icon: 'ph-list-bullets' },
  { href: '/pages',      label: 'Pages',          icon: 'ph-files' },
  { href: '/graph',      label: 'Graph',          icon: 'ph-graph' },
  { href: '/people',     label: 'People',         icon: 'ph-address-book' },
  { href: '/jobs',       label: 'Agents',         icon: 'ph-stack' },
  { href: '/codex',      label: 'Codex Telemetry', icon: 'ph-terminal-window' },
];

async function SidebarStats() {
  let stats: Awaited<ReturnType<typeof getStats>>;
  try {
    stats = await getStats();
  } catch {
    return null;
  }

  const pages = Number(stats.pages);
  const links = Number(stats.links);
  const chunks = Number(stats.chunks);
  const embedded = Number(stats.embedded_chunks);
  const embPct = chunks > 0 ? ((embedded / chunks) * 100).toFixed(1) : '0';

  return (
    <div className="rb-section">
      <div className="rb-label">Brain</div>
      <div className="rb-stat"><span className="rb-stat-k">Pages</span><span className="rb-stat-v">{pages.toLocaleString()}</span></div>
      <div className="rb-stat"><span className="rb-stat-k">Links</span><span className="rb-stat-v">{links.toLocaleString()}</span></div>
      <div className="rb-stat"><span className="rb-stat-k">Embedded</span><span className="rb-stat-v">{embPct}%</span></div>
    </div>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <script src="https://unpkg.com/@phosphor-icons/web@2.1.1" async></script>
      </head>
      <body>
        <div className="rb-app">
          {/* Sidebar */}
          <aside className="rb-sidebar">
            <div className="rb-brand">
              <div className="rb-brand-mark">R</div>
              <div>
                <div className="rb-brand-name">RBrain</div>
              </div>
              <div className="rb-brand-ver">v1</div>
            </div>

            <div className="rb-section">
              <div className="rb-label">Workspace</div>
              {nav.map(({ href, label, icon }) => (
                <Link key={href} href={href} className="rb-item">
                  <i className={`ph ${icon}`} style={{ fontSize: 16 }}></i>
                  <span>{label}</span>
                </Link>
              ))}
            </div>

            <SidebarStats />

            <div className="rb-foot">
              <div className="rb-foot-dot"></div>
              <div className="rb-foot-text">Connected</div>
              <div className="rb-foot-time">live</div>
            </div>
          </aside>

          {/* Main */}
          <main className="rb-main">
            <header className="rb-topbar">
              <div className="rb-crumbs">
                <span className="mono" style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>brain://</span>
                <span>ramy</span>
                <span className="sep">/</span>
              </div>
              <Link href="/pages?q=" className="rb-topbar-search">
                <i className="ph ph-magnifying-glass" style={{ fontSize: 14 }}></i>
                <span>Search pages…</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 'var(--r-xs)', background: 'var(--bg)' }}>⌘K</span>
              </Link>
              <div className="rb-avatar" title="Ramy Barsoum">RB</div>
            </header>

            <div className="rb-content">{children}</div>
          </main>
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}
