// Deno port of src/core/postgres-engine.ts. Keeps the exact SQL template literals.
import { getSql } from './db.ts';
import { validateSlug, contentHash, rowToPage, rowToChunk, rowToSearchResult } from './utils.ts';
import { chunkText } from './chunker.ts';
import { embed, vectorLiteral } from './embedding.ts';

const MAX_SEARCH_LIMIT = 50;
const clamp = (n: number | undefined) => Math.min(Math.max(n || 20, 1), MAX_SEARCH_LIMIT);

// ─────────────────────────────────────────── Pages

export async function getPage(slug: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, slug, type, title, compiled_truth, timeline, frontmatter,
           content_hash, created_at, updated_at
    FROM pages WHERE slug = ${slug}
  `;
  return rows.length ? rowToPage(rows[0]) : null;
}

export async function putPage(slug: string, p: {
  type: string; title: string; compiled_truth: string;
  timeline?: string; frontmatter?: Record<string, unknown>;
}) {
  slug = validateSlug(slug);
  const sql = getSql();
  const hash = await contentHash(p);
  const rows = await sql`
    INSERT INTO pages (slug, type, title, compiled_truth, timeline, frontmatter, content_hash, updated_at)
    VALUES (${slug}, ${p.type}, ${p.title}, ${p.compiled_truth}, ${p.timeline || ''},
            ${JSON.stringify(p.frontmatter || {})}::jsonb, ${hash}, now())
    ON CONFLICT (slug) DO UPDATE SET
      type = EXCLUDED.type, title = EXCLUDED.title,
      compiled_truth = EXCLUDED.compiled_truth, timeline = EXCLUDED.timeline,
      frontmatter = EXCLUDED.frontmatter, content_hash = EXCLUDED.content_hash,
      updated_at = now()
    RETURNING id, slug, type, title, compiled_truth, timeline, frontmatter,
              content_hash, created_at, updated_at
  `;
  return rowToPage(rows[0]);
}

export async function deletePage(slug: string) {
  const sql = getSql();
  await sql`DELETE FROM pages WHERE slug = ${slug}`;
}

export async function listPages(opts: { type?: string; tag?: string; limit?: number }) {
  const sql = getSql();
  const limit = opts.limit || 50;
  let rows;
  if (opts.type && opts.tag) {
    rows = await sql`
      SELECT p.* FROM pages p
      JOIN tags t ON t.page_id = p.id
      WHERE p.type = ${opts.type} AND t.tag = ${opts.tag}
      ORDER BY p.updated_at DESC LIMIT ${limit}
    `;
  } else if (opts.type) {
    rows = await sql`SELECT * FROM pages WHERE type = ${opts.type} ORDER BY updated_at DESC LIMIT ${limit}`;
  } else if (opts.tag) {
    rows = await sql`
      SELECT p.* FROM pages p
      JOIN tags t ON t.page_id = p.id
      WHERE t.tag = ${opts.tag}
      ORDER BY p.updated_at DESC LIMIT ${limit}
    `;
  } else {
    rows = await sql`SELECT * FROM pages ORDER BY updated_at DESC LIMIT ${limit}`;
  }
  return rows.map(rowToPage).map(p => ({
    slug: p.slug, type: p.type, title: p.title, updated_at: p.updated_at,
  }));
}

export async function resolveSlugs(partial: string) {
  const sql = getSql();
  const exact = await sql`SELECT slug FROM pages WHERE slug = ${partial}`;
  if (exact.length > 0) return [exact[0].slug];
  const fuzzy = await sql`
    SELECT slug, similarity(title, ${partial}) AS sim
    FROM pages
    WHERE title % ${partial} OR slug ILIKE ${'%' + partial + '%'}
    ORDER BY sim DESC
    LIMIT 5
  `;
  return fuzzy.map((r: { slug: string }) => r.slug);
}

// ─────────────────────────────────────────── Search

export async function searchKeyword(query: string, opts: { limit?: number; offset?: number; type?: string } = {}) {
  const sql = getSql();
  const limit = clamp(opts.limit);
  const offset = opts.offset || 0;
  const type = opts.type;
  const rows = await sql`
    WITH ranked_pages AS (
      SELECT p.id, p.slug, p.title, p.type,
        ts_rank(p.search_vector, websearch_to_tsquery('english', ${query})) AS score
      FROM pages p
      WHERE p.search_vector @@ websearch_to_tsquery('english', ${query})
        ${type ? sql`AND p.type = ${type}` : sql``}
      ORDER BY score DESC
      LIMIT ${limit} OFFSET ${offset}
    ),
    best_chunks AS (
      SELECT DISTINCT ON (rp.slug)
        rp.slug, rp.id as page_id, rp.title, rp.type, rp.score,
        cc.chunk_text, cc.chunk_source
      FROM ranked_pages rp
      JOIN content_chunks cc ON cc.page_id = rp.id
      ORDER BY rp.slug, cc.chunk_index
    )
    SELECT slug, page_id, title, type, chunk_text, chunk_source, score,
      false AS stale
    FROM best_chunks
    ORDER BY score DESC
  `;
  return rows.map(rowToSearchResult);
}

export async function searchVector(embedding: number[], opts: { limit?: number; type?: string } = {}) {
  const sql = getSql();
  const limit = clamp(opts.limit);
  const vecStr = vectorLiteral(embedding);
  const rows = await sql`
    SELECT p.slug, p.id as page_id, p.title, p.type,
      cc.chunk_text, cc.chunk_source,
      1 - (cc.embedding <=> ${vecStr}::vector) AS score,
      false AS stale
    FROM content_chunks cc
    JOIN pages p ON p.id = cc.page_id
    WHERE cc.embedding IS NOT NULL
      ${opts.type ? sql`AND p.type = ${opts.type}` : sql``}
    ORDER BY cc.embedding <=> ${vecStr}::vector
    LIMIT ${limit}
  `;
  return rows.map(rowToSearchResult);
}

// Hybrid = keyword + vector, fused via RRF.
export async function hybridQuery(q: string, opts: { limit?: number; offset?: number } = {}) {
  const limit = clamp(opts.limit);
  const [kw, vec] = await Promise.all([
    searchKeyword(q, { limit }),
    embed(q).then(e => searchVector(e, { limit })).catch(() => [] as Awaited<ReturnType<typeof searchVector>>),
  ]);
  // Reciprocal Rank Fusion — k=60 is the canonical constant.
  const scores = new Map<string, { r: ReturnType<typeof rowToSearchResult>; score: number }>();
  const k = 60;
  kw.forEach((r, i) => scores.set(r.slug, { r, score: 1 / (k + i + 1) }));
  vec.forEach((r, i) => {
    const existing = scores.get(r.slug);
    if (existing) existing.score += 1 / (k + i + 1);
    else scores.set(r.slug, { r, score: 1 / (k + i + 1) });
  });
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(opts.offset || 0, (opts.offset || 0) + limit)
    .map(x => ({ ...x.r, score: x.score }));
}

// ─────────────────────────────────────────── Chunks

export async function upsertChunks(slug: string, chunks: { text: string; index: number; source?: string }[]) {
  const sql = getSql();
  const pageRows = await sql`SELECT id FROM pages WHERE slug = ${slug}`;
  if (pageRows.length === 0) throw new Error(`Page not found: ${slug}`);
  const pageId = pageRows[0].id;
  const indices = chunks.map(c => c.index);
  if (indices.length === 0) {
    await sql`DELETE FROM content_chunks WHERE page_id = ${pageId}`;
    return;
  }
  await sql`DELETE FROM content_chunks WHERE page_id = ${pageId} AND chunk_index != ALL(${indices})`;
  for (const c of chunks) {
    await sql`
      INSERT INTO content_chunks (page_id, chunk_index, chunk_text, chunk_source, model)
      VALUES (${pageId}, ${c.index}, ${c.text}, ${c.source || 'compiled_truth'}, 'text-embedding-3-large')
      ON CONFLICT (page_id, chunk_index) DO UPDATE SET
        chunk_text = EXCLUDED.chunk_text,
        chunk_source = EXCLUDED.chunk_source
    `;
  }
}

export async function getChunks(slug: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT cc.* FROM content_chunks cc
    JOIN pages p ON p.id = cc.page_id
    WHERE p.slug = ${slug}
    ORDER BY cc.chunk_index
  `;
  return rows.map(rowToChunk);
}

