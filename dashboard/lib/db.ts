import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _sql = postgres(url, {
    // Vercel serverless can keep several warm function instances alive.
    // One session per instance avoids exhausting small Supabase session pools.
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false, // Supabase pgBouncer compatibility
  });
  return _sql;
}
