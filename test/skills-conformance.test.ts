import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { parseResolverEntries } from "../src/core/check-resolvable";

const SKILLS_DIR = join(import.meta.dir, "..", "skills");
const MANIFEST_PATH = join(SKILLS_DIR, "manifest.json");

/** Simple YAML frontmatter parser — extracts fields between --- delimiters */
function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yaml = match[1];
  const result: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key && !key.startsWith(" ") && !key.startsWith("-")) {
        result[key] = value;
      }
    }
  }
  return result;
}

/** Get all skill directories (those containing SKILL.md) */
function getSkillDirs(): string[] {
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .filter((e) => existsSync(join(SKILLS_DIR, e.name, "SKILL.md")))
    .map((e) => e.name)
    .filter((name) => name !== "install"); // deprecated skill
}

describe("skills conformance", () => {
  const skillDirs = getSkillDirs();

  test("manifest.json exists and is valid JSON", () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    expect(manifest.skills).toBeDefined();
    expect(Array.isArray(manifest.skills)).toBe(true);
  });

  test("manifest lists every skill directory", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    const manifestNames = manifest.skills.map((s: { name: string }) => s.name);
    for (const dir of skillDirs) {
      expect(manifestNames).toContain(dir);
    }
  });

  test("every manifest entry points to an existing SKILL.md", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    for (const skill of manifest.skills) {
      const skillPath = join(SKILLS_DIR, skill.path);
      expect(existsSync(skillPath)).toBe(true);
    }
  });

  for (const dir of skillDirs) {
    describe(`skills/${dir}/SKILL.md`, () => {
      const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");

      test("has YAML frontmatter", () => {
        expect(content.startsWith("---\n")).toBe(true);
        const fm = parseFrontmatter(content);
        expect(fm).not.toBeNull();
      });

      test("frontmatter has required fields (name, description)", () => {
        const fm = parseFrontmatter(content);
        expect(fm).not.toBeNull();
        expect(fm!.name).toBeDefined();
        expect(fm!.description).toBeDefined();
      });

      test("has a Contract section", () => {
        expect(content).toContain("## Contract");
      });

      test("has an Anti-Patterns section", () => {
        expect(content).toContain("## Anti-Patterns");
      });

      test("has an Output Format section", () => {
        expect(content).toContain("## Output Format");
      });
    });
  }

  test("no duplicate skill names in frontmatter", () => {
    const names: string[] = [];
    for (const dir of skillDirs) {
      const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
      const fm = parseFrontmatter(content);
      if (fm?.name) {
        const name = String(fm.name);
        expect(names).not.toContain(name);
        names.push(name);
      }
    }
  });

  test("every resolver skill entry has a corresponding manifest entry", () => {
    const RESOLVER_PATH = join(SKILLS_DIR, "RESOLVER.md");
    if (!existsSync(RESOLVER_PATH)) return;
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    const manifestNames = new Set(manifest.skills.map((s: { name: string }) => s.name));
    const resolverContent = readFileSync(RESOLVER_PATH, "utf-8");
    const entries = parseResolverEntries(resolverContent);
    for (const entry of entries) {
      if (entry.isGStack) continue;
      const skillName = entry.skillPath.replace(/^skills\//, "").replace(/\/SKILL\.md$/, "");
      expect(
        manifestNames.has(skillName),
        `Resolver references "${skillName}" but it's not in manifest.json`
      ).toBe(true);
    }
  });

  test("every manifest entry is reachable from RESOLVER.md", () => {
    const RESOLVER_PATH = join(SKILLS_DIR, "RESOLVER.md");
    if (!existsSync(RESOLVER_PATH)) return;
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    const resolverContent = readFileSync(RESOLVER_PATH, "utf-8");
    const entries = parseResolverEntries(resolverContent);
    const resolverSkillPaths = new Set(entries.filter(e => !e.isGStack).map(e => e.skillPath));
    const resolverTriggers = entries.map(e => e.trigger.toLowerCase());

    for (const skill of manifest.skills) {
      const expectedPath = `skills/${skill.path}`;
      const inPath = resolverSkillPaths.has(expectedPath);
      const nameInTrigger = resolverTriggers.some(t => t.includes(skill.name));
      // Either the skill path is in the resolver or its name appears in a trigger
      expect(
        inPath || nameInTrigger,
        `Manifest skill "${skill.name}" has no trigger row in RESOLVER.md`
      ).toBe(true);
    }
  });

  test("skills with frontmatter triggers field have at least one trigger", () => {
    for (const dir of skillDirs) {
      const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
      // Extract raw frontmatter section
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];
      // Check if triggers: key exists in frontmatter
      if (!/^triggers:/m.test(fm)) continue;
      // If triggers key exists, verify there's at least one array entry (line starting with "  - ")
      const linesAfterTriggers = fm.split("\n");
      let foundTriggers = false;
      let hasEntries = false;
      for (const line of linesAfterTriggers) {
        if (/^triggers:/.test(line)) {
          foundTriggers = true;
          continue;
        }
        if (foundTriggers) {
          if (/^\s+-\s+/.test(line)) {
            hasEntries = true;
            break;
          }
          // If we hit another key, stop looking
          if (/^[a-zA-Z]/.test(line)) break;
        }
      }
      expect(
        hasEntries,
        `skills/${dir}/SKILL.md has a triggers field but no array entries`
      ).toBe(true);
    }
  });
});
