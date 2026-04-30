# Book Mirror

Book Mirror is a private reading companion that takes a user-provided book file plus the reader's trusted memory/context and produces a personalized chapter-by-chapter mirror. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]

## Core Promise

Produce a two-column chapter analysis where the left column preserves what the author says in enough detail that the reader can understand the book's stories, frameworks, quotes, and claims, and the right column maps only genuinely relevant ideas to the reader's own life, projects, relationships, dates, and words. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]

This is not generic summarization or coaching. For a stranger, the output is only a book summary; for someone with years of durable memory, it becomes a personalized intellectual mirror. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]

## Pipeline

1. Ingest a PDF or EPUB supplied by the user. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
2. Split the book into chapter text files. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
3. Build a reader context pack from relevant bio, behavioral patterns, recent conversations, relationships, active projects, and emotional landscape. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
4. Generate a per-chapter two-column table: `What the Author Says` and `How This Applies to You`. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
5. Fact-check every personal claim against source material. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
6. Generate a PDF deliverable. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]

## Quality Bar

- Left column: detailed enough that the reader should not need to read the original book for comprehension. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
- Right column: should feel like someone who actually knows the reader read the book first. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
- If a chapter does not apply, say so plainly; never force connections. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]
- Avoid generic advice like "consider reflecting on..."; produce only specific mirrors. [Source: Ramy, Discord #raw-inbox thread, 2026-04-29]

## Product/Implementation Notes

- Library-scale processing should be capped at **5 books/articles per day**; do not work through the full library in one day. [Source: Ramy, Discord Book Mirror thread, 2026-04-30]
- The product lives or dies on context-pack quality, not summarization quality. [Source: synthesis from Ramy, Discord #raw-inbox thread, 2026-04-29]
- The right column needs a strict claim ledger: every named person, date, quote, project, or pattern must trace back to memory/source evidence. [Source: synthesis from Ramy, Discord #raw-inbox thread, 2026-04-29]
- The system should distinguish `known fact`, `supported interpretation`, and `speculative mirror` so it does not launder inference into fact. [Source: synthesis from Ramy, Discord #raw-inbox thread, 2026-04-29]
- Copyright guardrail: use user-provided, licensed, or public-domain text; avoid building a feature that sources copyrighted books without rights. [Source: synthesis from Ramy, Discord #raw-inbox thread, 2026-04-29]

## Related Input

Ramy also shared two related Notion links, but their page bodies were not accessible through unauthenticated fetch in this session:

- `UX vs Decision Tree` [Source: Notion URL shared by Ramy, Discord #raw-inbox thread, 2026-04-29]
- `Software as a Science` [Source: Notion URL shared by Ramy, Discord #raw-inbox thread, 2026-04-29]
