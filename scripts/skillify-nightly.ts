#!/usr/bin/env bun
/**
 * skillify-nightly — Nightly health + drift detection.
 *
 * Runs checkResolvable() against the skills directory and reports on
 * unreachable skills, overlapping triggers, gaps, and DRY violations.
 * Optionally audits recently-modified skills with skillify-check.
 *
 * Usage:
 *   bun run scripts/skillify-nightly.ts                # human-readable summary
 *   bun run scripts/skillify-nightly.ts --json          # structured JSON for cron
 *   bun run scripts/skillify-nightly.ts --skills-dir ~/RBrain/skills
 *   bun run scripts/skillify-nightly.ts --with-skillify  # also run skillify-check
 *
 * Exit 0 when healthy (no errors), exit 1 when issues found.
 * Suitable for CI/cron alerting.
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { checkResolvable, type ResolvableReport, type ResolvableIssue } from '../src/core/check-resolvable.js';

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  json: boolean;
  skillsDir: string | null;
  withSkillify: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  return {
    json: argv.includes('--json'),
    skillsDir: extractFlag(argv, '--skills-dir'),
    withSkillify: argv.includes('--with-skillify'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function extractFlag(argv: string[], flag: string): string | null {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

// ---------------------------------------------------------------------------
// Skills dir discovery
// ---------------------------------------------------------------------------

/** Walk up from cwd to find a `skills/` directory. */
function findSkillsDir(explicit: string | null): string | null {
  if (explicit) {
    if (!existsSync(explicit)) {
      console.error(`--skills-dir not found: ${explicit}`);
      return null;
    }
    return resolve(explicit);
  }

  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    const candidate = join(dir, 'skills');
    if (existsSync(candidate) && existsSync(join(candidate, 'RESOLVER.md'))) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Recently-modified skill discovery
// ---------------------------------------------------------------------------

interface SkillMeta {
  name: string;
  path: string;
  modifiedMs: number;
}

function listRecentlyModifiedSkills(skillsDir: string, days: number = 7): SkillMeta[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const results: SkillMeta[] = [];

  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = join(skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      try {
        const st = statSync(skillMd);
        if (st.mtimeMs >= cutoff) {
          results.push({
            name: entry.name,
            path: `${entry.name}/SKILL.md`,
            modifiedMs: st.mtimeMs,
          });
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return results.sort((a, b) => b.modifiedMs - a.modifiedMs);
}

// ---------------------------------------------------------------------------
// Nightly report
// ---------------------------------------------------------------------------

export interface NightlyReport {
  timestamp: string;
  skills_dir: string;
  resolvable: ResolvableReport;
  recent_skills: SkillMeta[];
  issue_counts: {
    errors: number;
    warnings: number;
    by_type: Record<string, number>;
  };
  ok: boolean;
}

export function runNightlyCheck(skillsDir: string): NightlyReport {
  const resolvable = checkResolvable(skillsDir);
  const recentSkills = listRecentlyModifiedSkills(skillsDir, 7);

  // Count issues by severity and type
  const errors = resolvable.issues.filter(i => i.severity === 'error').length;
  const warnings = resolvable.issues.filter(i => i.severity === 'warning').length;
  const byType: Record<string, number> = {};
  for (const issue of resolvable.issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }

  return {
    timestamp: new Date().toISOString(),
    skills_dir: skillsDir,
    resolvable,
    recent_skills: recentSkills,
    issue_counts: { errors, warnings, by_type: byType },
    ok: resolvable.ok,
  };
}

// ---------------------------------------------------------------------------
// Human-readable formatting
// ---------------------------------------------------------------------------

function formatSummary(report: NightlyReport): string {
  const lines: string[] = [];
  const { resolvable, issue_counts, recent_skills } = report;
  const s = resolvable.summary;

  lines.push('═══ Skillify Nightly Health Report ═══');
  lines.push(`  Timestamp : ${report.timestamp}`);
  lines.push(`  Skills dir: ${report.skills_dir}`);
  lines.push('');

  lines.push('── Summary ──');
  lines.push(`  Total skills  : ${s.total_skills}`);
  lines.push(`  Reachable     : ${s.reachable}`);
  lines.push(`  Unreachable   : ${s.unreachable}`);
  lines.push(`  Overlaps      : ${s.overlaps}`);
  lines.push(`  Gaps          : ${s.gaps}`);
  lines.push(`  Errors        : ${issue_counts.errors}`);
  lines.push(`  Warnings      : ${issue_counts.warnings}`);
  lines.push('');

  if (resolvable.issues.length > 0) {
    lines.push('── Issues ──');
    for (const issue of resolvable.issues) {
      const icon = issue.severity === 'error' ? '✗' : '⚠';
      lines.push(`  ${icon} [${issue.type}] ${issue.skill}`);
      lines.push(`     ${issue.message}`);
      lines.push(`     → ${issue.action}`);
    }
    lines.push('');
  }

  if (recent_skills.length > 0) {
    lines.push(`── Recently Modified (${recent_skills.length} in last 7 days) ──`);
    for (const skill of recent_skills) {
      const ago = Math.round((Date.now() - skill.modifiedMs) / (60 * 60 * 1000));
      const unit = ago >= 24 ? `${Math.round(ago / 24)}d` : `${ago}h`;
      lines.push(`  • ${skill.name} (${unit} ago)`);
    }
    lines.push('');
  }

  lines.push(report.ok
    ? '✓ All skills healthy — no errors.'
    : `✗ ${issue_counts.errors} error(s) found — see above.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`skillify-nightly — Nightly health + drift detection for gbrain skills.

Usage:
  bun run scripts/skillify-nightly.ts [--json] [--skills-dir DIR] [--with-skillify]

Flags:
  --json             Emit structured JSON (for cron consumption)
  --skills-dir DIR   Explicit path to the skills/ directory
  --with-skillify    Also run skillify-check on recently-modified skills
  -h, --help         Show this help

Exit codes:
  0 — healthy (no errors)
  1 — issues found
`);
    process.exit(0);
  }

  const skillsDir = findSkillsDir(args.skillsDir);
  if (!skillsDir) {
    console.error('Could not find skills/ directory. Use --skills-dir to specify explicitly.');
    process.exit(1);
  }

  const report = runNightlyCheck(skillsDir);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatSummary(report));
  }

  process.exit(report.ok ? 0 : 1);
}

main();
