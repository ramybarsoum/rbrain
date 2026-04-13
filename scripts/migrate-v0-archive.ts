#!/usr/bin/env bun
// Phase 1 of the v0_archive → public migration.
// Reads every knowledge-bearing v0_archive table and writes one markdown
// file per row into the scratch dir (default /tmp/v0-export). Each file
// has YAML frontmatter that gbrain import will read.
//
// Plan: ~/.claude/plans/starry-crunching-peach.md
// Source schemas: queried at plan time, see plan doc for column lists.
//
// Usage:
//   bun scripts/migrate-v0-archive.ts [--out /tmp/v0-export] [--limit N]
//
// --limit N is for dry-runs: only emit N files per source table, not all.

import postgres from 'postgres';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : '/tmp/v0-export';
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null;
const DB_URL = process.env.RBRAIN_DATABASE_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('FAIL: RBRAIN_DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DB_URL, { prepare: false, max: 5, idle_timeout: 20 });

// ─────────────────────────────────────── helpers

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'untitled';
}

function id8(idLike: string | number | bigint): string {
  return String(idLike).replace(/-/g, '').slice(0, 8) || '00000000';
}

function dateOnly(ts: string | Date | null | undefined): string {
  if (!ts) return 'undated';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return 'undated';
  return d.toISOString().slice(0, 10);
}

function yamlValue(v: unknown): string {
  if (v === null || v === undefined) return '""';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return '[' + v.map(item => JSON.stringify(String(item))).join(', ') + ']';
  }
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(String(v));
}

function emitFrontmatter(fm: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    lines.push(`${k}: ${yamlValue(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

let written = 0;
let skipped = 0;

function writeMd(typeDir: string, slug: string, frontmatter: Record<string, unknown>, body: string) {
  const dir = join(OUT, typeDir);
  mkdirSync(dir, { recursive: true });
  // gbrain import requires frontmatter.slug to match path-derived slug.
  // Path-derived slug = "<typeDir>/<filename without .md>". We omit slug from
  // frontmatter so gbrain derives it from the path automatically.
  const fmCopy = { ...frontmatter };
  delete fmCopy.slug;
  const md = emitFrontmatter(fmCopy) + (body || '').trim() + '\n';
  // Filename = the part after the type/ prefix from our slug pattern.
  const filename = slug.replace(new RegExp(`^${typeDir}/`), '') + '.md';
  writeFileSync(join(dir, filename), md);
  written++;
}

function limitClause(): string {
  return LIMIT ? ` LIMIT ${LIMIT}` : '';
}

// ─────────────────────────────────────── people (+ bound compiled_truth)

async function migratePeople() {
  console.log('→ people');
  const rows = await sql.unsafe(`
    SELECT
      p.id, p.name, p.context, p.follow_ups, p.tags, p.aliases, p.email,
      p.company, p.role, p.phone, p.linkedin, p.priority, p.relationship_type,
      p.communication_style, p.key_topics, p.interaction_count,
      p.first_interaction, p.last_interaction, p.last_touched, p.created_at,
      ct.id as ct_id, ct.summary as ct_summary, ct.tags as ct_tags,
      ct.confidence_notes, ct.last_compiled_at
    FROM v0_archive.people p
    LEFT JOIN v0_archive.compiled_truth ct
      ON ct.entity_type = 'person' AND ct.entity_id = p.id
    ORDER BY p.created_at${limitClause()}
  `);

  for (const r of rows) {
    const slugBase = `person/${slugify(r.name as string)}-${id8(r.id as string)}`;
    const allTags = Array.from(new Set([
      ...((r.tags as string[]) || []),
      ...((r.ct_tags as string[]) || []),
      ...((r.key_topics as string[]) || []),
    ])).filter(Boolean);

    const compiledTruth = (r.ct_summary as string | null) || (r.context as string | null) || '';
    const bodyParts: string[] = [];
    if (compiledTruth) bodyParts.push(compiledTruth);
    if (r.follow_ups && (r.follow_ups as string).trim()) {
      bodyParts.push(`\n## Follow-ups\n${r.follow_ups}`);
    }
    const factParts: string[] = [];
    if (r.email) factParts.push(`- **Email:** ${r.email}`);
    if (r.company) factParts.push(`- **Company:** ${r.company}`);
    if (r.role) factParts.push(`- **Role:** ${r.role}`);
    if (r.phone) factParts.push(`- **Phone:** ${r.phone}`);
    if (r.linkedin) factParts.push(`- **LinkedIn:** ${r.linkedin}`);
    if (r.relationship_type) factParts.push(`- **Relationship:** ${r.relationship_type}`);
    if (r.communication_style) factParts.push(`- **Style:** ${r.communication_style}`);
    if (factParts.length > 0) {
      bodyParts.unshift(`## Facts\n${factParts.join('\n')}\n`);
    }
    const body = bodyParts.join('\n').trim();

    writeMd('person', slugBase, {
      title: r.name,
      type: 'person',
      tags: allTags,
      v0_id: r.id,
      v0_table: 'people',
      v0_compiled_truth_id: r.ct_id,
      v0_email: r.email,
      v0_company: r.company,
      v0_role: r.role,
      v0_priority: r.priority,
      v0_aliases: r.aliases,
      v0_interaction_count: r.interaction_count,
      v0_first_interaction: r.first_interaction,
      v0_last_interaction: r.last_interaction,
      v0_last_touched: r.last_touched,
    }, body);
  }
  console.log(`  ${rows.length} people written`);
}

