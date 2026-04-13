// rbrain-mcp edge function — Hono + Streamable HTTP MCP transport.
// Exposes 28 RBrain operations as MCP tools over HTTP, auth'd by access_tokens.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { authMiddleware, createToken, listTokens, revokeToken, logRequest, type AuthEnv } from './auth.ts';
import { registerTools } from './tools.ts';

// Env-gated admin key: allows bootstrap token creation without an existing token.
// Set via `supabase secrets set RBRAIN_ADMIN_KEY=...` once after first deploy.
const ADMIN_KEY = Deno.env.get('RBRAIN_ADMIN_KEY');

// Supabase strips /functions/v1 from the URL but keeps /rbrain-mcp as the prefix,
// so Hono needs basePath('/rbrain-mcp') for routes like /health, /mcp, /admin/* to match.
const app = new Hono<AuthEnv>().basePath('/rbrain-mcp');

// Health (unauthenticated)
app.get('/health', (c) => c.json({
  ok: true,
  service: 'rbrain-mcp',
  schema: 'public',
  archive: 'v0_archive',
}));

// ─── Admin: create/list/revoke tokens ───
// Guarded by a separate ADMIN_KEY header so you can bootstrap before any
// access_token exists. Remove / rotate the admin key after initial setup.
function requireAdmin(c: { req: { header: (k: string) => string | undefined }; json: (b: unknown, s?: number) => Response }) {
  if (!ADMIN_KEY) return c.json({ error: 'RBRAIN_ADMIN_KEY not configured' }, 500);
  const key = c.req.header('X-Admin-Key');
  if (key !== ADMIN_KEY) return c.json({ error: 'Admin key required' }, 401);
  return null;
}

app.post('/admin/create_token', async (c) => {
  const err = requireAdmin(c);
  if (err) return err;
  const { name, scopes } = await c.req.json().catch(() => ({ name: '', scopes: [] }));
  if (!name) return c.json({ error: 'name required' }, 400);
  const result = await createToken(name, scopes || []);
  return c.json(result);
});

app.get('/admin/list_tokens', async (c) => {
  const err = requireAdmin(c);
  if (err) return err;
  return c.json({ tokens: await listTokens() });
});

app.post('/admin/revoke_token', async (c) => {
  const err = requireAdmin(c);
  if (err) return err;
  const { name } = await c.req.json().catch(() => ({ name: '' }));
  if (!name) return c.json({ error: 'name required' }, 400);
  return c.json(await revokeToken(name));
});

// ─── MCP endpoint (bearer auth'd) ───
app.use('/mcp', authMiddleware);
app.all('/mcp', async (c) => {
  const server = new McpServer({ name: 'rbrain', version: '1.0.0' });
  registerTools(server);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);

  const started = Date.now();
  const tokenName = c.get('tokenName') || 'unknown';
  try {
    const resp = await transport.handleRequest(c);
    logRequest(tokenName, 'mcp', Date.now() - started, 'success');
    return resp;
  } catch (e) {
    logRequest(tokenName, 'mcp', Date.now() - started, 'error');
    throw e;
  }
});

// Health via root for convenience
app.get('/', (c) => c.json({ ok: true, service: 'rbrain-mcp', endpoint: '/mcp' }));

Deno.serve(app.fetch);
