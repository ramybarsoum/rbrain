import { describe, test, expect } from 'bun:test';
import {
  normalizeSummary,
  looksLikePhi,
  scoreCandidate,
  rankCandidates,
  DEFAULT_CONFIG,
  type CandidatePattern,
} from '../src/core/promotion.ts';
import type { TimelineEntry } from '../src/core/types.ts';

describe('normalizeSummary', () => {
  test('lowercases and strips trailing punctuation', () => {
    expect(normalizeSummary('Updated patient care plan.')).toBe('updated patient care plan');
  });

  test('collapses whitespace', () => {
    expect(normalizeSummary('  sync   completed  ')).toBe('sync completed');
  });

  test('empty string returns empty', () => {
    expect(normalizeSummary('')).toBe('');
  });
});

describe('looksLikePhi', () => {
  test('detects phone numbers', () => {
    expect(looksLikePhi('Call patient at 555-123-4567')).toBe(true);
  });

  test('detects SSN-like patterns', () => {
    expect(looksLikePhi('SSN: 123-45-6789')).toBe(true);
  });

  test('allows normal text', () => {
    expect(looksLikePhi('sync completed for facility')).toBe(false);
  });

  test('allows safe patterns', () => {
    expect(looksLikePhi('meeting with team about care coordination')).toBe(false);
  });
});

describe('scoreCandidate', () => {
  test('high recurrence and recent date scores well', () => {
    const today = new Date().toISOString().slice(0, 10);
    const score = scoreCandidate(6, today, 3);
    expect(score).toBeGreaterThan(0.5);
  });

  test('low recurrence scores lower than high recurrence', () => {
    const today = new Date().toISOString().slice(0, 10);
    const lowScore = scoreCandidate(1, today, 1);
    const highScore = scoreCandidate(6, today, 3);
    expect(lowScore).toBeLessThan(highScore);
  });

  test('old entries decay', () => {
    const twoWeeksAgo = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    const recentScore = scoreCandidate(6, new Date().toISOString().slice(0, 10), 3);
    const oldScore = scoreCandidate(6, twoWeeksAgo, 3);
    expect(recentScore).toBeGreaterThan(oldScore);
  });
});

describe('rankCandidates', () => {
  function makeEntry(slug: string, date: string, summary: string): { slug: string; entry: TimelineEntry } {
    return {
      slug,
      entry: {
        id: Math.random(),
        page_id: 1,
        date,
        source: 'test',
        summary,
        detail: '',
        created_at: new Date(),
      },
    };
  }

  test('groups recurring entries into promotable candidates', () => {
    const today = new Date().toISOString().slice(0, 10);
    const evidence = new Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>();
    const key = 'sync completed for facility';

    evidence.set(key, {
      entries: [
        makeEntry('facility-a', today, 'Sync completed for facility'),
        makeEntry('facility-b', today, 'Sync completed for facility'),
        makeEntry('facility-a', today, 'Sync completed for facility'),
      ],
    });

    const candidates = rankCandidates(evidence, DEFAULT_CONFIG);
    expect(candidates.length).toBe(1);
    expect(candidates[0].recurrence).toBe(3);
    expect(candidates[0].reason).toBe('promotable');
  });

  test('rejects below-threshold entries', () => {
    const today = new Date().toISOString().slice(0, 10);
    const evidence = new Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>();
    const key = 'one-off event';

    evidence.set(key, {
      entries: [makeEntry('page-a', today, 'One-off event')],
    });

    const candidates = rankCandidates(evidence, DEFAULT_CONFIG);
    expect(candidates.length).toBe(1);
    expect(candidates[0].reason).toContain('below threshold');
  });

  test('rejects PHI-like patterns', () => {
    const today = new Date().toISOString().slice(0, 10);
    const evidence = new Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>();
    const key = 'patient id 12345 updated';

    evidence.set(key, {
      entries: [
        makeEntry('page-a', today, 'Patient ID 12345 updated'),
        makeEntry('page-b', today, 'Patient ID 12345 updated'),
        makeEntry('page-a', today, 'Patient ID 12345 updated'),
        makeEntry('page-c', today, 'Patient ID 12345 updated'),
      ],
    });

    const candidates = rankCandidates(evidence, DEFAULT_CONFIG);
    const phiCandidate = candidates.find(c => c.pattern === key);
    expect(phiCandidate).toBeDefined();
    expect(phiCandidate!.reason).toContain('PHI');
  });

  test('sorts by score descending', () => {
    const today = new Date().toISOString().slice(0, 10);
    const evidence = new Map<string, { entries: { slug: string; entry: TimelineEntry }[] }>();

    // Low score pattern
    evidence.set('low pattern', {
      entries: [
        makeEntry('page-a', today, 'Low pattern'),
        makeEntry('page-a', today, 'Low pattern'),
        makeEntry('page-a', today, 'Low pattern'),
      ],
    });

    // High score pattern (more recurrence, more spread)
    evidence.set('high pattern', {
      entries: [
        makeEntry('page-a', today, 'High pattern'),
        makeEntry('page-b', today, 'High pattern'),
        makeEntry('page-c', today, 'High pattern'),
        makeEntry('page-d', today, 'High pattern'),
        makeEntry('page-e', today, 'High pattern'),
        makeEntry('page-a', today, 'High pattern'),
      ],
    });

    const candidates = rankCandidates(evidence, DEFAULT_CONFIG);
    const promotable = candidates.filter(c => c.reason === 'promotable');
    expect(promotable.length).toBe(2);
    expect(promotable[0].score).toBeGreaterThan(promotable[1].score);
  });
});