// Put page + auto-chunk its compiled_truth. No embeddings here — CLI handles that.
export async function putPageAndChunk(slug: string, p: {
  type: string; title: string; compiled_truth: string;
  timeline?: string; frontmatter?: Record<string, unknown>;
}) {
  const page = await putPage(slug, p);
  const chunks = chunkText(p.compiled_truth).map(c => ({
    text: c.text, index: c.index, source: 'compiled_truth',
  }));
  if (chunks.length > 0) await upsertChunks(slug, chunks);
  return { slug: page.slug, status: 'created_or_updated', chunks: chunks.length };
}

// ─────────────────────────────────────────── Tags

export async function addTag(slug: string, tag: string) {
  const sql = getSql();
  const page = await sql`SELECT id FROM pages WHERE slug = ${slug}`;
  if (page.length === 0) throw new Error(`addTag failed: page "${slug}" not found`);
  await sql`
    INSERT INTO tags (page_id, tag) VALUES (${page[0].id}, ${tag})
    ON CONFLICT (page_id, tag) DO NOTHING
  `;
}

export async function removeTag(slug: string, tag: string) {
  const sql = getSql();
  await sql`
    DELETE FROM tags
    WHERE page_id = (SELECT id FROM pages WHERE slug = ${slug}) AND tag = ${tag}
  `;
}

