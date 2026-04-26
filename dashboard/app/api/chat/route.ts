import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

async function getBrainContext(query: string): Promise<string> {
  try {
    const db = getDb();
    const rows = await db`
      SELECT DISTINCT ON (p.slug)
        p.slug, p.type, p.title, c.chunk_text,
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
  const hermesUrl = process.env.HERMES_URL;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!hermesUrl && !anthropicKey) {
    return new Response(
      JSON.stringify({ error: 'No AI backend configured. Set HERMES_URL or ANTHROPIC_API_KEY in Vercel.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const { messages, scope } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[];
    scope?: string;
  };

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  // Brain context (used by both Hermes and Anthropic paths as a system hint)
  const context = await getBrainContext(lastUserMsg);

  const systemPrompt = [
    "You are Max, Ramy's personal AI assistant connected to his RBrain knowledge base.",
    scope ? `Current scope: ${scope}.` : '',
    context
      ? `\n\nRelevant brain context:\n\n${context}\n\nUse this to give specific, grounded answers.`
      : '',
    "\n\nBe concise and direct. Ramy is a pharmacist, CPO, and founder — communicate like a sharp colleague.",
  ].filter(Boolean).join('');

  // ── Hermes (OpenAI-compatible gateway) ────────────────────────────────
  if (hermesUrl) {
    const hermesRes = await fetch(`${hermesUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'hermes',          // Hermes picks the model internally
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    }).catch(err => null);

    if (!hermesRes || !hermesRes.ok) {
      const detail = hermesRes ? await hermesRes.text().catch(() => '') : 'Connection failed';
      // Fall through to Anthropic if key exists, otherwise error
      if (!anthropicKey) {
        return new Response(
          JSON.stringify({ error: `Hermes unreachable: ${detail}` }),
          { status: 502, headers: { 'content-type': 'application/json' } },
        );
      }
    } else {
      // Hermes returns OpenAI SSE — transform to our simple {text} format
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader = hermesRes.body!.getReader();
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
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              } catch { /* skip */ }
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
  }

  // ── Anthropic fallback ─────────────────────────────────────────────────
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 502, headers: { 'content-type': 'application/json' } });
  }

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
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
            }
          } catch { /* skip */ }
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
