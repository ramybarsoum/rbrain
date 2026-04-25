#!/usr/bin/env bun
/**
 * scripts/migrate-v0-archive-phase3.ts
 *
 * Graph edge wiring pass. Runs AFTER phase 1 (export) + phase 2 (import).
 * Requires all person and meeting pages to already exist in public.pages.
 *
 * What it does:
 *   1. Company stubs  — create companies/<slug> pages from person v0_company fields
 *   2. works_at links — person → company (link_type='works_at')
 *   3. attended links — person → meeting (from v0_archive.meeting_participants)
 *   4. Interaction timeline entries — add timeline entries on person pages
 *                                     (interactions are already pages; this adds the
 *                                      richer timeline-entry representation too)
 *
 * Usage:
 *   bun scripts/migrate-v0-archive-phase3.ts [--dry-run] [--json] [--verbose]
 */

import { createEngine } from '../src/core/engine-factory.ts';
import { importFromContent } from '../src/core/import-file.ts';
import type { LinkBatchInput, TimelineBatchInput } from '../src/core/engine.ts';
import postgres from 'postgres';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const DRY_RUN  = argv.includes('--dry-run');
const JSON_MODE = argv.includes('--json');
const VERBOSE  = argv.includes('--verbose');
const NO_EMBED = argv.includes('--no-embed') || !process.env.OPENAI_API_KEY;

const log  = (msg: string) => { if (!JSON_MODE) process.stderr.write(msg + '\n'); };
const info = (msg: string) => { if (VERBOSE && !JSON_MODE) process.stderr.write(msg + '\n'); };
const out  = (obj: unknown) => process.stdout.write(JSON.stringify(obj) + '\n');

// ─── Slug utils ───────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return (s || '').toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function id8(idLike: string | number | bigint): string {
  return String(idLike).replace(/-/g, '').slice(0, 8) || '00000000';
}

