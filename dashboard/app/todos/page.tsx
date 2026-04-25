import { getTodos } from '@/lib/operations';
import { createTodo, toggleTodo, removeTodo } from './actions';

export const dynamic = 'force-dynamic';

const PRIORITY_BADGE: Record<string, string> = {
  p1: 'text-red-400 border-red-900',
  p2: 'text-amber-400 border-amber-900',
  p3: 'text-zinc-500 border-zinc-800',
};

function TodoRow({ t }: { t: any }) {
  const fm = t.frontmatter ?? {};
  const done: boolean = fm.done === true;
  const priority: string = fm.priority ?? 'p3';
  const dueDate: string | undefined = fm.due_date;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !done && dueDate && dueDate < today;

  return (
    <div className={`flex items-center gap-3 py-2 border-b border-zinc-900 group ${done ? 'opacity-50' : ''}`}>
      {/* Toggle done */}
      <form action={toggleTodo.bind(null, t.slug, !done, t.title, priority, dueDate)}>
        <button
          type="submit"
          className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors
            ${done ? 'bg-zinc-700 border-zinc-600' : 'border-zinc-600 hover:border-zinc-400'}`}
          title={done ? 'Mark open' : 'Mark done'}
        >
          {done && <span className="text-zinc-400 text-xs leading-none">✓</span>}
        </button>
      </form>

      {/* Priority */}
      <span className={`text-xs border rounded px-1 shrink-0 ${PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.p3}`}>
        {priority}
      </span>

      {/* Title */}
      <span className={`flex-1 text-sm ${done ? 'line-through text-zinc-600' : overdue ? 'text-red-300' : 'text-zinc-200'}`}>
        {t.title}
      </span>

      {/* Due date */}
      {dueDate && (
        <span className={`text-xs shrink-0 ${overdue ? 'text-red-500' : 'text-zinc-600'}`}>
          {dueDate}
        </span>
      )}

      {/* Delete */}
      <form action={removeTodo.bind(null, t.slug)}>
        <button
          type="submit"
          className="text-zinc-700 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Delete"
        >
          ✕
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
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">To-Do</h1>
        <span className="text-xs text-zinc-500">{open.length} open · {done.length} done</span>
      </div>

      {/* Add form */}
      <form action={createTodo} className="flex gap-2 mb-8">
        <input
          type="text"
          name="title"
          required
          placeholder="New task…"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <select
          name="priority"
          defaultValue="p2"
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-400 focus:outline-none"
        >
          <option value="p1">p1</option>
          <option value="p2">p2</option>
          <option value="p3">p3</option>
        </select>
        <input
          type="date"
          name="due_date"
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-400 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm px-3 py-1.5 rounded transition-colors"
        >
          Add
        </button>
      </form>

      {/* Open todos */}
      {open.length > 0 ? (
        <div className="mb-8">
          {open.map((t: any) => <TodoRow key={t.slug} t={t} />)}
        </div>
      ) : (
        <p className="text-sm text-zinc-600 mb-8">No open tasks. Add one above.</p>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <details className="group">
          <summary className="text-xs text-zinc-500 uppercase tracking-widest cursor-pointer hover:text-zinc-400 mb-3 list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Completed ({done.length})
          </summary>
          <div className="mt-2">
            {done.map((t: any) => <TodoRow key={t.slug} t={t} />)}
          </div>
        </details>
      )}
    </div>
  );
}
