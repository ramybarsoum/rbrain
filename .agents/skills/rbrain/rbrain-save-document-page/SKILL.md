---
name: rbrain-save-document-page
description: Save a provided markdown/text document into RBrain as a verified page with provenance, using the local gbrain CLI and Ramy’s brain conventions.
---

# RBrain Save Document Page

Use when Ramy asks to save a final doc, PRD, memo, or design document into RBrain.

## When to use
- User provides a full document and wants it saved in RBrain
- You need a durable project/concept page that preserves the final text
- You want to attach the original source file for provenance

## Contract
- Read `~/RBrain/SOUL.md`, `~/RBrain/RESOLVER.md`, and `~/RBrain/skills/RESOLVER.md` first
- Choose the slug by filing rules (`projects/`, `concepts/`, etc.) based on the primary subject
- Preserve source fidelity unless the user explicitly asks for a rewrite
- Add inline `[Source: ...]` citations for any synthesized framing you add around the raw document
- Verify the page was actually written by reading it back

## Workflow
1. **Load brain context first.** Read `SOUL.md`, top-level `RESOLVER.md`, `skills/RESOLVER.md`, and filing rules if needed.
2. **Check for an existing related page.** Use `gbrain search` / `gbrain query` for the topic so the new page can relate to prior notes instead of duplicating blindly.
3. **Prepare clean page content.** Add frontmatter (`type`, `title`, `date`, `status`, `tags`, `related`, etc.) plus a short note explaining whether this is the canonical final version or an expansion of an older page.
4. **Use the local CLI with env sourced.** In this environment, run commands as:
   ```bash
   set -a; source ~/RBrain/.env; set +a
   cd ~/RBrain
   bun src/cli.ts put <slug> --content '<full markdown>'
   ```
   This avoids auth/config drift when `~/.gbrain/config.json` is stale or incomplete.
5. **Verify immediately.** Run:
   ```bash
   bun src/cli.ts get <slug>
   ```
   Confirm the saved content is actually there.
6. **Attach the original file for provenance.** Prefer:
   ```bash
   bun src/cli.ts files upload <local-file> --page <slug>
   ```
   In this setup, `files upload-raw` may report success for small local/git storage but not show up as a page attachment in the expected page-file workflow.
7. **Be aware of the file-list quirk.** `bun src/cli.ts files list <slug>` can print the file count and then crash with:
   `Invalid mix of BigInt and other type in division.`
   Treat that as a known listing bug, not proof the upload failed. If needed, rely on the upload success message itself.

## Output Format
Report:
- the final page slug
- whether the page write was verified with `get`
- whether the original file was attached
- any known RBrain CLI quirks encountered

## Anti-Patterns
- Writing the page without reading RBrain filing/context first
- Saving a rewritten interpretation when the user asked to save the final version verbatim
- Using `~/.gbrain/config.json` alone after seeing auth failures
- Assuming `files upload-raw` is enough for a page attachment in this environment
- Treating the `files list` BigInt crash as definitive upload failure
