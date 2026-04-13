// Deno port of src/core/utils.ts. Uses Web Crypto instead of node:crypto.

export function validateSlug(slug: string): string {
  if (!slug || /(^|\/)\.\.($|\/)/.test(slug) || /^\//.test(slug)) {
    throw new Error(`Invalid slug: "${slug}"`);
  }
  return slug.toLowerCase();
}

export async function contentHash(page: {
  title: string;
  type: string;
  compiled_truth: string;
  timeline?: string;
  frontmatter?: Record<string, unknown>;
}): Promise<string> {
  const payload = JSON.stringify({
    title: page.title,
    type: page.type,
    compiled_truth: page.compiled_truth,
    timeline: page.timeline || '',
    frontmatter: page.frontmatter || {},
  });
  const data = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function rowToPage(r: Record<string, unknown>) {
  return {
    id: r.id,
    slug: r.slug,
    type: r.type,
    title: r.title,
    compiled_truth: r.compiled_truth,
    timeline: r.timeline,
    frontmatter: typeof r.frontmatter === 'string' ? JSON.parse(r.frontmatter) : r.frontmatter,
    content_hash: r.content_hash ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function rowToChunk(r: Record<string, unknown>) {
  return {
    id: r.id,
    page_id: r.page_id,
    chunk_index: r.chunk_index,
    chunk_text: r.chunk_text,
    chunk_source: r.chunk_source,
    model: r.model,
    token_count: r.token_count ?? null,
    embedded_at: r.embedded_at ?? null,
  };
}

export function rowToSearchResult(r: Record<string, unknown>) {
  return {
    slug: r.slug,
    page_id: r.page_id,
    title: r.title,
    type: r.type,
    chunk_text: r.chunk_text,
    chunk_source: r.chunk_source,
    score: Number(r.score),
    stale: Boolean(r.stale),
  };
}
