import { getTodos } from '@/lib/operations';
import { createTodo, toggleTodo, removeTodo } from './actions';

export const dynamic = 'force-dynamic';

const P_COLOR: Record<string, string> = {
  p1: 'var(--danger)',
  p2: 'var(--warning)',
  p3: 'var(--fg-subtle)',
};

function TodoRow({ t }: { t: any }) {
  const fm = t.frontmatter ?? {};
  const done: boolean = fm.done === true;
  const priority: string = fm.priority ?? 'p3';
  const dueDate: string | undefined = fm.due_date;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !done && dueDate && dueDate < today;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
      padding: '9px 0', borderBottom: '1px solid var(--separator)',
      opacity: done ? 0.45 : 1,
    }}>
      <form action={toggleTodo.bind(null, t.slug, !done, t.title, priority, dueDate)}>
        <button type="submit" style={{
          width: 16, height: 16, borderRadius: 'var(--r-xs)',
          border: `1.5px solid ${done ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: done ? 'var(--accent-soft)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, cursor: 'pointer', padding: 0,
        }} title={done ? 'Mark open' : 'Mark done'}>
          {done && <i className="ph ph-check" style={{ fontSize: 10, color: 'var(--accent)' }}></i>}
        </button>
      </form>

      <span style={{
        fontSize: 11, fontWeight: 500,
        color: P_COLOR[priority] ?? P_COLOR.p3,
        border: `1px solid ${P_COLOR[priority] ?? P_COLOR.p3}`,
        borderRadius: 'var(--r-xs)',
        padding: '1px 6px',
        opacity: 0.8,
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
      }}>{priority}</span>

      <span style={{
        flex: 1, fontSize: 13,
        color: done ? 'var(--fg-disabled)' : overdue ? 'var(--danger)' : 'var(--fg-strong)',
        textDecoration: done ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{t.title}</span>

      {dueDate && (
        <span className="mono" style={{
          fontSize: 11, flexShrink: 0,
          color: overdue ? 'var(--danger)' : 'var(--fg-subtle)',
        }}>{dueDate}</span>
      )}

      <form action={removeTodo.bind(null, t.slug)}>
        <button type="submit" style={{
          background: 'transparent', border: 'none', padding: '2px 4px',
          color: 'var(--fg-disabled)', cursor: 'pointer', fontSize: 12, flexShrink: 0,
        }} title="Delete">
          <i className="ph ph-x"></i>
        </button>
      </form>
    </div>
  );
}

export default async function TodosPage() {
  const todos = await getTodos();
  const open = (todos as any[]).filter(t => !t.frontmatter?.done);
  const done = (todos as any[]).filter(t => t.frontmatter?.done === true);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">To-Do</h1>
          <p className="page-sub">{open.length} open · {done.length} completed · stored in your brain</p>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>
        {/* Add form */}
        <form action={createTodo} style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-8)' }}>
          <input
            type="text" name="title" required placeholder="New task…"
            style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-md)', padding: '8px var(--s-4)',
              fontSize: 13, color: 'var(--fg-strong)', fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <select name="priority" defaultValue="p2" style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: '8px 10px',
            fontSize: 13, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
          }}>
            <option value="p1">p1 — urgent</option>
            <option value="p2">p2 — normal</option>
            <option value="p3">p3 — low</option>
          </select>
          <input type="date" name="due_date" style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: '8px 10px',
            fontSize: 13, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
          }} />
          <button type="submit" className="btn btn-primary">
            <i className="ph ph-plus"></i>Add
          </button>
        </form>

        {/* Open */}
        <div className="card" style={{ marginBottom: 'var(--s-5)' }}>
          <div className="card-head">
            <div className="card-title">Open</div>
            <div className="card-sub">{open.length} tasks</div>
          </div>
          {open.length > 0
            ? open.map((t: any) => <TodoRow key={t.slug} t={t} />)
            : <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>No open tasks. Add one above.</p>
          }
        </div>

        {/* Completed */}
        {done.length > 0 && (
          <details>
            <summary style={{
              fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: 'pointer', padding: '4px 0', marginBottom: 'var(--s-3)',
              listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <i className="ph ph-caret-right"></i>
              Completed ({done.length})
            </summary>
            <div className="card">
              {done.map((t: any) => <TodoRow key={t.slug} t={t} />)}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
