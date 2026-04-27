import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export type CodexToolStat = {
  name: string;
  count: number;
  p50: number;
  p95: number;
  max: number;
  errors: number;
};

export type CodexSessionSummary = {
  id: string;
  title: string;
  cwd: string;
  model: string;
  originator: string;
  startedAt: string;
  updatedAt: string;
  eventCount: number;
  toolCount: number;
  approxTokens: number;
  errors: number;
  rateLimitPeak: number;
};

export type CodexTelemetryDashboard = {
  sessionsPath: string;
  generatedAt: string;
  totalSessions: number;
  scannedSessions: number;
  liveSessions: CodexSessionSummary[];
  recentSessions: CodexSessionSummary[];
  totals: {
    sessionsToday: number;
    sessions7d: number;
    approxTokensToday: number;
    approxTokens7d: number;
    toolCalls7d: number;
    errors7d: number;
    cacheSignals: number;
    rateLimitPeak: number;
  };
  daily: Array<{
    date: string;
    sessions: number;
    approxTokens: number;
    toolCalls: number;
    errors: number;
  }>;
  toolLatency: CodexToolStat[];
  mcp: CodexToolStat[];
  outcomes: Array<{ label: string; count: number; tone: 'success' | 'warning' | 'danger' | 'info' }>;
};

type JsonObject = Record<string, unknown>;

type SessionFile = {
  file: string;
  mtimeMs: number;
};

const CODEX_SESSIONS_DIR = path.join(os.homedir(), '.codex', 'sessions');
const MAX_FILES_TO_SCAN = 320;
const TOKEN_CHARS_PER_TOKEN = 4;

function asObj(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]);
}

function dayKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function titleFromText(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 84);
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join(' ');
  const obj = asObj(value);
  if (!obj) return '';
  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.input_text === 'string') return obj.input_text;
  if (typeof obj.output_text === 'string') return obj.output_text;
  if (typeof obj.message === 'string') return obj.message;
  if ('content' in obj) return extractText(obj.content);
  return '';
}

async function walkJsonl(dir: string): Promise<SessionFile[]> {
  const out: SessionFile[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(entries.map(async entry => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) return;
      try {
        const stat = await fs.stat(full);
        out.push({ file: full, mtimeMs: stat.mtimeMs });
      } catch {
        // Ignore files that rotate while the dashboard is rendering.
      }
    }));
  }
  await walk(dir);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function emptyDashboard(totalSessions = 0): CodexTelemetryDashboard {
  return {
    sessionsPath: CODEX_SESSIONS_DIR,
    generatedAt: new Date().toISOString(),
    totalSessions,
    scannedSessions: 0,
    liveSessions: [],
    recentSessions: [],
    totals: {
      sessionsToday: 0,
      sessions7d: 0,
      approxTokensToday: 0,
      approxTokens7d: 0,
      toolCalls7d: 0,
      errors7d: 0,
      cacheSignals: 0,
      rateLimitPeak: 0,
    },
    daily: [],
    toolLatency: [],
    mcp: [],
    outcomes: [
      { label: 'No Codex JSONLs found', count: 0, tone: 'warning' },
    ],
  };
}

