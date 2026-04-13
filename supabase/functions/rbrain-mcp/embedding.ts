// OpenAI embedding wrapper. Used for vector search query-side.
// Write-side embeddings (put_page chunks) happen in the CLI, not here.

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const MODEL = 'text-embedding-3-large';
const DIMENSIONS = 1536;

export async function embed(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set — vector search requires it');
  }
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: MODEL,
      dimensions: DIMENSIONS,
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI embed failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

export function vectorLiteral(vec: number[]): string {
  return '[' + vec.join(',') + ']';
}
