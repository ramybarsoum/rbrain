// Register all 28 RBrain operations as MCP tools on an McpServer instance.
// Mirrors the contract in /Users/cole/RBrain/src/core/operations.ts.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as engine from './engine.ts';

const textResult = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const errorResult = (err: unknown) => ({
  content: [{
    type: 'text' as const,
    text: JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    }),
  }],
  isError: true,
});

export function registerTools(server: McpServer) {
  // ───── Page CRUD ─────

  server.tool('get_page',
    'Read a page by slug (supports optional fuzzy matching)',
    { slug: z.string(), fuzzy: z.boolean().optional() },
    async ({ slug, fuzzy }) => {
      try {
        let page = await engine.getPage(slug);
        let resolved_slug: string | undefined;
        if (!page && fuzzy) {
          const cands = await engine.resolveSlugs(slug);
          if (cands.length === 1) { page = await engine.getPage(cands[0]); resolved_slug = cands[0]; }
          else if (cands.length > 1) return textResult({ error: 'ambiguous_slug', candidates: cands });
        }
        if (!page) return errorResult(`Page not found: ${slug}`);
        const tags = await engine.getTags(page.slug as string);
        return textResult({ ...page, tags, ...(resolved_slug ? { resolved_slug } : {}) });
      } catch (e) { return errorResult(e); }
    });

  server.tool('put_page',
    'Write/update a page. Rechunks compiled_truth. Embeddings are filled in later by the CLI.',
    {
      slug: z.string(),
      type: z.string(),
      title: z.string(),
      compiled_truth: z.string(),
      timeline: z.string().optional(),
      frontmatter: z.record(z.unknown()).optional(),
    },
    async (p) => {
      try { return textResult(await engine.putPageAndChunk(p.slug, p)); }
      catch (e) { return errorResult(e); }
    });

  server.tool('delete_page', 'Delete a page',
    { slug: z.string() },
    async ({ slug }) => {
      try { await engine.deletePage(slug); return textResult({ status: 'deleted' }); }
      catch (e) { return errorResult(e); }
    });

  server.tool('list_pages', 'List pages with optional filters',
    { type: z.string().optional(), tag: z.string().optional(), limit: z.number().optional() },
    async (p) => {
      try { return textResult(await engine.listPages(p)); } catch (e) { return errorResult(e); }
    });

  // ───── Search ─────

  server.tool('search', 'Keyword search via full-text',
    { query: z.string(), limit: z.number().optional(), offset: z.number().optional() },
    async (p) => {
      try { return textResult(await engine.searchKeyword(p.query, p)); } catch (e) { return errorResult(e); }
    });

  server.tool('query', 'Hybrid search: keyword + vector, fused via RRF',
    { query: z.string(), limit: z.number().optional(), offset: z.number().optional() },
    async (p) => {
      try { return textResult(await engine.hybridQuery(p.query, p)); } catch (e) { return errorResult(e); }
    });

  // ───── Tags ─────

  server.tool('add_tag', 'Add tag to page',
    { slug: z.string(), tag: z.string() },
    async (p) => { try { await engine.addTag(p.slug, p.tag); return textResult({ status: 'ok' }); } catch (e) { return errorResult(e); } });

  server.tool('remove_tag', 'Remove tag from page',
    { slug: z.string(), tag: z.string() },
    async (p) => { try { await engine.removeTag(p.slug, p.tag); return textResult({ status: 'ok' }); } catch (e) { return errorResult(e); } });

  server.tool('get_tags', 'List tags for a page',
    { slug: z.string() },
    async (p) => { try { return textResult(await engine.getTags(p.slug)); } catch (e) { return errorResult(e); } });

  // ───── Links ─────

  server.tool('add_link', 'Create link between pages',
    { from: z.string(), to: z.string(), link_type: z.string().optional(), context: z.string().optional() },
    async (p) => {
      try { await engine.addLink(p.from, p.to, p.context, p.link_type); return textResult({ status: 'ok' }); }
      catch (e) { return errorResult(e); }
    });

  server.tool('remove_link', 'Remove link between pages',
    { from: z.string(), to: z.string() },
    async (p) => { try { await engine.removeLink(p.from, p.to); return textResult({ status: 'ok' }); } catch (e) { return errorResult(e); } });

  server.tool('get_links', 'List outgoing links from a page',
    { slug: z.string() },
    async (p) => { try { return textResult(await engine.getLinks(p.slug)); } catch (e) { return errorResult(e); } });

  server.tool('get_backlinks', 'List incoming links to a page',
    { slug: z.string() },
    async (p) => { try { return textResult(await engine.getBacklinks(p.slug)); } catch (e) { return errorResult(e); } });

  server.tool('traverse_graph', 'Traverse link graph from a page',
    { slug: z.string(), depth: z.number().optional() },
    async (p) => { try { return textResult(await engine.traverseGraph(p.slug, p.depth)); } catch (e) { return errorResult(e); } });

  // ───── Timeline ─────

  server.tool('add_timeline_entry', 'Add timeline entry to a page',
    {
      slug: z.string(), date: z.string(), summary: z.string(),
      detail: z.string().optional(), source: z.string().optional(),
    },
    async (p) => {
      try { await engine.addTimelineEntry(p.slug, p); return textResult({ status: 'ok' }); }
      catch (e) { return errorResult(e); }
    });

  server.tool('get_timeline', 'Get timeline entries for a page',
    { slug: z.string() },
    async (p) => { try { return textResult(await engine.getTimeline(p.slug)); } catch (e) { return errorResult(e); } });

  // ───── Admin ─────

  server.tool('get_stats', 'Brain statistics', {}, async () => {
    try { return textResult(await engine.getStats()); } catch (e) { return errorResult(e); }
  });

  server.tool('get_health', 'Brain health dashboard', {}, async () => {
    try { return textResult(await engine.getHealth()); } catch (e) { return errorResult(e); }
  });

  server.tool('get_versions', 'Page version history',
    { slug: z.string() },
    async (p) => { try { return textResult(await engine.getVersions(p.slug)); } catch (e) { return errorResult(e); } });

  server.tool('revert_version', 'Revert page to a previous version',
    { slug: z.string(), version_id: z.number() },
    async (p) => {
      try { await engine.revertToVersion(p.slug, p.version_id); return textResult({ status: 'reverted' }); }
      catch (e) { return errorResult(e); }
    });

  // ───── Raw data ─────

  server.tool('put_raw_data', 'Store raw API response data for a page',
    { slug: z.string(), source: z.string(), data: z.record(z.unknown()) },
    async (p) => {
      try { await engine.putRawData(p.slug, p.source, p.data); return textResult({ status: 'ok' }); }
      catch (e) { return errorResult(e); }
    });

  server.tool('get_raw_data', 'Retrieve raw data for a page',
    { slug: z.string(), source: z.string().optional() },
    async (p) => { try { return textResult(await engine.getRawData(p.slug, p.source)); } catch (e) { return errorResult(e); } });

  // ───── Resolution & chunks ─────

  server.tool('resolve_slugs', 'Fuzzy-resolve a partial slug',
    { partial: z.string() },
    async (p) => { try { return textResult(await engine.resolveSlugs(p.partial)); } catch (e) { return errorResult(e); } });

  server.tool('get_chunks', 'Get content chunks for a page',
    { slug: z.string() },
    async (p) => { try { return textResult(await engine.getChunks(p.slug)); } catch (e) { return errorResult(e); } });

  // ───── Ingest log ─────

  server.tool('log_ingest', 'Log an ingestion event',
    {
      source_type: z.string(), source_ref: z.string(),
      pages_updated: z.array(z.string()), summary: z.string(),
    },
    async (p) => {
      try { await engine.logIngest(p); return textResult({ status: 'ok' }); }
      catch (e) { return errorResult(e); }
    });

  server.tool('get_ingest_log', 'Recent ingestion log entries',
    { limit: z.number().optional() },
    async (p) => { try { return textResult(await engine.getIngestLog(p.limit)); } catch (e) { return errorResult(e); } });

  // ───── Files (metadata only; upload path requires local FS, stays on CLI) ─────

  server.tool('file_list', 'List stored file metadata',
    { slug: z.string().optional() },
    async (p) => { try { return textResult(await engine.fileList(p.slug)); } catch (e) { return errorResult(e); } });

  server.tool('file_url', 'Get URL for a stored file',
    { storage_path: z.string() },
    async (p) => { try { return textResult(await engine.fileUrl(p.storage_path)); } catch (e) { return errorResult(e); } });
}
