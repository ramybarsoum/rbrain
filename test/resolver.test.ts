import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parseResolverEntries } from "../src/core/check-resolvable";

const SKILLS_DIR = join(import.meta.dir, "..", "skills");
const RESOLVER_MD = join(SKILLS_DIR, "RESOLVER.md");

describe("resolver routing", () => {
  const content = readFileSync(RESOLVER_MD, "utf-8");
  const entries = parseResolverEntries(content);

  test("RESOLVER.md parses without errors", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  test("every skill path in resolver points to existing SKILL.md", () => {
    for (const entry of entries) {
      if (entry.isGStack) continue; // GStack entries are external
      const skillPath = join(SKILLS_DIR, "..", entry.skillPath);
      expect(
        existsSync(skillPath),
        `Resolver entry "${entry.trigger}" points to missing ${entry.skillPath}`
      ).toBe(true);
    }
  });

  test("critical skills are reachable from resolver", () => {
    const skillPaths = entries.map(e => e.skillPath);
    const critical = ["query", "enrich", "brain-ops", "skillify", "idea-ingest"];
    for (const name of critical) {
      expect(
        skillPaths.some(p => p.includes(name)),
        `Critical skill "${name}" not found in resolver`
      ).toBe(true);
    }
  });

  test("no skill path appears excessively in resolver", () => {
    // Multiple triggers pointing to the same skill is fine (e.g., maintain has 4 rows),
    // but more than 5 rows for the same skill likely indicates accidental duplication.
    const paths = entries.filter(e => !e.isGStack).map(e => e.skillPath);
    const counts = new Map<string, number>();
    for (const p of paths) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const excessive = [...counts.entries()].filter(([, c]) => c > 5);
    expect(
      excessive,
      `Skills with >5 resolver rows (likely accidental duplication): ${excessive.map(([p, c]) => `${p} (${c}x)`).join(", ")}`
    ).toEqual([]);
  });

  test("no duplicate triggers in resolver", () => {
    const triggers = entries.map(e => e.trigger.toLowerCase().trim());
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const t of triggers) {
      if (seen.has(t)) dupes.push(t);
      seen.add(t);
    }
    expect(dupes, `Duplicate triggers found: ${dupes.join(", ")}`).toEqual([]);
  });

  test("every resolver entry has a section", () => {
    for (const entry of entries) {
      expect(
        entry.section.length > 0,
        `Entry "${entry.trigger}" has no section assignment`
      ).toBe(true);
    }
  });
});
