/**
 * Dream cycle promotion — deterministic episodic-to-semantic promotion.
 *
 * Collects recent timeline entries across all pages, groups recurring
 * summaries, scores them, and returns promotable patterns.
 *
 * Phase 1 is deterministic. No LLM. No embeddings.
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
  candidates: CandidatePattern[];
  promoted: CandidatePattern[];
  skipped: CandidatePattern[];
  dryRun: boolean;
  runAt: string;
  evidenceWindowDays: number;
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
  // Recurrence factor: 0.3 at min (3), 1.0 at 6+
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
 */
export async function collectEvidence(
  engine: BrainEngine,
  config: PromotionConfig,
): Promise<Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>> {
  const since = new Date(Date.now() - config.evidenceWindowDays * 86400000);
  const sinceStr = since.toISOString().slice(0, 10);

  // Get all pages
  const pages = await engine.listPages({ limit: 500 });

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
    } catch {
      // Skip pages with broken timelines
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
    candidates,
    promoted,
    skipped: [...rejected, ...skipped],
    dryRun,
    runAt,
    evidenceWindowDays: fullConfig.evidenceWindowDays,
  };
}