// ─────────────────────────────────────── orphan compiled_truth (person)

async function migrateOrphanPeople() {
  console.log('→ orphan people (compiled_truth without parent row)');
  const rows = await sql.unsafe(`
    SELECT id, entity_name, summary, tags, confidence_notes, last_compiled_at
    FROM v0_archive.compiled_truth
    WHERE entity_type = 'person' AND entity_id IS NULL
    ORDER BY entity_name${limitClause()}
  `);
  for (const r of rows) {
    const slugBase = `person/${slugify(r.entity_name as string)}-orphan`;
    writeMd('person', slugBase, {
      title: r.entity_name,
      type: 'person',
      tags: r.tags || [],
      v0_id: r.id,
      v0_table: 'compiled_truth',
      v0_orphan: true,
    }, r.summary as string);
  }
  console.log(`  ${rows.length} orphan people written`);
}

// ─────────────────────────────────────── topics (free-floating compiled_truth)

async function migrateTopics() {
  console.log('→ topics (compiled_truth where entity_type=topic)');
  const rows = await sql.unsafe(`
    SELECT id, entity_name, summary, tags, last_compiled_at
    FROM v0_archive.compiled_truth
    WHERE entity_type = 'topic'
    ORDER BY entity_name${limitClause()}
  `);
  for (const r of rows) {
    const slugBase = `topic/${slugify(r.entity_name as string)}`;
    writeMd('topic', slugBase, {
      title: r.entity_name,
      type: 'topic',
      tags: r.tags || [],
      v0_id: r.id,
      v0_table: 'compiled_truth',
    }, r.summary as string);
  }
  console.log(`  ${rows.length} topics written`);
}

// ─────────────────────────────────────── projects

