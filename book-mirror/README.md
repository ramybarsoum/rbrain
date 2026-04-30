# Book Mirror Pages

Book Mirror outputs personalize a source book/article against Ramy's durable context. Final mirror pages live in this directory and are safe to sync with the RBrain repo.

## Batch policy

- Process at most **5 books/articles per day** from the Readwise/Notion library.
- Do not try to mirror the full library in a single day.
- Keep coverage labels honest:
  - `full` — full source text/chapter coverage available.
  - `partial` — highlights, summaries, or truncated source coverage.
  - `sparse` — thin metadata/summary only.

## Created pages in this batch

| Slug | Source | Coverage |
|---|---|---|
| `book-mirror/software-as-a-science` | Readwise Library / Software as a Science | partial |
| `book-mirror/zero-to-one` | Readwise Library / Zero to One | partial |
| `book-mirror/traction` | Readwise Library / Traction | partial |
| `book-mirror/the-hard-thing-about-hard-things` | Readwise Library / The Hard Thing About Hard Things | partial |
| `book-mirror/the-one-thing` | Readwise Library / The One Thing | sparse |
| `book-mirror/competing-against-luck` | You Exec Summaries / Competing Against Luck | partial |
| `book-mirror/high-growth-handbook` | You Exec Summaries / High Growth Handbook | partial |
| `book-mirror/crossing-the-chasm` | You Exec Summaries / Crossing the Chasm | partial |
| `book-mirror/good-strategy-bad-strategy` | You Exec Summaries / Good Strategy, Bad Strategy | partial |
| `book-mirror/building-ai-products` | Study Diet / Building AI Products | sparse |

## Local-only artifacts

Do not commit raw book files or NotebookLM generated artifact folders. They may contain copyrighted/private source material, notebook IDs, generated audio, slide decks, or large logs. Use ignored local paths under `drafts/book-mirror/source-files/` and `drafts/book-mirror/notebooklm/`.
