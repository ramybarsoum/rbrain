// Deno postgres connection singleton for the rbrain-mcp edge function.
// Uses npm:postgres (porsager/postgres) so SQL template literals match the CLI engine.
import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql(): ReturnType<typeof postgres> {
  if (_sql) return _sql;
  const url = Deno.env.get('RBRAIN_DATABASE_URL') ||
              Deno.env.get('GBRAIN_DATABASE_URL') ||
              Deno.env.get('DATABASE_URL') ||
              Deno.env.get('SUPABASE_DB_URL');
  if (!url) {
    throw new Error('No database URL env var set (RBRAIN_DATABASE_URL / SUPABASE_DB_URL)');
  }
  _sql = postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return _sql;
}
