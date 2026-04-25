import { createHash } from 'node:crypto';
import { getDb } from './db';

export async function validateToken(req: Request): Promise<string | null> {
  const authorization = req.headers.get('authorization');
  const headerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const queryToken = new URL(req.url).searchParams.get('key');
  const raw = headerToken ?? queryToken;
  if (!raw) return null;
  const hash = createHash('sha256').update(raw).digest('hex');
  const sql = getDb();
  const rows = await sql`
    SELECT name FROM access_tokens
    WHERE token_hash = ${hash} AND revoked_at IS NULL
    LIMIT 1
  `;
  if (!rows.length) return null;
  sql`UPDATE access_tokens SET last_used_at = now() WHERE token_hash = ${hash}`.catch(() => {});
  return rows[0].name as string;
}
