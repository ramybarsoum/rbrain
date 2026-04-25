/**
 * Dream cycle promotion — deterministic episodic-to-semantic promotion.
 *
 * Collects recent timeline entries across all pages, groups recurring
 * summaries, scores them, and returns promotable patterns.
 *
 * Phase 1 is deterministic. No LLM. No embeddings.
 *
 * INTEGRATION:
 *   Composes into runCycle as `phase: 'promotion'`. Two callers reach the
 *   engine function below: `runCycle` (autopilot, scheduled) and
 *   `gbrain dream-cycle` CLI (manual one-off with custom config knobs).
 *   Both share runDreamCycle so behavior stays identical.
 *
 * EDGE CASES (documented contract):
 *   - Empty brain (zero pages): returns a clean PromotionReport with
 *     candidates=[], promoted=[], skipped=[].
 *   - Brain with > MAX_PAGES_TO_SCAN pages: scans the first MAX_PAGES_TO_SCAN
 *     by listPages ordering. Older / less recently accessed pages may not
 *     contribute evidence on a single run. This is a known limitation; full
 *     coverage requires multi-run paging (not yet implemented).
 *   - All candidates below threshold: PromotionReport.promoted=[],
 *     PromotionReport.skipped=[every-candidate], status still 'ok'.
 *   - Target page not found at apply time: skipped with reason
 *     'target page <slug> not found', no exception.
 *   - Target page modified between scoring and apply: last write wins
 *     (no optimistic concurrency check). Acceptable because compiled_truth
 *     is append-only here.
 */

import type { BrainEngine } from './engine.ts';
import type { TimelineEntry } from './types.ts';

// --- Config ---

export interface PromotionConfig {
  /** How far back to look for evidence (days). Default: 14 */
  evidenceWindowDays: number;
  /** Minimum recurrence count to consider a pattern promotable. Default: 3 */
  minRecurrence: number;
  /** Max promotions per run. Default: 10 */
  maxPromotions: number;
}

export const DEFAULT_CONFIG: PromotionConfig = {
  evidenceWindowDays: 14,
  minRecurrence: 3,
  maxPromotions: 10,
};

// --- Types ---

export interface CandidatePattern {
  /** Normalized summary text (the pattern key) */
  pattern: string;
  /** How many distinct timeline entries mention this pattern */
  recurrence: number;
  /** Slugs where this pattern appeared */
  slugs: string[];
  /** Most recent date seen */
  lastSeen: string;
  /** Score (0-1, higher = more promotable) */
  score: number;
  /** Why it was accepted or rejected */
  reason: string;
}

export interface PromotionReport {
  /** Stable schema marker. Bumped on breaking changes to this shape. */
  schema_version: '1';
  candidates: CandidatePattern[];
  promoted: CandidatePattern[];
  skipped: CandidatePattern[];
  dryRun: boolean;
  runAt: string;
  evidenceWindowDays: number;
}

/**
 * Maximum number of pages scanned for evidence in a single cycle.
 * Documented as part of the phase contract — agents should know that
 * brains exceeding this size won't be fully covered by a single run.
 */
export const MAX_PAGES_TO_SCAN = 500;

/**
 * Default minimum hours between consecutive promotion runs. Used by the
 * stamp-file rate limiter in runPhasePromotion (src/core/cycle.ts).
 */
export const DEFAULT_PROMOTION_MIN_HOURS = 23;

/**
 * Returns true if the dream cycle is due to run based on the last-run timestamp.
 * Rate-limits nightly promotion to roughly once per day even when the
 * autopilot cycle fires every few minutes.
 *
 * @param lastRunMs  Epoch ms of the last successful run, or 0 if never
 * @param nowMs      Current epoch ms
 * @param minHours   Minimum gap between runs in hours (default 23)
 *
 * Edge cases:
 *   - lastRunMs = 0 or non-finite → returns true (first run)
 *   - lastRunMs > nowMs (clock skew) → returns true (defensive)
 *   - lastRunMs negative → returns true (treat as first run)
 */