export async function getTags(slug: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT tag FROM tags
    WHERE page_id = (SELECT id FROM pages WHERE slug = ${slug})
    ORDER BY tag
  `;
  return rows.map((r: { tag: string }) => r.tag);
}

// ─────────────────────────────────────────── Links

export async function addLink(from: string, to: string, context = '', linkType = '') {
  const sql = getSql();
  const r = await sql`
    INSERT INTO links (from_page_id, to_page_id, link_type, context)
    SELECT f.id, t.id, ${linkType}, ${context}
    FROM pages f, pages t
    WHERE f.slug = ${from} AND t.slug = ${to}
    ON CONFLICT (from_page_id, to_page_id) DO UPDATE SET
      link_type = EXCLUDED.link_type, context = EXCLUDED.context
    RETURNING id
  `;
  if (r.length === 0) throw new Error(`addLink failed: page "${from}" or "${to}" not found`);
}

export async function removeLink(from: string, to: string) {
  const sql = getSql();
  await sql`
    DELETE FROM links
    WHERE from_page_id = (SELECT id FROM pages WHERE slug = ${from})
      AND to_page_id = (SELECT id FROM pages WHERE slug = ${to})
  `;
}

export async function getLinks(slug: string) {
  const sql = getSql();
  return sql`
    SELECT f.slug as from_slug, t.slug as to_slug, l.link_type, l.context
    FROM links l
    JOIN pages f ON f.id = l.from_page_id
    JOIN pages t ON t.id = l.to_page_id
    WHERE f.slug = ${slug}
  `;
}

export async function getBacklinks(slug: string) {
  const sql = getSql();
  return sql`
    SELECT f.slug as from_slug, t.slug as to_slug, l.link_type, l.context
    FROM links l
    JOIN pages f ON f.id = l.from_page_id
    JOIN pages t ON t.id = l.to_page_id
    WHERE t.slug = ${slug}
  `;
}

export async function traverseGraph(slug: string, depth = 5) {
  const sql = getSql();
  const rows = await sql`
    WITH RECURSIVE graph AS (
      SELECT p.id, p.slug, p.title, p.type, 0 as depth
      FROM pages p WHERE p.slug = ${slug}
      UNION
      SELECT p2.id, p2.slug, p2.title, p2.type, g.depth + 1
      FROM graph g
      JOIN links l ON l.from_page_id = g.id
      JOIN pages p2 ON p2.id = l.to_page_id
      WHERE g.depth < ${depth}
    )
    SELECT DISTINCT g.slug, g.title, g.type, g.depth,
      coalesce(
        (SELECT jsonb_agg(jsonb_build_object('to_slug', p3.slug, 'link_type', l2.link_type))
         FROM links l2
         JOIN pages p3 ON p3.id = l2.to_page_id
         WHERE l2.from_page_id = g.id),
        '[]'::jsonb
      ) as links
    FROM graph g
    ORDER BY g.depth, g.slug
  `;
  return rows.map((r: Record<string, unknown>) => ({
    slug: r.slug, title: r.title, type: r.type, depth: r.depth,
    links: typeof r.links === 'string' ? JSON.parse(r.links) : r.links,
  }));
}

// ─────────────────────────────────────────── Timeline

export async function addTimelineEntry(slug: string, entry: {
  date: string; summary: string; detail?: string; source?: string;
}) {
  const sql = getSql();
  const r = await sql`
    INSERT INTO timeline_entries (page_id, date, source, summary, detail)
    SELECT id, ${entry.date}::date, ${entry.source || ''}, ${entry.summary}, ${entry.detail || ''}
    FROM pages WHERE slug = ${slug}
    RETURNING id
  `;
  if (r.length === 0) throw new Error(`addTimelineEntry failed: page "${slug}" not found`);
}

export async function getTimeline(slug: string) {
  const sql = getSql();
  return sql`
    SELECT te.* FROM timeline_entries te
    JOIN pages p ON p.id = te.page_id
    WHERE p.slug = ${slug}
    ORDER BY te.date DESC LIMIT 100
  `;
}

// ─────────────────────────────────────────── Raw data

export async function putRawData(slug: string, source: string, data: object) {
  const sql = getSql();
  const r = await sql`
    INSERT INTO raw_data (page_id, source, data)
    SELECT id, ${source}, ${JSON.stringify(data)}::jsonb
    FROM pages WHERE slug = ${slug}
    ON CONFLICT (page_id, source) DO UPDATE SET
      data = EXCLUDED.data, fetched_at = now()
    RETURNING id
  `;
  if (r.length === 0) throw new Error(`putRawData failed: page "${slug}" not found`);
}

export async function getRawData(slug: string, source?: string) {
  const sql = getSql();
  if (source) {
    return sql`
      SELECT rd.source, rd.data, rd.fetched_at FROM raw_data rd
      JOIN pages p ON p.id = rd.page_id
      WHERE p.slug = ${slug} AND rd.source = ${source}
    `;
  }
  return sql`
    SELECT rd.source, rd.data, rd.fetched_at FROM raw_data rd
    JOIN pages p ON p.id = rd.page_id
    WHERE p.slug = ${slug}
  `;
}

// ─────────────────────────────────────────── Versions

export async function getVersions(slug: string) {
  const sql = getSql();
  return sql`
    SELECT pv.* FROM page_versions pv
    JOIN pages p ON p.id = pv.page_id
    WHERE p.slug = ${slug}
    ORDER BY pv.snapshot_at DESC
  `;
}

export async function createVersion(slug: string) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO page_versions (page_id, compiled_truth, frontmatter)
    SELECT id, compiled_truth, frontmatter
    FROM pages WHERE slug = ${slug}
    RETURNING *
  `;
  if (rows.length === 0) throw new Error(`createVersion failed: page "${slug}" not found`);
  return rows[0];
}