async function migrateProjects() {
  console.log('→ projects');
  const rows = await sql.unsafe(`
    SELECT
      p.id, p.name, p.status, p.next_action, p.notes, p.tags,
      p.last_touched, p.created_at,
      ct.id as ct_id, ct.summary as ct_summary, ct.tags as ct_tags
    FROM v0_archive.projects p
    LEFT JOIN v0_archive.compiled_truth ct
      ON ct.entity_type = 'project' AND ct.entity_id = p.id
    ORDER BY p.created_at${limitClause()}
  `);
  for (const r of rows) {
    const slugBase = `project/${slugify(r.name as string)}-${id8(r.id as string)}`;
    const allTags = Array.from(new Set([
      ...((r.tags as string[]) || []),
      ...((r.ct_tags as string[]) || []),
      String(r.status || '').toLowerCase(),
    ])).filter(Boolean);
    const body = [
      r.ct_summary || '',
      r.next_action ? `\n## Next Action\n${r.next_action}` : '',
      r.notes ? `\n## Notes\n${r.notes}` : '',
    ].filter(Boolean).join('\n').trim();

    writeMd('project', slugBase, {
      title: r.name,
      type: 'project',
      tags: allTags,
      v0_id: r.id,
      v0_table: 'projects',
      v0_status: r.status,
      v0_compiled_truth_id: r.ct_id,
      v0_last_touched: r.last_touched,
    }, body);
  }
  console.log(`  ${rows.length} projects written`);
}

// ─────────────────────────────────────── meetings (+ action items as timeline-ish)

async function migrateMeetings() {
  console.log('→ meetings');
  const rows = await sql.unsafe(`
    SELECT m.id, m.title, m.summary, m.attendees, m.action_items, m.decisions_made,
           m.tags, m.meeting_at, m.transcript, m.recording_url, m.source,
           m.duration_minutes, m.notes_private, m.created_at
    FROM v0_archive.meetings m
    ORDER BY m.meeting_at${limitClause()}
  `);
  for (const r of rows) {
    const date = dateOnly(r.meeting_at as string);
    const slugBase = `meeting/${date}-${slugify(r.title as string)}-${id8(r.id as bigint)}`;
    const bodyParts: string[] = [];
    if (r.summary) bodyParts.push(`## Summary\n${r.summary}`);
    if (r.attendees && (r.attendees as string[]).length > 0) {
      bodyParts.push(`## Attendees\n${(r.attendees as string[]).map(a => `- ${a}`).join('\n')}`);
    }
    if (r.action_items && (r.action_items as string[]).length > 0) {
      bodyParts.push(`## Action Items\n${(r.action_items as string[]).map(a => `- ${a}`).join('\n')}`);
    }
    if (r.decisions_made && (r.decisions_made as string[]).length > 0) {
      bodyParts.push(`## Decisions Made\n${(r.decisions_made as string[]).map(a => `- ${a}`).join('\n')}`);
    }
    if (r.notes_private) bodyParts.push(`## Private Notes\n${r.notes_private}`);
    if (r.transcript) bodyParts.push(`## Transcript\n${r.transcript}`);

    writeMd('meeting', slugBase, {
      title: r.title,
      type: 'meeting',
      tags: r.tags || [],
      v0_id: String(r.id),
      v0_table: 'meetings',
      v0_meeting_at: r.meeting_at,
      v0_source: r.source,
      v0_duration_minutes: r.duration_minutes,
      v0_recording_url: r.recording_url,
    }, bodyParts.join('\n\n'));
  }
  console.log(`  ${rows.length} meetings written`);
}

// ─────────────────────────────────────── thoughts (HUGE — 9347)

const THOUGHT_ROUTES_TO_TYPES: Record<string, { type: string; dir: string }> = {
  'thought':         { type: 'thought',         dir: 'thought' },
  'project_update':  { type: 'project_update',  dir: 'project_update' },
  'feature_request': { type: 'thought_feature_request', dir: 'thought_feature_request' },
  'idea':            { type: 'thought_idea',    dir: 'thought_idea' },
  'learning':        { type: 'thought_learning',dir: 'thought_learning' },
  'decision':        { type: 'thought_decision',dir: 'thought_decision' },
  'follow_up':       { type: 'thought_follow_up', dir: 'thought_follow_up' },
  'person_note':     { type: 'person_note',     dir: 'person_note' },
  'meeting_note':    { type: 'meeting_note',    dir: 'meeting_note' },
};