export async function getCodexTelemetryDashboard(): Promise<CodexTelemetryDashboard> {
  const files = await walkJsonl(CODEX_SESSIONS_DIR);
  if (files.length === 0) return emptyDashboard();

  const now = Date.now();
  const today = dayKey(new Date());
  const sevenDaysAgo = now - 7 * 86_400_000;
  const liveCutoff = now - 5 * 60_000;
  const scanned = files.slice(0, MAX_FILES_TO_SCAN);
  const daily = new Map<string, { date: string; sessions: number; approxTokens: number; toolCalls: number; errors: number }>();
  const toolDurations = new Map<string, number[]>();
  const toolErrors = new Map<string, number>();
  const mcpDurations = new Map<string, number[]>();
  const mcpErrors = new Map<string, number>();
  const summaries: CodexSessionSummary[] = [];
  const outcomes = new Map<string, number>();
  let sessionsToday = 0;
  let sessions7d = 0;
  let approxTokensToday = 0;
  let approxTokens7d = 0;
  let toolCalls7d = 0;
  let errors7d = 0;
  let cacheSignals = 0;
  let rateLimitPeak = 0;

  for (const item of scanned) {
    let raw = '';
    try {
      raw = await fs.readFile(item.file, 'utf8');
    } catch {
      continue;
    }

    const callStarts = new Map<string, { name: string; ts: number }>();
    const lines = raw.split('\n').filter(Boolean);
    let id = path.basename(item.file, '.jsonl');
    let title = '';
    let cwd = '';
    let model = '';
    let originator = 'Codex';
    let startedAt = '';
    let updatedAt = '';
    let toolCount = 0;
    let approxTokens = 0;
    let errors = 0;
    let sessionRateLimitPeak = 0;
    let completed = false;
    let aborted = false;

    for (const line of lines) {
      let event: JsonObject;
      try {
        event = JSON.parse(line) as JsonObject;
      } catch {
        continue;
      }
      const timestamp = asString(event.timestamp);
      const ts = timestamp ? Date.parse(timestamp) : item.mtimeMs;
      if (!startedAt && timestamp) startedAt = timestamp;
      if (timestamp) updatedAt = timestamp;
      const type = asString(event.type);
      const payload = asObj(event.payload) ?? {};
      const payloadType = asString(payload.type);

      if (type === 'session_meta') {
        const metaId = asString(payload.id);
        if (metaId) id = metaId;
        cwd = asString(payload.cwd, cwd);
        model = asString(payload.model, model);
        originator = asString(payload.originator, originator);
      }

      if (type === 'turn_context') {
        cwd = asString(payload.cwd, cwd);
        model = asString(payload.model, model);
      }

      if (!title && (payloadType === 'user_message' || (payloadType === 'message' && asString(payload.role) === 'user'))) {
        title = titleFromText(extractText(payload.content ?? payload.message));
      }

      if (payloadType === 'thread_name_updated') {
        title = titleFromText(asString(payload.thread_name, title));
      }

      if (payloadType === 'function_call' || payloadType === 'custom_tool_call' || payloadType === 'web_search_call' || payloadType === 'tool_search_call') {
        const callId = asString(payload.call_id, `${item.file}:${toolCount}`);
        const name = asString(payload.name, payloadType.replace(/_call$/, ''));
        callStarts.set(callId, { name, ts });
        toolCount += 1;
      }

      if (payloadType === 'function_call_output' || payloadType === 'custom_tool_call_output' || payloadType === 'tool_search_output') {
        const callId = asString(payload.call_id);
        const start = callStarts.get(callId);
        if (start) {
          const duration = Math.max(0, Math.min(10 * 60_000, ts - start.ts));
          const bucket = toolDurations.get(start.name) ?? [];
          bucket.push(duration);
          toolDurations.set(start.name, bucket);
          const status = asString(payload.status);
          const output = asString(payload.output);
          if (status === 'error' || /\b(error|failed|exception)\b/i.test(output.slice(0, 500))) {
            toolErrors.set(start.name, (toolErrors.get(start.name) ?? 0) + 1);
            errors += 1;
          }
        }
      }

      if (payloadType.endsWith('_end')) {
        const name = asString(payload.name, payloadType.replace(/_end$/, ''));
        const duration = Math.round(asNumber(payload.duration, 0) * 1000);
        if (duration > 0) {
          const bucket = toolDurations.get(name) ?? [];
          bucket.push(Math.min(10 * 60_000, duration));
          toolDurations.set(name, bucket);
        }
        if (payloadType === 'mcp_tool_call_end') {
          const server = asString(payload.server, 'mcp_tool');
          const tool = asString(payload.tool, name);
          const mcpName = `${server}:${tool}`;
          const bucket = mcpDurations.get(mcpName) ?? [];
          if (duration > 0) bucket.push(Math.min(10 * 60_000, duration));
          mcpDurations.set(mcpName, bucket);
        }
        const status = asString(payload.status);
        const exitCode = asNumber(payload.exit_code, 0);
        if (status === 'error' || exitCode !== 0) {
          toolErrors.set(name, (toolErrors.get(name) ?? 0) + 1);
          if (payloadType === 'mcp_tool_call_end') {
            const server = asString(payload.server, 'mcp_tool');
            const tool = asString(payload.tool, name);
            const mcpName = `${server}:${tool}`;
            mcpErrors.set(mcpName, (mcpErrors.get(mcpName) ?? 0) + 1);
          }
          errors += 1;
        }
      }

      if (payloadType === 'task_complete') completed = true;
      if (payloadType === 'turn_aborted' || type === 'compacted') aborted = true;
      if (payloadType === 'context_compacted' || type === 'compacted') cacheSignals += 1;

      const rateLimits = asObj(payload.rate_limits);
      const primary = asObj(rateLimits?.primary);
      const secondary = asObj(rateLimits?.secondary);
      const peak = Math.max(asNumber(primary?.used_percent), asNumber(secondary?.used_percent));
      if (peak > 0) {
        sessionRateLimitPeak = Math.max(sessionRateLimitPeak, peak);
        rateLimitPeak = Math.max(rateLimitPeak, peak);
      }

      const textForApprox = payloadType === 'message' || payloadType === 'agent_message' || payloadType === 'user_message'
        ? extractText(payload.content ?? payload.message)
        : '';
      approxTokens += Math.ceil(textForApprox.length / TOKEN_CHARS_PER_TOKEN);
    }

    const startMs = startedAt ? Date.parse(startedAt) : item.mtimeMs;
    const sessionDay = dayKey(new Date(startMs));
    const in7d = startMs >= sevenDaysAgo;
    const summary: CodexSessionSummary = {
      id,
      title: title || path.basename(item.file, '.jsonl').replace(/^rollout-/, 'Codex session '),
      cwd: cwd || 'unknown workspace',
      model: model || 'unknown model',
      originator,
      startedAt: startedAt || new Date(item.mtimeMs).toISOString(),
      updatedAt: updatedAt || new Date(item.mtimeMs).toISOString(),
      eventCount: lines.length,
      toolCount,
      approxTokens,
      errors,
      rateLimitPeak: Math.round(sessionRateLimitPeak),
    };
    summaries.push(summary);

    if (in7d) {
      sessions7d += 1;
      approxTokens7d += approxTokens;
      toolCalls7d += toolCount;
      errors7d += errors;
      const row = daily.get(sessionDay) ?? { date: sessionDay, sessions: 0, approxTokens: 0, toolCalls: 0, errors: 0 };
      row.sessions += 1;
      row.approxTokens += approxTokens;
      row.toolCalls += toolCount;
      row.errors += errors;
      daily.set(sessionDay, row);
      if (errors > 0) outcomes.set('errored', (outcomes.get('errored') ?? 0) + 1);
      else if (sessionRateLimitPeak >= 90) outcomes.set('rate pressure', (outcomes.get('rate pressure') ?? 0) + 1);
      else if (aborted) outcomes.set('aborted / compacted', (outcomes.get('aborted / compacted') ?? 0) + 1);
      else if (completed) outcomes.set('completed', (outcomes.get('completed') ?? 0) + 1);
      else outcomes.set('unfinished', (outcomes.get('unfinished') ?? 0) + 1);
    }
    if (sessionDay === today) {
      sessionsToday += 1;
      approxTokensToday += approxTokens;
    }
  }

  function toStats(map: Map<string, number[]>, errorsMap: Map<string, number>): CodexToolStat[] {
    return [...map.entries()]
      .map(([name, values]) => ({
        name,
        count: values.length,
        p50: percentile(values, 50),
        p95: percentile(values, 95),
        max: values.length ? Math.max(...values) : 0,
        errors: errorsMap.get(name) ?? 0,
      }))
      .filter(row => row.count > 0)
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 12);
  }

  const liveSessions = summaries
    .filter(s => Date.parse(s.updatedAt) >= liveCutoff)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 6);

  return {
    sessionsPath: CODEX_SESSIONS_DIR,
    generatedAt: new Date().toISOString(),
    totalSessions: files.length,
    scannedSessions: scanned.length,
    liveSessions,
    recentSessions: summaries.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 10),
    totals: {
      sessionsToday,
      sessions7d,
      approxTokensToday,
      approxTokens7d,
      toolCalls7d,
      errors7d,
      cacheSignals,
      rateLimitPeak: Math.round(rateLimitPeak),
    },
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    toolLatency: toStats(toolDurations, toolErrors),
    mcp: toStats(mcpDurations, mcpErrors),
    outcomes: [
      { label: 'completed', count: outcomes.get('completed') ?? 0, tone: 'success' },
      { label: 'unfinished', count: outcomes.get('unfinished') ?? 0, tone: 'info' },
      { label: 'aborted / compacted', count: outcomes.get('aborted / compacted') ?? 0, tone: 'warning' },
      { label: 'rate pressure', count: outcomes.get('rate pressure') ?? 0, tone: 'warning' },
      { label: 'errored', count: outcomes.get('errored') ?? 0, tone: 'danger' },
    ],
  };
}
