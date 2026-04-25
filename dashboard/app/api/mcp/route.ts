import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { validateToken } from '@/lib/auth';
import * as ops from '@/lib/operations';

function buildServer() {
  const server = new McpServer({ name: 'rbrain', version: '1.0.0' });

  // ── Pages ──────────────────────────────────────────────────────────────

  server.tool('get_page', 'Read a page by slug',
    { slug: z.string(), fuzzy: z.boolean().optional() },
    async ({ slug, fuzzy }) => {
      let page = await ops.getPage(slug);
      if (!page && fuzzy) {
        const candidates = await ops.resolveSlugs(slug);
        if (candidates.length === 1) page = await ops.getPage(candidates[0]);
        else if (candidates.length > 1) return text({ error: 'ambiguous_slug', candidates });
      }
      if (!page) return text({ error: 'not_found', slug });
      return text(page);
    });

  server.tool('list_pages', 'List pages with optional filters',
    { type: z.string().optional(), tag: z.string().optional(), limit: z.number().optional(), days: z.number().optional() },
    async (opts) => text(await ops.listPages(opts)));

  server.tool('put_page', 'Write or update a page',
    { slug: z.string(), type: z.string(), title: z.string(), compiled_truth: z.string(), timeline: z.string().optional(), frontmatter: z.record(z.string(), z.unknown()).optional() },
    async (p) => text(await ops.putPage(p.slug, p)));

  server.tool('delete_page', 'Delete a page',
    { slug: z.string() },
    async ({ slug }) => text(await ops.deletePage(slug)));

  server.tool('resolve_slugs', 'Fuzzy-match a partial slug',
    { partial: z.string() },
    async ({ partial }) => text(await ops.resolveSlugs(partial)));

  // ── Search ─────────────────────────────────────────────────────────────

  server.tool('query', 'Full-text search across brain chunks',
    { query: z.string(), limit: z.number().optional(), type: z.string().optional() },
    async ({ query, limit, type }) => text(await ops.search(query, { limit, type })));

  server.tool('search', 'Alias for query',
    { query: z.string(), limit: z.number().optional(), type: z.string().optional() },
    async ({ query, limit, type }) => text(await ops.search(query, { limit, type })));

  // ── Tags ───────────────────────────────────────────────────────────────

  server.tool('get_tags', 'List tags on a page',
    { slug: z.string() },
    async ({ slug }) => text(await ops.getTags(slug)));

  server.tool('add_tag', 'Add a tag to a page',
    { slug: z.string(), tag: z.string() },
    async ({ slug, tag }) => text(await ops.addTag(slug, tag)));

  server.tool('remove_tag', 'Remove a tag from a page',
    { slug: z.string(), tag: z.string() },
    async ({ slug, tag }) => text(await ops.removeTag(slug, tag)));

  // ── Links ──────────────────────────────────────────────────────────────

  server.tool('get_links', 'Get outgoing links from a page',
    { slug: z.string() },
    async ({ slug }) => text(await ops.getLinks(slug)));

  server.tool('get_backlinks', 'Get incoming links to a page',
    { slug: z.string() },
    async ({ slug }) => text(await ops.getBacklinks(slug)));

  server.tool('add_link', 'Create a typed link between pages',
    { source: z.string(), target: z.string(), link_type: z.string().optional() },
    async ({ source, target, link_type }) => text(await ops.addLink(source, target, link_type)));

  // ── Timeline ───────────────────────────────────────────────────────────

  server.tool('get_timeline', 'Get timeline entries for a page or global',
    { slug: z.string().optional(), limit: z.number().optional() },
    async ({ slug, limit }) => text(await ops.getTimeline(slug, limit)));

  // ── Stats ──────────────────────────────────────────────────────────────

  server.tool('get_stats', 'Brain-wide counts and health',
    {},
    async () => text(await ops.getStats()));

  return server;
}

function text(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export async function GET(req: NextRequest) {
  const tokenName = await validateToken(req);
  if (!tokenName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: NextRequest) {
  const tokenName = await validateToken(req);
  if (!tokenName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  const tokenName = await validateToken(req);
  if (!tokenName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}