function thoughtTypeFor(route: string | null): { type: string; dir: string } {
  if (!route) return { type: 'thought', dir: 'thought' };
  return THOUGHT_ROUTES_TO_TYPES[route] || { type: 'thought', dir: 'thought' };
}

async function migrateThoughts() {
  console.log('→ thoughts (9k+, this is the big one)');
  const rows = await sql.unsafe(`
    SELECT id, content, metadata, routed_to, route_confidence,
           created_at, updated_at, content_fingerprint
    FROM v0_archive.thoughts
    ORDER BY created_at${limitClause()}
  `);
  let count = 0;
  for (const r of rows) {
    const meta = (r.metadata as Record<string, unknown>) || {};
    const route = (r.routed_to as string | null) || (meta.route as string | null);
    const { type, dir } = thoughtTypeFor(route);
    const date = dateOnly(r.created_at as string);
    const titleRaw = (meta.title as string) || (r.content as string).split('\n')[0].slice(0, 60);
    const title = (titleRaw || 'untitled').trim();
    const slugBase = `${dir}/${date}-${slugify(title)}-${id8(r.id as string)}`;

    // Compose tags: metadata.topics + route + source
    const tags = Array.from(new Set([
      ...((meta.topics as string[]) || []),
      ...(route ? [route] : []),
      ...(meta.source ? [meta.source as string] : []),
    ])).filter(Boolean);

    // Action items go inline as a markdown section
    const bodyParts = [r.content as string];
    if (meta.action_items && Array.isArray(meta.action_items) && (meta.action_items as string[]).length > 0) {
      bodyParts.push(`\n## Action Items\n${(meta.action_items as string[]).map(a => `- ${a}`).join('\n')}`);
    }

    writeMd(dir, slugBase, {
      title,
      type,
      tags,
      v0_id: r.id,
      v0_table: 'thoughts',
      v0_route: route,
      v0_confidence: meta.confidence,
      v0_source: meta.source,
      v0_slack_ts: meta.slack_ts,
      v0_requester: meta.requester,
      v0_people_mentioned: meta.people || [],
      v0_due_date: meta.due_date,
      v0_created_at: r.created_at,
    }, bodyParts.join('\n'));

    count++;
    if (count % 1000 === 0) console.log(`  ${count}/${rows.length}...`);
  }
  console.log(`  ${rows.length} thoughts written`);
}

// ─────────────────────────────────────── learnings

async function migrateLearnings() {
  console.log('→ learnings');
  const rows = await sql.unsafe(`
    SELECT id, title, source, source_type, key_insights, how_to_apply,
           tags, created_at
    FROM v0_archive.learnings
    ORDER BY id${limitClause()}
  `);
  for (const r of rows) {
    const slugBase = `learning/${r.id}-${slugify(r.title as string)}`;
    const bodyParts: string[] = [];
    if (r.source) bodyParts.push(`## Source\n${r.source}`);
    if (r.key_insights) bodyParts.push(`## Key Insights\n${r.key_insights}`);
    if (r.how_to_apply) bodyParts.push(`## How to Apply\n${r.how_to_apply}`);

    writeMd('learning', slugBase, {
      title: r.title,
      type: 'learning',
      tags: Array.from(new Set([...((r.tags as string[]) || []), r.source_type as string])).filter(Boolean),
      v0_id: String(r.id),
      v0_table: 'learnings',
      v0_source: r.source,
      v0_source_type: r.source_type,
      v0_created_at: r.created_at,
    }, bodyParts.join('\n\n'));
  }
  console.log(`  ${rows.length} learnings written`);
}

// ─────────────────────────────────────── decisions