export async function revertToVersion(slug: string, versionId: number) {
  await createVersion(slug);
  const sql = getSql();
  await sql`
    UPDATE pages SET
      compiled_truth = pv.compiled_truth,
      frontmatter = pv.frontmatter,
      updated_at = now()
    FROM page_versions pv
    WHERE pages.slug = ${slug} AND pv.id = ${versionId} AND pv.page_id = pages.id
  `;
}

// ─────────────────────────────────────────── Admin / stats

export async function getStats() {
  const sql = getSql();
  const [s] = await sql`
    SELECT
      (SELECT count(*) FROM pages) as page_count,
      (SELECT count(*) FROM content_chunks) as chunk_count,
      (SELECT count(*) FROM content_chunks WHERE embedded_at IS NOT NULL) as embedded_count,
      (SELECT count(*) FROM links) as link_count,
      (SELECT count(DISTINCT tag) FROM tags) as tag_count,
      (SELECT count(*) FROM timeline_entries) as timeline_entry_count
  `;
  const types = await sql`SELECT type, count(*)::int as count FROM pages GROUP BY type ORDER BY count DESC`;
  const pages_by_type: Record<string, number> = {};
  for (const t of types) pages_by_type[t.type as string] = t.count as number;
  return {
    page_count: Number(s.page_count),
    chunk_count: Number(s.chunk_count),
    embedded_count: Number(s.embedded_count),
    link_count: Number(s.link_count),
    tag_count: Number(s.tag_count),
    timeline_entry_count: Number(s.timeline_entry_count),
    pages_by_type,
  };
}

