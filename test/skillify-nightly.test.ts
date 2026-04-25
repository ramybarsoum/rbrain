import { describe, test, expect } from "bun:test";
import { join } from "path";
import { existsSync } from "fs";
import { runNightlyCheck, type NightlyReport } from "../scripts/skillify-nightly.ts";

const SKILLS_DIR = join(import.meta.dir, "..", "skills");

describe("skillify-nightly", () => {
  test("runNightlyCheck returns structured report against repo skills dir", () => {
    // Skip if no skills dir (e.g., bare checkout)
    if (!existsSync(SKILLS_DIR)) return;

    const report: NightlyReport = runNightlyCheck(SKILLS_DIR);

    // Verify top-level structure
    expect(typeof report.timestamp).toBe("string");
    expect(report.timestamp.length).toBeGreaterThan(0);
    expect(report.skills_dir).toBe(SKILLS_DIR);
    expect(typeof report.ok).toBe("boolean");

    // Verify nested resolvable report
    expect(typeof report.resolvable.ok).toBe("boolean");
    expect(Array.isArray(report.resolvable.issues)).toBe(true);
    expect(typeof report.resolvable.summary).toBe("object");
    expect(typeof report.resolvable.summary.total_skills).toBe("number");
    expect(typeof report.resolvable.summary.reachable).toBe("number");
    expect(typeof report.resolvable.summary.unreachable).toBe("number");
    expect(typeof report.resolvable.summary.overlaps).toBe("number");
    expect(typeof report.resolvable.summary.gaps).toBe("number");

    // Verify issue_counts
    expect(typeof report.issue_counts).toBe("object");
    expect(typeof report.issue_counts.errors).toBe("number");
    expect(typeof report.issue_counts.warnings).toBe("number");
    expect(typeof report.issue_counts.by_type).toBe("object");

    // Verify recent_skills is an array
    expect(Array.isArray(report.recent_skills)).toBe(true);

    // Consistency: ok flag matches error count
    const hasErrors = report.issue_counts.errors > 0;
    expect(report.ok).toBe(!hasErrors);
  });

  test("runNightlyCheck counts issue types correctly", () => {
    if (!existsSync(SKILLS_DIR)) return;

    const report = runNightlyCheck(SKILLS_DIR);

    // Sum of by_type values should equal total issues
    const typeSum = Object.values(report.issue_counts.by_type).reduce(
      (a, b) => a + b,
      0,
    );
    expect(typeSum).toBe(report.resolvable.issues.length);

    // errors + warnings should also equal total
    expect(report.issue_counts.errors + report.issue_counts.warnings).toBe(
      report.resolvable.issues.length,
    );
  });
});