async function migrateDecisions() {
  console.log('→ decisions');
  const rows = await sql.unsafe(`
    SELECT id, title, context, decision, rationale, outcome, status, tags,
           decided_at, created_at
    FROM v0_archive.decisions
    ORDER BY id${limitClause()}
  `);
  for (const r of rows) {
    const slugBase = `decision/${r.id}-${slugify(r.title as string)}`;
    const bodyParts: string[] = [];
    if (r.context) bodyParts.push(`## Context\n${r.context}`);
    bodyParts.push(`## Decision\n${r.decision}`);
    if (r.rationale) bodyParts.push(`## Rationale\n${r.rationale}`);
    if (r.outcome) bodyParts.push(`## Outcome\n${r.outcome}`);

    writeMd('decision', slugBase, {
      title: r.title,
      type: 'decision',
      tags: Array.from(new Set([...((r.tags as string[]) || []), r.status as string])).filter(Boolean),
      v0_id: String(r.id),
      v0_table: 'decisions',
      v0_status: r.status,
      v0_decided_at: r.decided_at,
      v0_created_at: r.created_at,
    }, bodyParts.join('\n\n'));
  }
  console.log(`  ${rows.length} decisions written`);
}

// ─────────────────────────────────────── follow_ups

async function migrateFollowUps() {
  console.log('→ follow_ups');
  const rows = await sql.unsafe(`
    SELECT id, contact_id, title, due_date, status, snoozed_until, notes, created_at
    FROM v0_archive.follow_ups
    ORDER BY created_at${limitClause()}
  `);
  for (const r of rows) {
    const date = r.due_date ? dateOnly(r.due_date as string) : 'undated';
    const slugBase = `follow-up/${date}-${slugify(r.title as string)}-${id8(r.id as string)}`;
    const bodyParts: string[] = [];
    if (r.notes) bodyParts.push(`## Notes\n${r.notes}`);
    if (r.due_date) bodyParts.push(`## Due\n${dateOnly(r.due_date as string)}`);
    bodyParts.push(`## Status\n${r.status || 'pending'}`);

    writeMd('follow-up', slugBase, {
      title: r.title,
      type: 'follow_up',
      tags: [r.status as string].filter(Boolean),
      v0_id: r.id,
      v0_table: 'follow_ups',
      v0_contact_id: r.contact_id,
      v0_due_date: r.due_date,
      v0_status: r.status,
      v0_snoozed_until: r.snoozed_until,
      v0_created_at: r.created_at,
    }, bodyParts.join('\n\n'));
  }
  console.log(`  ${rows.length} follow_ups written`);
}

// ─────────────────────────────────────── feature_requests

async function migrateFeatureRequests() {
  console.log('→ feature_requests');
  const rows = await sql.unsafe(`
    SELECT id, title, description, requester, requester_role, priority, status,
           linked_project, tags, source, slack_ts, created_at
    FROM v0_archive.feature_requests
    ORDER BY created_at${limitClause()}
  `);
  for (const r of rows) {
    const slugBase = `feature-request/${id8(r.id as string)}-${slugify(r.title as string)}`;
    const bodyParts: string[] = [];
    if (r.description) bodyParts.push(`## Description\n${r.description}`);
    const factParts: string[] = [];
    if (r.requester) factParts.push(`- **Requester:** ${r.requester}${r.requester_role ? ` (${r.requester_role})` : ''}`);
    if (r.priority) factParts.push(`- **Priority:** ${r.priority}`);
    if (r.status) factParts.push(`- **Status:** ${r.status}`);
    if (r.source) factParts.push(`- **Source:** ${r.source}`);
    if (factParts.length) bodyParts.push(`## Meta\n${factParts.join('\n')}`);

    writeMd('feature-request', slugBase, {
      title: r.title,
      type: 'feature_request',
      tags: Array.from(new Set([
        ...((r.tags as string[]) || []),
        r.priority as string, r.status as string, r.source as string,
      ])).filter(Boolean),
      v0_id: r.id,
      v0_table: 'feature_requests',
      v0_linked_project: r.linked_project,
      v0_requester: r.requester,
      v0_priority: r.priority,
      v0_status: r.status,
      v0_source: r.source,
      v0_slack_ts: r.slack_ts,
      v0_created_at: r.created_at,
    }, bodyParts.join('\n\n'));
  }
  console.log(`  ${rows.length} feature_requests written`);
}