function dateOnly(ts: string | Date | null | undefined): string {
  if (!ts) return 'undated';
  const d = ts instanceof Date ? ts : new Date(ts);
  return isNaN(d.getTime()) ? 'undated' : d.toISOString().slice(0, 10);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS: Record<string, { created: number; skipped: number }> = {};
const init = (k: string) => { STATS[k] = { created: 0, skipped: 0 }; };

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) log('[DRY RUN] No changes will be made.\n');

  const archive = postgres(process.env.DATABASE_URL!);
  const cfg = { engine: 'postgres' as const, database_url: process.env.DATABASE_URL! };
  const engine = await createEngine(cfg);
  await engine.connect(cfg);

  try {
    // ── Step 1: Company stubs ─────────────────────────────────────────────────
    log('── Step 1: Company stubs ──');
    init('companies');

    // Collect unique non-null companies from person pages in public
    const companyRows = await archive`
      SELECT DISTINCT frontmatter->>'v0_company' AS company
      FROM public.pages
      WHERE type = 'person'
        AND frontmatter->>'v0_company' IS NOT NULL
        AND frontmatter->>'v0_company' != ''
      ORDER BY company
    `;

    // Deduplicate by derived slug (e.g. "allcare.ai" and "AllCare.ai" → same slug)
    const seenSlug = new Set<string>();
    const companyNames = companyRows
      .map(r => r.company as string)
      .filter(c => {
        if (!c) return false;
        const s = slugify(c);
        if (seenSlug.has(s)) return false;
        seenSlug.add(s);
        return true;
      });
    log(`  ${companyNames.length} unique companies found`);

    // Check which company pages already exist
    const existingSlugs = new Set<string>();
    if (companyNames.length > 0) {
      const existing = await archive`
        SELECT slug FROM public.pages
        WHERE type = 'company'
      `;
      for (const r of existing) existingSlugs.add(r.slug as string);
    }

    for (const company of companyNames) {
      const slug = `companies/${slugify(company)}`;
      if (existingSlugs.has(slug)) {
        info(`  [skip] ${slug} already exists`);
        STATS['companies'].skipped++;
        continue;
      }

      // Display name: capitalize domain-style names
      const displayName = company
        .replace(/\.(com|ai|io|org|net|co|health|care)$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim() || company;

      const content = [
        `---`,
        `type: "company"`,
        `source: "v0_archive"`,
        `v0_domain: ${JSON.stringify(company)}`,
        `---`,
        ``,
        `# ${displayName}`,
        ``,
        `Company page auto-created from CRM import.`,
      ].join('\n');

      info(`  ${DRY_RUN ? '[DRY] ' : ''}${slug}`);

      if (!DRY_RUN) {
        try {
          await importFromContent(engine, slug, content, { noEmbed: NO_EMBED });
          STATS['companies'].created++;
        } catch (e) {
          log(`  [ERROR] ${slug}: ${e}`);
        }
      } else {
        STATS['companies'].skipped++;
      }
    }
    log(`  Done: ${STATS['companies'].created} created · ${STATS['companies'].skipped} skipped\n`);


    // ── Step 2: works_at links (person → company) ─────────────────────────────
    log('── Step 2: works_at links (person → company) ──');
    init('works_at');

    const personRows = await archive`
      SELECT slug, frontmatter->>'v0_company' AS company
      FROM public.pages
      WHERE type = 'person'
        AND frontmatter->>'v0_company' IS NOT NULL
        AND frontmatter->>'v0_company' != ''
    `;

    const worksAtBatch: LinkBatchInput[] = personRows
      .map(r => ({
        from_slug: r.slug as string,
        to_slug: `companies/${slugify(r.company as string)}`,
        link_type: 'works_at',
        link_source: 'frontmatter',
        origin_slug: r.slug as string,
        origin_field: 'v0_company',
      }));

    log(`  ${worksAtBatch.length} works_at edges to wire`);

    if (!DRY_RUN && worksAtBatch.length > 0) {
      // Batch in groups of 500
      let created = 0;
      for (let i = 0; i < worksAtBatch.length; i += 500) {
        created += await engine.addLinksBatch(worksAtBatch.slice(i, i + 500));
      }
      STATS['works_at'].created = created;
      log(`  Done: ${created} links created\n`);
    } else {
      STATS['works_at'].skipped = worksAtBatch.length;
      log(`  [DRY] Would create ${worksAtBatch.length} links\n`);
    }


    // ── Step 3: attended links (person → meeting) ─────────────────────────────
    log('── Step 3: attended links (person → meeting) ──');
    init('attended');

    // Join meeting_participants with people + meetings to get derivable slugs
    const participantRows = await archive`
      SELECT
        mp.person_id::text,
        mp.is_organizer,
        p.name AS person_name,
        p.id::text AS person_uuid,
        m.id AS meeting_id,
        m.title AS meeting_title,
        m.meeting_at
      FROM v0_archive.meeting_participants mp
      JOIN v0_archive.people p ON p.id = mp.person_id
      JOIN v0_archive.meetings m ON m.id = mp.meeting_id
      WHERE mp.person_id IS NOT NULL
    `;

    log(`  ${participantRows.length} person-meeting participant rows`);

    // Build slug lookup for people: v0_id → public slug
    const peopleSlugMap = new Map<string, string>();
    const allPeople = await archive`
      SELECT slug, frontmatter->>'v0_id' AS v0_id
      FROM public.pages
      WHERE type = 'person' AND frontmatter->>'v0_id' IS NOT NULL
    `;
    for (const r of allPeople) peopleSlugMap.set(r.v0_id as string, r.slug as string);

    // Build slug lookup for meetings: v0_id → public slug
    const meetingSlugMap = new Map<string, string>();
    const allMeetings = await archive`
      SELECT slug, frontmatter->>'v0_id' AS v0_id
      FROM public.pages
      WHERE type = 'meeting' AND frontmatter->>'v0_id' IS NOT NULL
    `;
    for (const r of allMeetings) meetingSlugMap.set(r.v0_id as string, r.slug as string);

    const attendedBatch: LinkBatchInput[] = [];
    for (const row of participantRows) {
      const personSlug  = peopleSlugMap.get(row.person_uuid as string);
      const meetingSlug = meetingSlugMap.get(String(row.meeting_id));
      if (!personSlug || !meetingSlug) {
        info(`  [miss] person=${row.person_uuid} meeting=${row.meeting_id} — slug not found`);
        STATS['attended'].skipped++;
        continue;
      }
      attendedBatch.push({
        from_slug: personSlug,
        to_slug: meetingSlug,
        link_type: row.is_organizer ? 'organized' : 'attended',
        link_source: 'frontmatter',
        context: row.is_organizer ? 'meeting organizer' : 'meeting participant',
      });
    }

    log(`  ${attendedBatch.length} attended edges ready · ${STATS['attended'].skipped} skipped (slug miss)`);

    if (!DRY_RUN && attendedBatch.length > 0) {
      const created = await engine.addLinksBatch(attendedBatch);
      STATS['attended'].created = created;
      log(`  Done: ${created} links created\n`);
    } else {
      STATS['attended'].skipped += attendedBatch.length;
      log(`  [DRY] Would create ${attendedBatch.length} links\n`);
    }


    // ── Step 4: Interaction timeline entries on person pages ──────────────────
    log('── Step 4: Interaction timeline entries on person pages ──');
    init('interactions');

    const interactionPages = await archive`
      SELECT
        p.slug,
        p.frontmatter->>'v0_person_id'   AS person_id,
        p.frontmatter->>'v0_occurred_at' AS occurred_at,
        p.frontmatter->>'v0_type'        AS type,
        p.frontmatter->>'v0_platform'    AS platform,
        p.title
      FROM public.pages p
      WHERE p.type = 'interaction'
        AND p.frontmatter->>'v0_person_id' IS NOT NULL
    `;

    log(`  ${interactionPages.length} interaction pages found`);

    const timelineBatch: TimelineBatchInput[] = [];
    for (const row of interactionPages) {
      const personSlug = peopleSlugMap.get(row.person_id as string);
      if (!personSlug) {
        info(`  [miss] person_id=${row.person_id} — no person page`);
        STATS['interactions'].skipped++;
        continue;
      }
      timelineBatch.push({
        slug: personSlug,
        date: row.occurred_at
          ? new Date(row.occurred_at as string).toISOString().split('T')[0]
          : dateOnly(null),
        source: 'v0_archive.interactions',
        summary: [row.platform, row.type, row.title].filter(Boolean).join(' · '),
      });
    }

    log(`  ${timelineBatch.length} timeline entries ready`);

    if (!DRY_RUN && timelineBatch.length > 0) {
      const created = await engine.addTimelineEntriesBatch(timelineBatch);
      STATS['interactions'].created = created;
      log(`  Done: ${created} timeline entries created\n`);
    } else {
      STATS['interactions'].skipped += timelineBatch.length;
      log(`  [DRY] Would create ${timelineBatch.length} timeline entries\n`);
    }


    // ── Summary ───────────────────────────────────────────────────────────────
    if (JSON_MODE) {
      out({ dry_run: DRY_RUN, stats: STATS });
    } else {
      log('━━━ Phase 3 summary ━━━');
      for (const [step, s] of Object.entries(STATS)) {
        log(`  ${step.padEnd(14)} ${s.created} created · ${s.skipped} skipped`);
      }
      if (DRY_RUN) log('\n(Dry run — no writes performed)');
    }

  } finally {
    await archive.end();
  }
}

main().catch(e => {
  process.stderr.write(`Fatal: ${e}\n`);
  process.exit(1);
});
