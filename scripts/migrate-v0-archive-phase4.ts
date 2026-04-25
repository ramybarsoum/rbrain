#!/usr/bin/env bun
/**
 * scripts/migrate-v0-archive-phase4.ts
 *
 * Bidirectional edge pass. Adds reverse links so graph traversal works in both
 * directions without --direction in:
 *   employs     company → person   (reverse of works_at)
 *   had_attendee meeting → person  (reverse of attended + organized)
 *
 * Reads existing edges from public.links, emits mirrors via addLinksBatch.
 * Safe to re-run — addLinksBatch uses ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   bun scripts/migrate-v0-archive-phase4.ts [--dry-run] [--json]
 */

import { createEngine } from '../src/core/engine-factory.ts';
import type { LinkBatchInput } from '../src/core/engine.ts';
import postgres from 'postgres';

const argv = process.argv.slice(2);
const DRY_RUN   = argv.includes('--dry-run');
const JSON_MODE = argv.includes('--json');

const log = (msg: string) => { if (!JSON_MODE) process.stderr.write(msg + '\n'); };
const out = (obj: unknown) => process.stdout.write(JSON.stringify(obj) + '\n');

async function main() {
  if (DRY_RUN) log('[DRY RUN] No changes will be made.\n');

  const DB_URL = process.env.RBRAIN_DATABASE_URL || process.env.DATABASE_URL;
  if (!DB_URL) {
    process.stderr.write('FAIL: RBRAIN_DATABASE_URL not set\n');
    process.exit(1);
  }

  const db  = postgres(DB_URL, { prepare: false, max: 5 });
  const cfg = { engine: 'postgres' as const, database_url: DB_URL };
  const engine = await createEngine(cfg);
  await engine.connect(cfg);

  let employesCreated    = 0;
  let hadAttendeeCreated = 0;

  try {
    // ── employs: reverse of works_at ──────────────────────────────────────────
    log('── employs edges (company → person, reverse of works_at) ──');

    const worksAtRows = await db`
      SELECT pf.slug AS person_slug, pt.slug AS company_slug
      FROM public.links l
      JOIN public.pages pf ON pf.id = l.from_page_id
      JOIN public.pages pt ON pt.id = l.to_page_id
      WHERE l.link_type = 'works_at'
    `;
    log(`  ${worksAtRows.length} works_at links found`);

    const employsBatch: LinkBatchInput[] = worksAtRows.map(r => ({
      from_slug:   r.company_slug as string,
      to_slug:     r.person_slug  as string,
      link_type:   'employs',
      link_source: 'manual',
      context:     'reverse of works_at',
    }));

    if (!DRY_RUN && employsBatch.length > 0) {
      for (let i = 0; i < employsBatch.length; i += 500) {
        employesCreated += await engine.addLinksBatch(employsBatch.slice(i, i + 500));
      }
      log(`  Done: ${employesCreated} employs links created\n`);
    } else {
      log(`  [DRY] Would create ${employsBatch.length} employs links\n`);
    }

    // ── had_attendee: reverse of attended + organized ─────────────────────────
    log('── had_attendee edges (meeting → person, reverse of attended/organized) ──');

    const attendedRows = await db`
      SELECT pf.slug AS person_slug, pt.slug AS meeting_slug
      FROM public.links l
      JOIN public.pages pf ON pf.id = l.from_page_id
      JOIN public.pages pt ON pt.id = l.to_page_id
      WHERE l.link_type IN ('attended', 'organized')
    `;
    log(`  ${attendedRows.length} attended/organized links found`);

    const hadAttendeeBatch: LinkBatchInput[] = attendedRows.map(r => ({
      from_slug:   r.meeting_slug as string,
      to_slug:     r.person_slug  as string,
      link_type:   'had_attendee',
      link_source: 'manual',
      context:     'reverse of attended/organized',
    }));

    if (!DRY_RUN && hadAttendeeBatch.length > 0) {
      for (let i = 0; i < hadAttendeeBatch.length; i += 500) {
        hadAttendeeCreated += await engine.addLinksBatch(hadAttendeeBatch.slice(i, i + 500));
      }
      log(`  Done: ${hadAttendeeCreated} had_attendee links created\n`);
    } else {
      log(`  [DRY] Would create ${hadAttendeeBatch.length} had_attendee links\n`);
    }

    // ── summary ───────────────────────────────────────────────────────────────
    if (JSON_MODE) {
      out({
        dry_run: DRY_RUN,
        employs:      { created: employesCreated,    input: worksAtRows.length },
        had_attendee: { created: hadAttendeeCreated, input: attendedRows.length },
      });
    } else {
      log('━━━ Phase 4 summary ━━━');
      log(`  employs      ${employesCreated} created  (from ${worksAtRows.length} works_at edges)`);
      log(`  had_attendee ${hadAttendeeCreated} created  (from ${attendedRows.length} attended/organized edges)`);
      if (DRY_RUN) log('\n(Dry run — no writes performed)');
    }

  } finally {
    await db.end();
  }
}

main().catch(e => {
  process.stderr.write(`Fatal: ${e}\n`);
  process.exit(1);
});
