import type { BrainEngine } from '../core/engine.ts';
import { startMcpServer } from '../mcp/server.ts';
import { startHttpTransport } from '../mcp/http-transport.ts';

export async function runServe(engine: BrainEngine, args: string[] = []) {
  if (args.includes('--http')) {
    const portIdx = args.indexOf('--port');
    const portFlag = portIdx >= 0 ? args[portIdx + 1] : undefined;
    const port = portFlag ? parseInt(portFlag, 10) : (parseInt(process.env.PORT ?? '', 10) || 3000);
    const hostIdx = args.indexOf('--host');
    const hostFlag = hostIdx >= 0 ? args[hostIdx + 1] : undefined;
    const host = hostFlag || process.env.HOST || '0.0.0.0';
    const { startHttpMcpServer } = await import('../core/mcp-server-http.ts');
    process.stderr.write(`Starting gbrain MCP HTTP server on ${host}:${port}...\n`);
    await startHttpMcpServer(engine, port, host);
    return;
  }
  process.stderr.write('Starting gbrain MCP server (stdio)...\n');
  await startMcpServer(engine);
}
