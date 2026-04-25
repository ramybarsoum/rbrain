import { getDb } from './db';

const sql = () => getDb();

// ── Pages ──────────────────────────────────────────────────────────────────

export async function getPage(slug: string) {
  const rows = await sql()`
    SELECT id, slug, type, title, compiled_truth, timeline, frontmatter, content_hash, created_at, updated_at
    FROM pages WHERE slug = ${slug}
  `;
  return rows[0] ?? null;
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

export async function putPage(slug: string, p: {
  type: string; title: string; compiled_truth: string;
  timeline?: string; frontmatter?: Record<string, unknown>;
}) {
  const db = sql();
  const rows = await db`
    INSERT INTO pages (slug, type, title, compiled_truth, timeline, frontmatter, updated_at)
    VALUES (${slug}, ${p.type}, ${p.title}, ${p.compiled_truth},
            ${p.timeline ?? ''}, ${JSON.stringify(p.frontmatter ?? {})}::jsonb, now())
    ON CONFLICT (slug) DO UPDATE SET
      type = EXCLUDED.type, title = EXCLUDED.title,
      compiled_truth = EXCLUDED.compiled_truth, timeline = EXCLUDED.timeline,
      frontmatter = EXCLUDED.frontmatter, updated_at = now()
    RETURNING id, slug, type, title, updated_at
  `;
  return rows[0];
}

export async function deletePage(slug: string) {
  await sql()`DELETE FROM pages WHERE slug = ${slug}`;
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
    SELECT l.target_slug, l.link_type, l.created_at
    FROM links l JOIN pages p ON p.id = l.source_page_id
    WHERE p.slug = ${slug}
  `;
  return rows;
}

export async function getBacklinks(slug: string) {
  const rows = await sql()`
    SELECT p.slug AS source_slug, l.link_type, l.created_at
    FROM links l
    JOIN pages p ON p.id = l.source_page_id
    JOIN pages tp ON tp.id = l.target_page_id
    WHERE tp.slug = ${slug}
  `;
  return rows;
}

export async function addLink(sourceSlug: string, targetSlug: string, linkType?: string) {
  const db = sql();
  const [src] = await db`SELECT id FROM pages WHERE slug = ${sourceSlug}`;
  const [tgt] = await db`SELECT id FROM pages WHERE slug = ${targetSlug}`;
  if (!src || !tgt) throw new Error('One or both pages not found');
  await db`
    INSERT INTO links (source_page_id, target_page_id, target_slug, link_type)
    VALUES (${src.id}, ${tgt.id}, ${targetSlug}, ${linkType ?? 'mentions'})
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
        WHERE type = 'todo'
          AND (frontmatter->>'done')::boolean = ${opts.done}
        ORDER BY
          CASE frontmatter->>'priority' WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
          (frontmatter->>'due_date') ASC NULLS LAST,
          created_at ASC
      `
    : await db`
        SELECT slug, title, frontmatter, created_at, updated_at FROM pages
        WHERE type = 'todo'
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
    INSERT INTO pages (slug, type, title, compiled_truth, frontmatter, updated_at)
    VALUES (${slug}, 'todo', ${fields.title}, ${fields.title}, ${fm}::jsonb, now())
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      compiled_truth = EXCLUDED.compiled_truth,
      frontmatter = EXCLUDED.frontmatter,
      updated_at = now()
    RETURNING slug, title, frontmatter, updated_at
  `;
  return rows[0];
}

// ── Meetings ───────────────────────────────────────────────────────────────

export async function getMeetings(opts: { days?: number; limit?: number } = {}) {
  const db = sql();
  const limit = Math.min(opts.limit ?? 50, 200);
  if (opts.days) {
    const since = new Date(Date.now() - opts.days * 86400_000).toISOString().slice(0, 10);
    return db`
      SELECT slug, title, frontmatter, updated_at FROM pages
      WHERE type = 'meeting'
        AND (frontmatter->>'date' >= ${since} OR updated_at >= ${since + 'T00:00:00Z'})
      ORDER BY frontmatter->>'date' DESC NULLS LAST, updated_at DESC
      LIMIT ${limit}
    `;
  }
  return db`
    SELECT slug, title, frontmatter, updated_at FROM pages
    WHERE type = 'meeting'
    ORDER BY frontmatter->>'date' DESC NULLS LAST, updated_at DESC
    LIMIT ${limit}
  `;
}

export async function getMeetingAttendees(meetingSlug: string) {
  const db = sql();
  return db`
    SELECT p.slug, p.title, p.frontmatter, l.link_type
    FROM links l
    JOIN pages p ON p.id = l.source_page_id
    JOIN pages m ON m.id = l.target_page_id
    WHERE m.slug = ${meetingSlug}
      AND p.type = 'person'
    ORDER BY p.title
  `;
}

export async function getDailyBriefData() {
  const db = sql();
  const today = new Date().toISOString().slice(0, 10);
  const since24h = new Date(Date.now() - 86400_000).toISOString();

  const [openTodos, recentPages, todayTimeline, todayMeetings] = await Promise.all([
    db`
      SELECT slug, title, frontmatter FROM pages
      WHERE type = 'todo' AND (frontmatter->>'done')::boolean = false
      ORDER BY
        CASE frontmatter->>'priority' WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
        (frontmatter->>'due_date') ASC NULLS LAST
      LIMIT 20
    `,
    db`
      SELECT slug, type, title, updated_at FROM pages
      WHERE type != 'todo' AND updated_at >= ${since24h}
      ORDER BY updated_at DESC LIMIT 10
    `,
    db`
      SELECT t.summary, t.event_date, p.slug, p.title FROM timeline_entries t
      JOIN pages p ON p.id = t.page_id
      WHERE t.event_date = ${today}
      ORDER BY t.created_at DESC LIMIT 20
    `,
    db`
      SELECT slug, title, frontmatter FROM pages
      WHERE type = 'meeting' AND frontmatter->>'date' = ${today}
      ORDER BY frontmatter->>'date' ASC
      LIMIT 10
    `,
  ]);

  return { openTodos, recentPages, todayTimeline, todayMeetings, today };
}

// ── Timeline ───────────────────────────────────────────────────────────────

export async function getTimeline(slug?: string, limit = 50) {
  const db = sql();
  const rows = slug
    ? await db`SELECT t.*, p.slug FROM timeline_entries t JOIN pages p ON p.id = t.page_id WHERE p.slug = ${slug} ORDER BY t.event_date DESC LIMIT ${limit}`
    : await db`SELECT t.*, p.slug FROM timeline_entries t JOIN pages p ON p.id = t.page_id ORDER BY t.event_date DESC LIMIT ${limit}`;
  return rows;
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getStats() {
  const db = sql();
  const [counts] = await db`
    SELECT
      (SELECT count(*) FROM pages)            AS pages,
      (SELECT count(*) FROM content_chunks)    AS chunks,
      (SELECT count(*) FROM links)            AS links,
      (SELECT count(*) FROM tags)             AS tags,
      (SELECT count(*) FROM timeline_entries) AS timeline_entries,
      (SELECT count(*) FROM content_chunks WHERE embedding IS NOT NULL) AS embedded_chunks
  `;
  return counts;
}

// ── Graph data (dashboard-specific) ───────────────────────────────────────

type GraphNode = { id: number; slug: string; type: string; title: string };
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

  const rawLinks = await db`
    SELECT source_page_id, target_page_id, link_type
    FROM links
    WHERE source_page_id = ANY(${pageIds}::int[])
      AND target_page_id = ANY(${pageIds}::int[])
  `;

  return { nodes: pages, links: rawLinks as unknown as GraphLink[] };
}