export function shouldRunDreamCycle(
  lastRunMs: number,
  nowMs: number,
  minHours: number = DEFAULT_PROMOTION_MIN_HOURS,
): boolean {
  if (!Number.isFinite(lastRunMs) || lastRunMs <= 0) return true;
  if (nowMs < lastRunMs) return true;
  return (nowMs - lastRunMs) / 3600000 >= minHours;
}

// --- Normalization ---

/**
 * Normalize a timeline summary for grouping.
 * Lowercase, collapse whitespace, strip trailing punctuation.
 */
export function normalizeSummary(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.:;,!?]+$/, '')
    .trim();
}

// --- PHR detection (simplified) ---

const PHI_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,           // phone numbers
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,            // SSN-like
  /\b[A-Z]\d{3}[A-Z]{2}\d\b/i,                    // some ID patterns
  /\b(patient\s+(id|name|dob|ssn|mrn))\b/i,       // patient fields
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,                // dates that could be DOB
];

export function looksLikePhi(text: string): boolean {
  return PHI_PATTERNS.some(p => p.test(text));
}

// --- Scoring ---

/**
 * Score a candidate pattern. Returns 0-1.
 *
 * Factors:
 * - recurrence (more = better, max contribution at 6+)
 * - recency (more recent = better)
 * - slug spread (appearing on more pages = better)
 */
