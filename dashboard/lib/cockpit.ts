export type BrainTodo = {
  slug: string;
  title?: string | null;
  frontmatter?: Record<string, unknown> | null;
  updated_at?: string | Date | null;
  created_at?: string | Date | null;
};

export type OneThing = {
  kind: 'overdue' | 'due_today' | 'meeting' | 'agent_failure' | 'open_loop' | 'clear';
  title: string;
  reason: string;
  href?: string;
  urgency: 'high' | 'medium' | 'low';
};

function priorityRank(todo: BrainTodo) {
  const p = String(todo.frontmatter?.priority ?? 'p3').toLowerCase();
  if (p === 'p1') return 1;
  if (p === 'p2') return 2;
  return 3;
}

function dateOnly(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : undefined;
}

function ageDays(value: unknown, today: string) {
  const d = dateOnly(value);
  if (!d) return undefined;
  const start = new Date(`${d}T12:00:00Z`).getTime();
  const end = new Date(`${today}T12:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.floor((end - start) / 86_400_000);
}

export function getTodoState(todos: BrainTodo[], today: string) {
  const open = todos.filter(t => t.frontmatter?.done !== true);
  const byPriority = (a: BrainTodo, b: BrainTodo) => priorityRank(a) - priorityRank(b);
  const overdue = open
    .filter(t => {
      const due = dateOnly(t.frontmatter?.due_date);
      return !!due && due < today;
    })
    .sort(byPriority);
  const dueToday = open
    .filter(t => dateOnly(t.frontmatter?.due_date) === today)
    .sort(byPriority);
  const upcoming = open
    .filter(t => {
      const due = dateOnly(t.frontmatter?.due_date);
      return !due || due > today;
    })
    .sort(byPriority);

  return { open, overdue, dueToday, upcoming };
}

export function summarizeLoopReason(item: { due_date?: unknown; updated_at?: unknown }, today: string) {
  const due = dateOnly(item.due_date);
  if (due && due < today) return `overdue since ${due}`;
  const age = ageDays(item.updated_at, today);
  if (age !== undefined && age >= 14) return `stale for ${age} days`;
  if (age !== undefined && age >= 7) return `aging for ${age} days`;
  return 'open loop needs owner or next action';
}

export function pickOneThingNow(input: {
  overdueTodos?: BrainTodo[];
  dueToday?: BrainTodo[];
  todayMeetings?: Array<{ slug: string; title?: string | null; frontmatter?: Record<string, unknown> | null }>;
  failedJobs?: Array<{ id: number | string; name?: string | null; status?: string | null }>;
  openLoops?: Array<{ slug: string; title?: string | null; reason?: string }>;
}): OneThing {
  const overdue = [...(input.overdueTodos ?? [])].sort((a, b) => priorityRank(a) - priorityRank(b))[0];
  if (overdue) {
    return {
      kind: 'overdue',
      title: overdue.title ?? overdue.slug,
      reason: `Highest-priority overdue item. Clear this before adding new work.`,
      href: `/todos`,
      urgency: 'high',
    };
  }

  const dueToday = [...(input.dueToday ?? [])].sort((a, b) => priorityRank(a) - priorityRank(b))[0];
  if (dueToday) {
    return {
      kind: 'due_today',
      title: dueToday.title ?? dueToday.slug,
      reason: `Due today. Move it, do it, or explicitly kill it.`,
      href: `/todos`,
      urgency: priorityRank(dueToday) === 1 ? 'high' : 'medium',
    };
  }

  const meeting = input.todayMeetings?.[0];
  if (meeting) {
    return {
      kind: 'meeting',
      title: meeting.title ?? meeting.slug,
      reason: `Next likely leverage point is meeting prep: attendees, asks, and unresolved threads.`,
      href: `/meetings?slug=${encodeURIComponent(meeting.slug)}`,
      urgency: 'medium',
    };
  }

  const failed = input.failedJobs?.[0];
  if (failed) {
    return {
      kind: 'agent_failure',
      title: failed.name ?? `Job ${failed.id}`,
      reason: `An agent failed and may need review or retry.`,
      href: `/jobs`,
      urgency: 'medium',
    };
  }

  const loop = input.openLoops?.[0];
  if (loop) {
    return {
      kind: 'open_loop',
      title: loop.title ?? loop.slug,
      reason: loop.reason ?? 'Old open loop is still unresolved.',
      href: `/open-loops`,
      urgency: 'low',
    };
  }

  return {
    kind: 'clear',
    title: 'No urgent cockpit item detected',
    reason: 'No overdue P1, due-today P1, meetings, or failed agent jobs surfaced from current data.',
    urgency: 'low',
  };
}

export function scoreDecisionEvidence(input: { backlinks: number; timelineEntries: number; chunks: number }) {
  const score = input.backlinks * 2 + input.timelineEntries * 2 + Math.min(input.chunks, 10);
  if (score >= 15) return { score, label: 'High' as const };
  if (score >= 5) return { score, label: 'Medium' as const };
  return { score, label: 'Low' as const };
}
