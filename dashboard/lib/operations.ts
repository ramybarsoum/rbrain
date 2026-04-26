import { getDb } from './db';
import { getTodoState, pickOneThingNow, scoreDecisionEvidence, summarizeLoopReason, type BrainTodo } from './cockpit';

const sql = () => getDb();

// ── Pages ──────────────────────────────────────────────────────────────────

export async function getPage(slug: string) {
  const rows = await sql()`
    SELECT id, slug, type, title, compiled_truth, timeline, frontmatter, content_hash, created_at, updated_at
    FROM pages WHERE slug = ${slug} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getPersonDetail(slug: string) {
  const db = sql();
  const [pages, outLinks, inLinks, timeline] = await Promise.all([
    db`SELECT id, slug, title, frontmatter, compiled_truth, updated_at FROM pages WHERE slug = ${slug} LIMIT 1`,
    // outgoing links (who this person is connected to)
    db`
      SELECT tp.slug AS target_slug, tp.title AS target_title, tp.type AS target_type, l.link_type
      FROM links l
      JOIN pages p  ON p.id  = l.from_page_id
      JOIN pages tp ON tp.id = l.to_page_id
      WHERE p.slug = ${slug}
      ORDER BY l.link_type, tp.title LIMIT 20
    `,
    // incoming links (who mentions this person)
    db`
      SELECT p.slug AS source_slug, p.title AS source_title, p.type AS source_type, l.link_type
      FROM links l
      JOIN pages p  ON p.id  = l.from_page_id
      JOIN pages tp ON tp.id = l.to_page_id
      WHERE tp.slug = ${slug}
      ORDER BY l.link_type, p.title LIMIT 20
    `,
    // recent timeline entries
    db`
      SELECT t.date, t.summary, t.source FROM timeline_entries t
      JOIN pages p ON p.id = t.page_id
      WHERE p.slug = ${slug}
      ORDER BY t.date DESC LIMIT 10
    `,
  ]);
  return { page: pages[0] ?? null, outLinks, inLinks, timeline };
}

export async function listPages(opts: { type?: string; tag?: string; limit?: number; days?: number }) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const db = sql();
  if (opts.tag) {
    return db`
      SELECT p.id, p.slug, p.type, p.title, p.updated_at
      FROM pages p JOIN tags t ON t.page_id = p.id
      WHERE t.tag = ${opts.tag} ${opts.type ? db`AND p.type = ${opts.type}` : db``}
      ORDER BY p.updated_at DESC LIMIT ${limit}
    `;
  }
  if (opts.days) {
    const since = new Date(Date.now() - opts.days * 86400_000).toISOString();
    return db`
      SELECT id, slug, type, title, updated_at FROM pages
      WHERE updated_at >= ${since} ${opts.type ? db`AND type = ${opts.type}` : db``}
      ORDER BY updated_at DESC LIMIT ${limit}
    `;
  }
  if (opts.type) {
    return db`SELECT id, slug, type, title, updated_at FROM pages WHERE type = ${opts.type} ORDER BY updated_at DESC LIMIT ${limit}`;
  }
  return db`SELECT id, slug, type, title, updated_at FROM pages ORDER BY updated_at DESC LIMIT ${limit}`;
}

export async function getPageTypes() {
  const rows = await sql()`
    SELECT type, count(*)::int AS count FROM pages
    GROUP BY type ORDER BY count DESC
  `;
  return rows as unknown as { type: string; count: number }[];
}

export async function putPage(slug: string, p: {
  type: string; title: string; compiled_truth: string;
  timeline?: string; frontmatter?: Record<string, unknown>;
}) {
  const db = sql();
  const rows = await db`
    INSERT INTO pages (source_id, slug, type, title, compiled_truth, timeline, frontmatter, updated_at)
    VALUES ('dashboard', ${slug}, ${p.type}, ${p.title}, ${p.compiled_truth},
            ${p.timeline ?? ''}, ${JSON.stringify(p.frontmatter ?? {})}::jsonb, now())
    ON CONFLICT (source_id, slug) DO UPDATE SET
      type = EXCLUDED.type, title = EXCLUDED.title,
      compiled_truth = EXCLUDED.compiled_truth, timeline = EXCLUDED.timeline,
      frontmatter = EXCLUDED.frontmatter, updated_at = now()
    RETURNING id, slug, type, title, updated_at
  `;
  return rows[0];
}

export async function deletePage(slug: string) {
  await sql()`DELETE FROM pages WHERE slug = ${slug} AND source_id = 'dashboard'`;
  return { status: 'deleted', slug };
}

export async function resolveSlugs(partial: string) {
  const pattern = `%${partial.toLowerCase()}%`;
  const rows = await sql()`
    SELECT slug FROM pages WHERE slug ILIKE ${pattern} ORDER BY slug LIMIT 10
  `;
  return rows.map(r => r.slug as string);
}

// ── Search ─────────────────────────────────────────────────────────────────

export async function search(query: string, opts: { limit?: number; type?: string }) {
  const limit = Math.min(opts.limit ?? 20, 50);
  const db = sql();
  const rows = await db`
    SELECT DISTINCT ON (p.slug)
      p.slug, p.type, p.title,
      c.chunk_text,
      ts_rank(to_tsvector('english', c.chunk_text), plainto_tsquery('english', ${query})) AS score
    FROM content_chunks c
    JOIN pages p ON p.id = c.page_id
    WHERE to_tsvector('english', c.chunk_text) @@ plainto_tsquery('english', ${query})
      ${opts.type ? db`AND p.type = ${opts.type}` : db``}
    ORDER BY p.slug, score DESC
    LIMIT ${limit}
  `;
  return rows;
}

// ── Tags ───────────────────────────────────────────────────────────────────

export async function getTags(slug: string) {
  const rows = await sql()`
    SELECT t.tag FROM tags t JOIN pages p ON p.id = t.page_id WHERE p.slug = ${slug}
  `;
  return rows.map(r => r.tag as string);
}

export async function addTag(slug: string, tag: string) {
  const db = sql();
  const page = await db`SELECT id FROM pages WHERE slug = ${slug} LIMIT 1`;
  if (!page.length) throw new Error(`Page not found: ${slug}`);
  await db`INSERT INTO tags (page_id, tag) VALUES (${page[0].id}, ${tag}) ON CONFLICT DO NOTHING`;
  return { slug, tag };
}

export async function removeTag(slug: string, tag: string) {
  const db = sql();
  const page = await db`SELECT id FROM pages WHERE slug = ${slug} LIMIT 1`;
  if (!page.length) throw new Error(`Page not found: ${slug}`);
  await db`DELETE FROM tags WHERE page_id = ${page[0].id} AND tag = ${tag}`;
  return { slug, tag };
}

// ── Links / Graph ──────────────────────────────────────────────────────────

export async function getLinks(slug: string) {
  const rows = await sql()`
    SELECT tp.slug AS target_slug, l.link_type, l.created_at
    FROM links l
    JOIN pages p  ON p.id  = l.from_page_id
    JOIN pages tp ON tp.id = l.to_page_id
    WHERE p.slug = ${slug}
  `;
  return rows;
}

export async function getBacklinks(slug: string) {
  const rows = await sql()`
    SELECT p.slug AS source_slug, l.link_type, l.created_at
    FROM links l
    JOIN pages p  ON p.id  = l.from_page_id
    JOIN pages tp ON tp.id = l.to_page_id
    WHERE tp.slug = ${slug}
  `;
  return rows;
}

export async function addLink(sourceSlug: string, targetSlug: string, linkType?: string) {
  const db = sql();
  const [src] = await db`SELECT id FROM pages WHERE slug = ${sourceSlug} LIMIT 1`;
  const [tgt] = await db`SELECT id FROM pages WHERE slug = ${targetSlug} LIMIT 1`;
  if (!src || !tgt) throw new Error('One or both pages not found');
  await db`
    INSERT INTO links (from_page_id, to_page_id, link_type, link_source)
    VALUES (${src.id}, ${tgt.id}, ${linkType ?? 'mentions'}, 'manual')
    ON CONFLICT DO NOTHING
  `;
  return { source: sourceSlug, target: targetSlug, link_type: linkType ?? 'mentions' };
}

// ── Todos ──────────────────────────────────────────────────────────────────

export async function getTodos(opts: { done?: boolean } = {}) {
  const db = sql();
  const rows = opts.done !== undefined
    ? await db`
        SELECT slug, title, frontmatter, created_at, updated_at FROM pages
        WHERE type = 'todo' AND source_id = 'dashboard'
          AND (frontmatter->>'done')::boolean = ${opts.done}
        ORDER BY
          CASE frontmatter->>'priority' WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
          (frontmatter->>'due_date') ASC NULLS LAST,
          created_at ASC
      `
    : await db`
        SELECT slug, title, frontmatter, created_at, updated_at FROM pages
        WHERE type = 'todo' AND source_id = 'dashboard'
        ORDER BY
          (frontmatter->>'done')::boolean ASC,
          CASE frontmatter->>'priority' WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
          (frontmatter->>'due_date') ASC NULLS LAST,
          created_at ASC
      `;
  return rows;
}

export async function upsertTodo(slug: string, fields: {
  title: string;
  done: boolean;
  priority: string;
  due_date?: string;
}) {
  const db = sql();
  const fm = JSON.stringify({ done: fields.done, priority: fields.priority, due_date: fields.due_date ?? null });
  const rows = await db`
    INSERT INTO pages (source_id, slug, type, title, compiled_truth, frontmatter, updated_at)
    VALUES ('dashboard', ${slug}, 'todo', ${fields.title}, ${fields.title}, ${fm}::jsonb, now())
    ON CONFLICT (source_id, slug) DO UPDATE SET
      title = EXCLUDED.title,
      compiled_truth = EXCLUDED.compiled_truth,
      frontmatter = EXCLUDED.frontmatter,
      updated_at = now()
    RETURNING slug, title, frontmatter, updated_at
  `;
  return rows[0];
}

// ── Meetings ───────────────────────────────────────────────────────────────

export async function getMeetings(opts: { limit?: number } = {}) {
  const db = sql();
  const limit = Math.min(opts.limit ?? 100, 200);
  // Circleback uses frontmatter->>'date' (YYYY-MM-DD)
  // Old Granola archive uses frontmatter->>'v0_meeting_at' (ISO timestamp)
  // COALESCE so both sort correctly newest-first
  return db`
    SELECT slug, title, frontmatter, updated_at FROM pages
    WHERE type = 'meeting'
    ORDER BY
      COALESCE(
        frontmatter->>'date',
        (frontmatter->>'v0_meeting_at')::date::text
      ) DESC NULLS LAST,
      updated_at DESC
    LIMIT ${limit}
  `;
}

export async function getMeetingAttendees(meetingSlug: string) {
  const db = sql();
  // Graph-linked people (from v0 archive migration)
  return db`
    SELECT p.slug, p.title, p.frontmatter, l.link_type
    FROM links l
    JOIN pages p  ON p.id  = l.from_page_id
    JOIN pages m  ON m.id  = l.to_page_id
    WHERE m.slug = ${meetingSlug}
      AND p.type = 'person'
    ORDER BY p.title
  `;
}

export async function getDailyBriefData() {
  return getCommandCenterData();
}

export async function getCommandCenterData() {
  const db = sql();
  const today = new Date().toISOString().slice(0, 10);
  const since24h = new Date(Date.now() - 86400_000).toISOString();
  const since14d = new Date(Date.now() - 14 * 86400_000).toISOString();

  const [openTodos, recentPages, todayTimeline, todayMeetings, hotPeople, candidateDecisions, failedJobs, recentMeetings] = await Promise.all([
    db`
      SELECT slug, title, frontmatter, created_at, updated_at FROM pages
      WHERE type = 'todo' AND source_id = 'dashboard'
        AND (frontmatter->>'done')::boolean = false
      ORDER BY
        CASE frontmatter->>'priority' WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
        (frontmatter->>'due_date') ASC NULLS LAST
      LIMIT 50
    `,
    db`
      SELECT slug, type, title, updated_at FROM pages
      WHERE type != 'todo' AND updated_at >= ${since24h}
      ORDER BY updated_at DESC LIMIT 12
    `,
    db`
      SELECT t.summary, t.date, p.slug, p.title FROM timeline_entries t
      JOIN pages p ON p.id = t.page_id
      WHERE t.date = ${today}::date
      ORDER BY t.created_at DESC LIMIT 20
    `,
    db`
      SELECT slug, title, frontmatter FROM pages
      WHERE type = 'meeting'
        AND (
          frontmatter->>'date' = ${today}
          OR (frontmatter->>'v0_meeting_at')::date::text = ${today}
        )
      ORDER BY
        COALESCE(frontmatter->>'date', (frontmatter->>'v0_meeting_at')::date::text) ASC,
        updated_at DESC
      LIMIT 6
    `,
    db`
      SELECT p.slug, p.title, p.frontmatter, p.updated_at, count(l.*)::int AS touch_count
      FROM pages p
      LEFT JOIN links l ON l.from_page_id = p.id OR l.to_page_id = p.id
      WHERE p.type = 'person' AND p.updated_at >= ${since14d}
      GROUP BY p.id
      ORDER BY p.updated_at DESC, touch_count DESC
      LIMIT 8
    `,
    db`
      SELECT slug, type, title, frontmatter, updated_at FROM pages
      WHERE type ILIKE '%decision%'
         OR title ILIKE '%decision%'
         OR compiled_truth ILIKE '%decide%'
         OR compiled_truth ILIKE '%approved%'
         OR compiled_truth ILIKE '%pending decision%'
      ORDER BY updated_at DESC
      LIMIT 8
    `,
    db`
      SELECT id, name, status, updated_at FROM minion_jobs
      WHERE status IN ('failed', 'needs_review')
      ORDER BY updated_at DESC
      LIMIT 5
    `.catch(() => []),
    db`
      SELECT slug, title, frontmatter, updated_at FROM pages
      WHERE type = 'meeting'
      ORDER BY updated_at DESC
      LIMIT 6
    `,
  ]);

  const todoState = getTodoState(openTodos as unknown as BrainTodo[], today);
  const oneThingNow = pickOneThingNow({
    overdueTodos: todoState.overdue,
    dueToday: todoState.dueToday,
    todayMeetings: todayMeetings as unknown as Array<{ slug: string; title?: string | null; frontmatter?: Record<string, unknown> | null }>,
    failedJobs: failedJobs as unknown as Array<{ id: number | string; name?: string | null; status?: string | null }>,
  });

  return {
    today,
    openTodos,
    recentPages,
    todayTimeline,
    todayMeetings,
    recentMeetings,
    hotPeople,
    candidateDecisions,
    failedJobs,
    todoState,
    oneThingNow,
  };
}

type LoopRow = Record<string, unknown> & {
  slug: string;
  title?: string | null;
  loop_type: string;
  updated_at?: string;
  frontmatter?: Record<string, unknown> | null;
};

type DecisionRow = Record<string, unknown> & {
  slug: string;
  title?: string | null;
  frontmatter?: Record<string, unknown> | null;
  backlinks?: number | string | null;
  timeline_entries?: number | string | null;
  chunks?: number | string | null;
};

export async function getOpenLoopsData() {
  const db = sql();
  const today = new Date().toISOString().slice(0, 10);
  const staleBefore = new Date(Date.now() - 7 * 86400_000).toISOString();
  const draftBefore = new Date(Date.now() - 14 * 86400_000).toISOString();
  const recentBefore = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [todos, meetingActions, promises, drafts] = await Promise.all([
    db`
      SELECT slug, title, frontmatter, updated_at, 'task' AS loop_type
      FROM pages
      WHERE type = 'todo' AND source_id = 'dashboard'
        AND (frontmatter->>'done')::boolean = false
        AND ((frontmatter->>'due_date') < ${today} OR updated_at < ${staleBefore})
      ORDER BY
        CASE frontmatter->>'priority' WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
        updated_at ASC
      LIMIT 25
    `,
    db`
      SELECT slug, title, frontmatter, updated_at, 'meeting action' AS loop_type
      FROM pages
      WHERE type = 'meeting' AND updated_at >= ${recentBefore}
        AND (
          compiled_truth ILIKE '%action%'
          OR compiled_truth ILIKE '%follow up%'
          OR compiled_truth ILIKE '%owner%'
          OR compiled_truth ILIKE '%pending%'
          OR compiled_truth ILIKE '%blocked%'
        )
      ORDER BY updated_at ASC
      LIMIT 20
    `,
    db`
      SELECT slug, type, title, frontmatter, updated_at, 'promise' AS loop_type
      FROM pages
      WHERE updated_at >= ${recentBefore}
        AND (
          compiled_truth ILIKE '%I will%'
          OR compiled_truth ILIKE '%we will%'
          OR compiled_truth ILIKE '%promise%'
          OR compiled_truth ILIKE '%send %'
          OR compiled_truth ILIKE '%follow up%'
        )
      ORDER BY updated_at ASC
      LIMIT 20
    `,
    db`
      SELECT slug, type, title, frontmatter, updated_at, 'abandoned draft' AS loop_type
      FROM pages
      WHERE updated_at < ${draftBefore}
        AND (type ILIKE '%draft%' OR title ILIKE '%draft%' OR slug ILIKE '%draft%')
      ORDER BY updated_at ASC
      LIMIT 20
    `,
  ]);

  const annotate = (rows: LoopRow[]) => rows.map(row => ({
    ...row,
    reason: summarizeLoopReason({
      due_date: row.frontmatter?.due_date,
      updated_at: row.updated_at,
    }, today),
    suggested_action: row.loop_type === 'task'
      ? 'Do, defer, delegate, or delete.'
      : 'Ask Max to extract owner + next action from the source.',
  }));

  return {
    today,
    todos: annotate(todos as unknown as LoopRow[]),
    meetingActions: annotate(meetingActions as unknown as LoopRow[]),
    promises: annotate(promises as unknown as LoopRow[]),
    drafts: annotate(drafts as unknown as LoopRow[]),
  };
}

export async function getDecisionLedgerData() {
  const db = sql();
  const [made, pending] = await Promise.all([
    db`
      SELECT p.id, p.slug, p.type, p.title, p.frontmatter, p.updated_at,
             count(DISTINCT l.from_page_id)::int AS backlinks,
             count(DISTINCT t.id)::int AS timeline_entries,
             count(DISTINCT c.id)::int AS chunks
      FROM pages p
      LEFT JOIN links l ON l.to_page_id = p.id
      LEFT JOIN timeline_entries t ON t.page_id = p.id
      LEFT JOIN content_chunks c ON c.page_id = p.id
      WHERE p.type ILIKE '%decision%'
         OR p.title ILIKE '%decision%'
         OR p.compiled_truth ILIKE '%decided%'
         OR p.compiled_truth ILIKE '%approved%'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT 40
    `,
    db`
      SELECT p.id, p.slug, p.type, p.title, p.frontmatter, p.updated_at,
             count(DISTINCT l.from_page_id)::int AS backlinks,
             count(DISTINCT t.id)::int AS timeline_entries,
             count(DISTINCT c.id)::int AS chunks
      FROM pages p
      LEFT JOIN links l ON l.to_page_id = p.id
      LEFT JOIN timeline_entries t ON t.page_id = p.id
      LEFT JOIN content_chunks c ON c.page_id = p.id
      WHERE p.compiled_truth ILIKE '%decide%'
         OR p.compiled_truth ILIKE '%decision pending%'
         OR p.compiled_truth ILIKE '%blocked on%'
         OR p.compiled_truth ILIKE '%choose%'
         OR p.compiled_truth ILIKE '%approve%'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT 40
    `,
  ]);

  const enrich = (rows: DecisionRow[]) => rows.map(row => ({
    ...row,
    evidence: scoreDecisionEvidence({
      backlinks: Number(row.backlinks ?? 0),
      timelineEntries: Number(row.timeline_entries ?? 0),
      chunks: Number(row.chunks ?? 0),
    }),
    owner: row.frontmatter?.owner ?? row.frontmatter?.assignee ?? 'unknown',
    deadline: row.frontmatter?.deadline ?? row.frontmatter?.due_date ?? null,
    reversibility: row.frontmatter?.reversibility ?? 'unknown',
    why: row.frontmatter?.why ?? row.frontmatter?.rationale ?? 'No explicit rationale captured yet.',
  }));

  return { made: enrich(made as unknown as DecisionRow[]), pending: enrich(pending as unknown as DecisionRow[]) };
}

// ── Feed (recent activity) ────────────────────────────────────────────────

export async function getFeedData(opts: { days?: number; type?: string; limit?: number } = {}) {
  const db = sql();
  const limit = Math.min(opts.limit ?? 50, 200);
  const since = new Date(Date.now() - (opts.days ?? 7) * 86400_000).toISOString();

  const [recentPages, recentTimeline] = await Promise.all([
    opts.type
      ? db`SELECT id, slug, type, title, updated_at FROM pages WHERE type = ${opts.type} AND updated_at >= ${since} ORDER BY updated_at DESC LIMIT ${limit}`
      : db`SELECT id, slug, type, title, updated_at FROM pages WHERE type != 'todo' AND updated_at >= ${since} ORDER BY updated_at DESC LIMIT ${limit}`,
    db`
      SELECT t.date, t.summary, t.source, p.slug, p.type, p.title AS page_title
      FROM timeline_entries t JOIN pages p ON p.id = t.page_id
      WHERE t.date >= ${since.slice(0, 10)}::date
      ORDER BY t.date DESC, t.created_at DESC LIMIT ${limit}
    `,
  ]);
  return { recentPages, recentTimeline };
}

// ── Jobs (Minions) ────────────────────────────────────────────────────────

export async function getJobsData() {
  const db = sql();
  const [stats, jobs] = await Promise.all([
    db`
      SELECT status, count(*)::int AS count FROM minion_jobs
      GROUP BY status
    `,
    db`
      SELECT id, name, queue, status, priority, attempts_made, max_attempts,
             tokens_input, tokens_output, created_at, updated_at
      FROM minion_jobs
      ORDER BY updated_at DESC LIMIT 50
    `,
  ]);
  return { stats, jobs };
}

// ── Timeline ───────────────────────────────────────────────────────────────

export async function getTimeline(slug?: string, limit = 50) {
  const db = sql();
  const rows = slug
    ? await db`
        SELECT t.id, t.date, t.summary, t.source, p.slug FROM timeline_entries t
        JOIN pages p ON p.id = t.page_id
        WHERE p.slug = ${slug}
        ORDER BY t.date DESC LIMIT ${limit}
      `
    : await db`
        SELECT t.id, t.date, t.summary, t.source, p.slug FROM timeline_entries t
        JOIN pages p ON p.id = t.page_id
        ORDER BY t.date DESC LIMIT ${limit}
      `;
  return rows;
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getStats() {
  const db = sql();
  const [counts] = await db`
    SELECT
      (SELECT count(*) FROM pages)                                    AS pages,
      (SELECT count(*) FROM content_chunks)                          AS chunks,
      (SELECT count(*) FROM links)                                    AS links,
      (SELECT count(*) FROM tags)                                     AS tags,
      (SELECT count(*) FROM timeline_entries)                        AS timeline_entries,
      (SELECT count(*) FROM content_chunks WHERE embedding IS NOT NULL) AS embedded_chunks
  `;
  return counts;
}

// ── Graph data ─────────────────────────────────────────────────────────────

type GraphNode = { id: number; slug: string; type: string; title: string };
// Aliased back to source_page_id/target_page_id so ForceGraph component is unchanged
type GraphLink = { source_page_id: number; target_page_id: number; link_type: string };

export async function getGraphData(opts: { type?: string; limit?: number }): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const limit = Math.min(opts.limit ?? 500, 2000);
  const db = sql();
  const rawPages = opts.type
    ? await db`SELECT id, slug, type, title FROM pages WHERE type = ${opts.type} ORDER BY updated_at DESC LIMIT ${limit}`
    : await db`SELECT id, slug, type, title FROM pages ORDER BY updated_at DESC LIMIT ${limit}`;

  const pages = rawPages as unknown as GraphNode[];
  const pageIds = pages.map(p => p.id);
  if (!pageIds.length) return { nodes: [], links: [] };

  // Alias to source_page_id/target_page_id — keeps ForceGraph component untouched
  const rawLinks = await db`
    SELECT from_page_id AS source_page_id, to_page_id AS target_page_id, link_type
    FROM links
    WHERE from_page_id = ANY(${pageIds}::int[])
      AND to_page_id   = ANY(${pageIds}::int[])
  `;

  return { nodes: pages, links: rawLinks as unknown as GraphLink[] };
}