export function scoreCandidate(
  recurrence: number,
  lastSeenDate: string,
  slugCount: number,
): number {
  // Recurrence factor: 0.5 at min (3), 1.0 at 6+
  const recFactor = Math.min(recurrence / 6, 1.0);

  // Recency factor: 1.0 if today, decays over 14 days
  const daysSinceLast = Math.max(0,
    (Date.now() - new Date(lastSeenDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  const recencyFactor = Math.max(0, 1 - daysSinceLast / 14);

  // Spread factor: 0.5 for 1 slug, 1.0 for 3+
  const spreadFactor = Math.min(slugCount / 3, 1.0) * 0.5 + 0.5;

  return recFactor * 0.5 + recencyFactor * 0.3 + spreadFactor * 0.2;
}

// --- Core logic ---

/**
 * Collect timeline evidence from the last N days across all pages.
 * Returns entries grouped by normalized summary.
 *
 * Edge cases:
 *   - Empty brain (zero pages): returns empty Map, no error.
 *   - Brain with > MAX_PAGES_TO_SCAN pages: scans only the first slice as
 *     ordered by listPages (recency-default per BrainEngine).
 *   - Page with broken/malformed timeline: page is skipped (current behavior
 *     swallows the error silently — flagged for fix in PR #3 OBSERVABILITY gate).
 */
export async function collectEvidence(
  engine: BrainEngine,
  config: PromotionConfig,
): Promise<Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>> {
  const since = new Date(Date.now() - config.evidenceWindowDays * 86400000);
  const sinceStr = since.toISOString().slice(0, 10);

  // Scan up to MAX_PAGES_TO_SCAN pages. Brains larger than this won't be
  // fully covered in a single run — see PromotionReport edge cases at top of file.
  const pages = await engine.listPages({ limit: MAX_PAGES_TO_SCAN });

  // Collect timeline entries per page
  const groups = new Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>();

  for (const page of pages) {
    try {
      const timeline = await engine.getTimeline(page.slug, {
        after: sinceStr,
        limit: 100,
      });

      for (const entry of timeline) {
        const key = normalizeSummary(entry.summary);
        if (!key) continue;

        if (!groups.has(key)) {
          groups.set(key, { entries: [] });
        }
        groups.get(key)!.entries.push({ slug: page.slug, entry });
      }
    } catch (e) {
      console.warn(
        '[promotion.collectEvidence] skipping page %s with broken timeline: %s',
        page.slug,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return groups;
}

/**
 * Score collected evidence and return ranked candidates.
 */
export function rankCandidates(
  evidence: Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>,
  config: PromotionConfig,
): CandidatePattern[] {
  const candidates: CandidatePattern[] = [];

  for (const [pattern, data] of evidence) {
    const recurrence = data.entries.length;
    const uniqueSlugs = [...new Set(data.entries.map(e => e.slug))];
    const dates = data.entries.map(e => e.entry.date).sort();
    const lastSeen = dates[dates.length - 1];

    // Reject: below threshold
    if (recurrence < config.minRecurrence) {
      candidates.push({
        pattern,
        recurrence,
        slugs: uniqueSlugs,
        lastSeen,
        score: 0,
        reason: `below threshold (${recurrence} < ${config.minRecurrence})`,
      });
      continue;
    }

    // Reject: PHI-like
    if (looksLikePhi(pattern)) {
      candidates.push({
        pattern,
        recurrence,
        slugs: uniqueSlugs,
        lastSeen,
        score: 0,
        reason: 'rejected: possible PHI content',
      });
      continue;
    }

    const score = scoreCandidate(recurrence, lastSeen, uniqueSlugs.length);
    candidates.push({
      pattern,
      recurrence,
      slugs: uniqueSlugs,
      lastSeen,
      score,
      reason: score >= 0.4 ? 'promotable' : `low score (${score.toFixed(2)})`,
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Apply promotions. For each promotable candidate, append a semantic note
 * to the most relevant page's compiled_truth and add a timeline entry.
 *
 * Returns the list of actually promoted candidates.
 */
export async function applyPromotions(
  engine: BrainEngine,
  promotable: CandidatePattern[],
  config: PromotionConfig,
  dryRun: boolean,
): Promise<{ promoted: CandidatePattern[]; skipped: CandidatePattern[] }> {
  const promoted: CandidatePattern[] = [];
  const skipped: CandidatePattern[] = [];
  let applied = 0;

  for (const candidate of promotable) {
    if (applied >= config.maxPromotions) {
      skipped.push({ ...candidate, reason: 'max promotions reached' });
      continue;
    }

    // Pick the first slug as the target (most recent entry's page)
    const targetSlug = candidate.slugs[0];

    if (dryRun) {
      promoted.push({ ...candidate, reason: `[dry-run] would promote to ${targetSlug}` });
      applied++;
      continue;
    }

    try {
      const page = await engine.getPage(targetSlug);
      if (!page) {
        skipped.push({ ...candidate, reason: `target page ${targetSlug} not found` });
        continue;
      }

      // Append semantic note to compiled_truth
      const semanticNote = `\n\n---\n**Semantic note** (dream-cycle ${new Date().toISOString().slice(0, 10)}): Recurring pattern detected across ${candidate.recurrence} entries. ${candidate.pattern}`;
      const updatedTruth = page.compiled_truth + semanticNote;

      await engine.putPage(targetSlug, {
        type: page.type,
        title: page.title,
        compiled_truth: updatedTruth,
        frontmatter: page.frontmatter,
      });

      // Add timeline entry documenting the promotion
      await engine.addTimelineEntry(targetSlug, {
        date: new Date().toISOString().slice(0, 10),
        source: 'dream-cycle',
        summary: `Promoted recurring pattern (${candidate.recurrence} occurrences) to semantic memory`,
        detail: `Pattern: "${candidate.pattern}". Score: ${candidate.score.toFixed(2)}. Spread across: ${candidate.slugs.join(', ')}`,
      });

      promoted.push({ ...candidate, reason: `promoted to ${targetSlug}` });
      applied++;
    } catch (e) {
      skipped.push({ ...candidate, reason: `error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  return { promoted, skipped };
}

/**
 * Run the full dream cycle. Returns a structured report.
 */
export async function runDreamCycle(
  engine: BrainEngine,
  config: Partial<PromotionConfig> = {},
  dryRun: boolean = true,
): Promise<PromotionReport> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const runAt = new Date().toISOString();

  // 1. Collect evidence
  const evidence = await collectEvidence(engine, fullConfig);

  // 2. Rank candidates
  const candidates = rankCandidates(evidence, fullConfig);

  // 3. Split into promotable and rejected
  const promotable = candidates.filter(c => c.reason === 'promotable');
  const rejected = candidates.filter(c => c.reason !== 'promotable');

  // 4. Apply promotions
  const { promoted, skipped } = await applyPromotions(engine, promotable, fullConfig, dryRun);

  return {
    schema_version: '1',
    candidates,
    promoted,
    skipped: [...rejected, ...skipped],
    dryRun,
    runAt,
    evidenceWindowDays: fullConfig.evidenceWindowDays,
  };
}
