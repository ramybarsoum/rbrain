import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

// Pull relevant brain context for a query using full-text search
async function getBrainContext(query: string): Promise<string> {
  try {
    const db = getDb();
    const rows = await db`
      SELECT DISTINCT ON (p.slug)
        p.slug, p.type, p.title,
        c.chunk_text,
        ts_rank(to_tsvector('english', c.chunk_text), plainto_tsquery('english', ${query})) AS score
      FROM content_chunks c
      JOIN pages p ON p.id = c.page_id
      WHERE to_tsvector('english', c.chunk_text) @@ plainto_tsquery('english', ${query})
        AND p.type != 'todo'
      ORDER BY p.slug, score DESC
      LIMIT 6
    `;
    if (!rows.length) return '';
    return rows.map((r: any) =>
      `[${r.type}] ${r.title || r.slug}\n${String(r.chunk_text).slice(0, 400)}`
    ).join('\n\n---\n\n');
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hermesUrl = process.env.HERMES_URL;

  if (!apiKey && !hermesUrl) {
    return new Response(
      JSON.stringify({ error: 'No AI backend configured. Add ANTHROPIC_API_KEY or HERMES_URL to Vercel env vars.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  // Route to Hermes if configured
  if (hermesUrl) {
    const res = await fetch(`${hermesUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    return new Response(res.body, {
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
    });
  }

  // Brain context search
  const context = await getBrainContext(lastUserMsg);

  const system = [
    "You are Max, Ramy's personal AI assistant. You have access to Ramy's personal knowledge brain — a database of his thoughts, decisions, meetings, people, companies, and learnings.",
    context
      ? `\n\nRelevant brain context for this query:\n\n${context}\n\nUse this context to give specific, grounded answers. Reference page titles or slugs when relevant.`
      : '\n\nNo matching brain content found for this specific query. Answer from general knowledge if helpful.',
    '\n\nBe concise and direct. Ramy is a pharmacist, CPO, and founder — communicate like a sharp colleague, not a chatbot.',
  ].join('');

  // Call Anthropic API with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 502, headers: { 'content-type': 'application/json' } });
  }

  // Transform Anthropic SSE → simple text/event-stream with just the text deltas
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = anthropicRes.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const text = parsed.delta.text;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } finally {
      await writer.write(encoder.encode('data: [DONE]\n\n'));
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' },
  });
}
