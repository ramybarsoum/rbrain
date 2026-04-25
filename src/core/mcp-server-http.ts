import http from 'node:http';
import { createHash } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { BrainEngine } from './engine.ts';
import { operations, OperationError } from './operations.ts';
import { buildToolDefs } from '../mcp/tool-defs.ts';
import { loadConfig } from './config.ts';
import { getConnection } from './db.ts';
import { VERSION } from '../version.ts';

async function validateToken(authorization: string | undefined): Promise<string | null> {
  const raw = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!raw) return null;
  const hash = createHash('sha256').update(raw).digest('hex');
  const sql = getConnection();
  const rows = await sql`
    SELECT name FROM access_tokens WHERE token_hash = ${hash} AND revoked_at IS NULL LIMIT 1
  `;
  if (!rows.length) return null;
  sql`UPDATE access_tokens SET last_used_at = now() WHERE token_hash = ${hash}`.catch(() => {});
  return rows[0].name as string;
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { return undefined; }
}

async function handleMcp(
  engine: BrainEngine,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  tokenName: string,
) {
  const server = new Server(
    { name: 'gbrain', version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: buildToolDefs(operations) }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: params } = request.params;
    const op = operations.find(o => o.name === name);
    if (!op) return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };

    const ctx = {
      engine,
      config: loadConfig() || { engine: 'postgres' as const },
      logger: {
        info: (msg: string) => process.stderr.write(`[${tokenName}] ${msg}\n`),
        warn: (msg: string) => process.stderr.write(`[${tokenName}] WARN ${msg}\n`),
        error: (msg: string) => process.stderr.write(`[${tokenName}] ERROR ${msg}\n`),
      },
      dryRun: false,
      remote: true as const,
    };

    try {
      const result = await op.handler(ctx, params || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      if (e instanceof OperationError) {
        return { content: [{ type: 'text', text: JSON.stringify(e.toJSON(), null, 2) }], isError: true };
      }
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const parsedBody = req.method === 'POST' ? await readBody(req) : undefined;
  await transport.handleRequest(req, res, parsedBody);
}

export async function startHttpMcpServer(engine: BrainEngine, port: number, host = '0.0.0.0') {
  const httpServer = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://localhost`).pathname;

    if (req.method === 'GET' && (pathname === '/' || pathname === '/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return void res.end(JSON.stringify({ ok: true, service: 'gbrain-mcp', version: VERSION }));
    }

    if (pathname === '/mcp') {
      let tokenName: string | null;
      try {
        tokenName = await validateToken(req.headers.authorization);
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return void res.end(JSON.stringify({ error: 'Auth check failed' }));
      }
      if (!tokenName) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return void res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      return void handleMcp(engine, req, res, tokenName).catch((e) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  process.stderr.write(`gbrain MCP HTTP server listening on http://${host}:${port}/mcp\n`);

  await new Promise<void>((resolve) => {
    process.on('SIGTERM', resolve);
    process.on('SIGINT', resolve);
  });

  await httpServer.close();
}
