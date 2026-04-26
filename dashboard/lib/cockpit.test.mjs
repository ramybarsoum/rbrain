import { describe, expect, test } from 'bun:test';
import {
  getTodoState,
  pickOneThingNow,
  scoreDecisionEvidence,
  summarizeLoopReason,
} from './cockpit.ts';

const today = '2026-04-26';

describe('cockpit helpers', () => {
  test('getTodoState splits overdue, due today, and upcoming open todos', () => {
    const state = getTodoState([
      { slug: 'late', title: 'Late P1', frontmatter: { done: false, priority: 'p1', due_date: '2026-04-25' } },
      { slug: 'today', title: 'Today P2', frontmatter: { done: false, priority: 'p2', due_date: today } },
      { slug: 'later', title: 'Later', frontmatter: { done: false, priority: 'p3', due_date: '2026-04-30' } },
      { slug: 'done', title: 'Done', frontmatter: { done: true, priority: 'p1', due_date: '2026-04-20' } },
    ], today);

    expect(state.overdue.map(t => t.slug)).toEqual(['late']);
    expect(state.dueToday.map(t => t.slug)).toEqual(['today']);
    expect(state.upcoming.map(t => t.slug)).toEqual(['later']);
  });

  test('pickOneThingNow prefers overdue p1 before meetings or recent issues', () => {
    const oneThing = pickOneThingNow({
      overdueTodos: [{ slug: 'late', title: 'Call payer', frontmatter: { priority: 'p1', due_date: '2026-04-25' } }],
      dueToday: [{ slug: 'today', title: 'Review plan', frontmatter: { priority: 'p1' } }],
      todayMeetings: [{ slug: 'meeting', title: 'Investor call', frontmatter: {} }],
      failedJobs: [{ id: 1, name: 'sync', status: 'failed' }],
    });

    expect(oneThing.kind).toBe('overdue');
    expect(oneThing.title).toBe('Call payer');
    expect(oneThing.reason).toContain('overdue');
  });

  test('scoreDecisionEvidence maps backlink and timeline counts to labels', () => {
    expect(scoreDecisionEvidence({ backlinks: 0, timelineEntries: 0, chunks: 0 }).label).toBe('Low');
    expect(scoreDecisionEvidence({ backlinks: 2, timelineEntries: 1, chunks: 3 }).label).toBe('Medium');
    expect(scoreDecisionEvidence({ backlinks: 5, timelineEntries: 3, chunks: 12 }).label).toBe('High');
  });

  test('summarizeLoopReason explains stale and overdue loops', () => {
    expect(summarizeLoopReason({ due_date: '2026-04-20', updated_at: '2026-04-10T00:00:00Z' }, today)).toContain('overdue');
    expect(summarizeLoopReason({ updated_at: '2026-04-01T00:00:00Z' }, today)).toContain('stale');
  });
});