export async function getHealth() {
  const sql = getSql();
  const [h] = await sql`
    SELECT
      (SELECT count(*) FROM pages) as page_count,
      (SELECT count(*) FROM content_chunks WHERE embedded_at IS NOT NULL)::float /
        GREATEST((SELECT count(*) FROM content_chunks), 1)::float as embed_coverage,
      (SELECT count(*) FROM pages p
       WHERE (p.compiled_truth != '' OR p.timeline != '')
         AND NOT EXISTS (SELECT 1 FROM content_chunks cc WHERE cc.page_id = p.id)
      ) as stale_pages,
      (SELECT count(*) FROM pages p
       WHERE NOT EXISTS (SELECT 1 FROM links l WHERE l.to_page_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM links l WHERE l.from_page_id = p.id)
      ) as orphan_pages,
      (SELECT count(*) FROM content_chunks WHERE embedded_at IS NULL) as missing_embeddings
  `;
  return {
    page_count: Number(h.page_count),
    embed_coverage: Number(h.embed_coverage),
    stale_pages: Number(h.stale_pages),
    orphan_pages: Number(h.orphan_pages),
    missing_embeddings: Number(h.missing_embeddings),
  };
}

// ─────────────────────────────────────────── Ingest log

export async function logIngest(entry: {
  source_type: string; source_ref: string;
  pages_updated: string[]; summary: string;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO ingest_log (source_type, source_ref, pages_updated, summary)
    VALUES (${entry.source_type}, ${entry.source_ref},
            ${JSON.stringify(entry.pages_updated)}::jsonb, ${entry.summary})
  `;
}

export async function getIngestLog(limit = 20) {
  const sql = getSql();
  return sql`SELECT * FROM ingest_log ORDER BY created_at DESC LIMIT ${limit}`;
}

// ─────────────────────────────────────────── Files (list + url only; upload needs local FS)

export async function fileList(slug?: string) {
  const sql = getSql();
  if (slug) {
    return sql`
      SELECT id, page_slug, filename, storage_path, mime_type, size_bytes, content_hash, created_at
      FROM files WHERE page_slug = ${slug} ORDER BY filename
    `;
  }
  return sql`
    SELECT id, page_slug, filename, storage_path, mime_type, size_bytes, content_hash, created_at
    FROM files ORDER BY page_slug, filename LIMIT 100
  `;
}

export async function fileUrl(storagePath: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT storage_path, mime_type, size_bytes FROM files WHERE storage_path = ${storagePath}
  `;
  if (rows.length === 0) throw new Error(`File not found: ${storagePath}`);
  return { storage_path: rows[0].storage_path, url: `rbrain:files/${rows[0].storage_path}` };
}