// ─────────────────────────────────────── ideas

async function migrateIdeas() {
  console.log('→ ideas');
  const rows = await sql.unsafe(`
    SELECT id, name, one_liner, notes, tags, last_touched, created_at
    FROM v0_archive.ideas
    ORDER BY created_at${limitClause()}
  `);
  for (const r of rows) {
    const slugBase = `idea/${slugify(r.name as string)}-${id8(r.id as string)}`;
    const bodyParts: string[] = [];
    if (r.one_liner) bodyParts.push(r.one_liner as string);
    if (r.notes) bodyParts.push(`## Notes\n${r.notes}`);

    writeMd('idea', slugBase, {
      title: r.name,
      type: 'idea',
      tags: r.tags || [],
      v0_id: r.id,
      v0_table: 'ideas',
      v0_last_touched: r.last_touched,
      v0_created_at: r.created_at,
    }, bodyParts.join('\n\n'));
  }
  console.log(`  ${rows.length} ideas written`);
}

// ─────────────────────────────────────── interactions

async function migrateInteractions() {
  console.log('→ interactions');
  const rows = await sql.unsafe(`
    SELECT i.id, i.contact_id, i.person_id, i.type, i.direction, i.subject,
           i.snippet, i.platform, i.occurred_at, i.participant_email,
           p.name as person_name
    FROM v0_archive.interactions i
    LEFT JOIN v0_archive.people p
      ON p.id = COALESCE(i.contact_id, i.person_id)
    ORDER BY i.occurred_at${limitClause()}
  `);
  for (const r of rows) {
    const date = dateOnly(r.occurred_at as string);
    const personName = (r.person_name as string) || (r.participant_email as string) || 'unknown';
    const slugBase = `interaction/${date}-${slugify(r.type as string)}-${id8(r.id as string)}`;
    const title = `${r.type}${r.direction ? ` (${r.direction})` : ''} with ${personName}`;
    const bodyParts: string[] = [];
    if (r.subject) bodyParts.push(`## Subject\n${r.subject}`);
    if (r.snippet) bodyParts.push(`## Snippet\n${r.snippet}`);
    bodyParts.push(`## Platform\n${r.platform || 'unknown'}`);

    writeMd('interaction', slugBase, {
      title,
      type: 'interaction',
      tags: [r.type as string, r.platform as string, r.direction as string].filter(Boolean),
      v0_id: r.id,
      v0_table: 'interactions',
      v0_contact_id: r.contact_id,
      v0_person_id: r.person_id,
      v0_type: r.type,
      v0_platform: r.platform,
      v0_direction: r.direction,
      v0_occurred_at: r.occurred_at,
      v0_participant_email: r.participant_email,
    }, bodyParts.join('\n\n'));
  }
  console.log(`  ${rows.length} interactions written`);
}

// ─────────────────────────────────────── main

async function main() {
  console.log(`Exporting v0_archive → ${OUT}${LIMIT ? ` (limit=${LIMIT} per table)` : ''}`);
  mkdirSync(OUT, { recursive: true });

  // Order: small/structural first (people/projects/topics) so we can spot-check
  // before running thoughts (the big batch).
  await migratePeople();
  await migrateOrphanPeople();
  await migrateTopics();
  await migrateProjects();
  await migrateMeetings();
  await migrateLearnings();
  await migrateDecisions();
  await migrateFollowUps();
  await migrateFeatureRequests();
  await migrateIdeas();
  await migrateInteractions();
  await migrateThoughts();  // last, biggest

  await sql.end();
  console.log(`\n✓ Wrote ${written} markdown files to ${OUT}`);
}

main().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
