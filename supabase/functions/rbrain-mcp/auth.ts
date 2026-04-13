// Bearer token auth against access_tokens table + token lifecycle helpers.
import type { Context, Next } from 'hono';
import { getSql } from './db.ts';
import { sha256Hex } from './utils.ts';

export type AuthEnv = {
  Variables: {
    tokenName: string;
    tokenScopes: string[];
    authenticated: boolean;
  };
};

export async function authMiddleware(c: Context<AuthEnv>, next: Next) {
  // Accept token via Authorization header OR ?key= query param.
  // The query-param form exists so Claude iOS / other clients that only
  // accept a URL (no custom headers) can still authenticate.
  const authHeader = c.req.header('Authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const queryToken = c.req.query('key') || null;
  const token = headerToken || queryToken;

  // Unauthenticated health check (both "/" and ".../health")
  if (!token) {
    const path = c.req.path;
    const isHealth = c.req.method === 'GET' && (path === '/' || path === '/health' || path.endsWith('/health'));
    if (isHealth) {
      c.set('authenticated', false);
      c.set('tokenName', '');
      c.set('tokenScopes', []);
      return next();
    }
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const hash = await sha256Hex(token);
  const sql = getSql();
  const rows = await sql`
    SELECT name, scopes FROM access_tokens
    WHERE token_hash = ${hash} AND revoked_at IS NULL
    LIMIT 1
  `;
  if (rows.length === 0) return c.json({ error: 'Invalid or revoked token' }, 401);

  c.set('tokenName', rows[0].name as string);
  c.set('tokenScopes', (rows[0].scopes as string[]) || []);
  c.set('authenticated', true);

  // Fire-and-forget: bump last_used_at
  sql`UPDATE access_tokens SET last_used_at = now() WHERE token_hash = ${hash}`
    .catch(() => {});

  return next();
}

export async function createToken(name: string, scopes: string[] = []) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const plaintext = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await sha256Hex(plaintext);
  const sql = getSql();
  try {
    await sql`
      INSERT INTO access_tokens (name, token_hash, scopes)
      VALUES (${name}, ${hash}, ${scopes})
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('duplicate') || msg.includes('23505')) {
      return { error: `Token with name '${name}' already exists.`, name, scopes };
    }
    return { error: msg, name, scopes };
  }
  return { token: plaintext, name, scopes };
}

export async function listTokens() {
  const sql = getSql();
  const rows = await sql`
    SELECT name, scopes, last_used_at, created_at, revoked_at
    FROM access_tokens ORDER BY created_at DESC
  `;
  return rows;
}

export async function revokeToken(name: string) {
  const sql = getSql();
  const r = await sql`
    UPDATE access_tokens SET revoked_at = now()
    WHERE name = ${name} AND revoked_at IS NULL
    RETURNING name
  `;
  if (r.length === 0) return { success: false, message: `No active token named '${name}'` };
  return { success: true, message: `Token '${name}' revoked` };
}

export async function logRequest(tokenName: string, operation: string, latencyMs: number, status: 'success' | 'error') {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO mcp_request_log (token_name, operation, latency_ms, status)
      VALUES (${tokenName}, ${operation}, ${latencyMs}, ${status})
    `;
  } catch {
    // best-effort; never fail the request on logging
  }
}
