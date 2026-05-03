# How to Stop Wasting Claude Code Tokens

Team,

A few of you have mentioned that Opus feels “dumber” lately and that you are hitting rate limits more than once a week.

My view: most of the time, the model is not getting worse. We are accidentally making the job harder by feeding it too much irrelevant context, keeping sessions alive too long, letting noisy files into scope, and asking it to reason over the same mess again and again.

Claude Code is very powerful, but it is not magic. It has a context budget. Every token we spend on old chat history, huge files, hooks, logs, screenshots, repeated tool output, and vague prompts is a token it cannot spend on understanding the actual problem.

This guide is how I want us to use Claude Code going forward.

---

## The Core Rule

**Do not make Claude discover the task from noise. Give it the task, the relevant files, the constraints, and the definition of done.**

Bad workflow:

> “Look through the repo and fix this.”

Good workflow:

> “The bug is in patient identity matching. Look at these 3 files. The current exact-match behavior fails when DOB/name formatting differs. Implement fuzzy matching only inside this service. Do not change the database schema. Add/adjust tests. Definition of done: existing tests pass and the new cases pass.”

The second prompt uses fewer tokens overall because Claude does not need to explore half the codebase to figure out what we meant.

---

# The 9 Token-Wasting Patterns to Avoid

## 1. Huge `CLAUDE.md` / instruction files

Every session pays for project instructions before you type anything. If `CLAUDE.md`, `AGENTS.md`, or other auto-loaded context files are huge, you are spending tokens before work starts.

### What to do

Keep global instructions short and durable:

- Architecture overview
- Commands to run tests/builds
- Critical safety rules
- Directory map
- Coding conventions that apply everywhere

Move detailed playbooks into separate files and reference them only when needed.

### Bad

```md
CLAUDE.md contains every product decision, every historical explanation, every edge case, every meeting note, and every old debugging story.
```

### Good

```md
CLAUDE.md contains the minimum operating guide.
For identity matching details, read docs/identity-matching.md only when working on identity matching.
```

---

## 2. Long-running chats that should have been restarted

Old chat history is expensive. Claude keeps paying attention to decisions, mistakes, logs, and dead paths from earlier in the conversation.

The longer the session, the more likely it becomes that Claude is reasoning through stale context.

### What to do

Start a fresh Claude Code session when:

- You switch tasks
- The first approach was wrong
- The session has lots of logs or failed attempts
- You are about to implement after a long planning/debugging discussion
- Claude starts repeating itself or missing obvious details

Before restarting, ask for a compact handoff:

```txt
Summarize the current state in 10 bullets:
- Goal
- Relevant files
- What we tried
- What worked
- What failed
- Current hypothesis
- Exact next step
- Commands/tests to run
- Constraints
- Open questions
```

Paste that summary into a new session and continue.

---

## 3. Letting Claude read the whole repo by default

“Explore the repo” is one of the most expensive phrases you can use.

Claude will spend tokens reading files that may not matter. Worse, it may anchor on irrelevant implementation details.

### What to do

Point Claude to the likely area first.

### Bad

```txt
Find why the Concierge matching is wrong.
```

### Good

```txt
The issue is likely in:
- src/concierge/identity/*
- src/concierge/patientMatchingService.ts
- tests/concierge/identityMatching.test.ts

Do not inspect unrelated modules unless these files prove insufficient.
```

If you are not sure where the issue is, ask for a bounded search:

```txt
Search for the matching entry point first. Do not read full files yet. Return only the top 5 likely files and why each matters.
```

---

## 4. Dumping huge logs, stack traces, or JSON payloads

Raw logs are token poison. Most of a log is repeated timestamps, IDs, middleware noise, dependency output, and unrelated warnings.

### What to do

Before pasting logs, reduce them.

Include only:

- The command that failed
- The exact error
- 20-40 lines around the failure
- The expected behavior
- The actual behavior
- Any relevant request/response shape with fake or redacted data

### Bad

```txt
Here is the full 8,000-line CI log.
```

### Good

```txt
Command:
bun test tests/concierge/identityMatching.test.ts

Failure:
Expected patient match confidence >= 0.85, received 0.62

Relevant stack:
[paste 20-40 lines]

Context:
This started after changing normalization logic in patientNameNormalizer.ts.
```

For healthcare work: never paste PHI. Use fake names, fake DOBs, fake IDs, or opaque IDs.

---

## 5. Asking vague questions that force Claude to infer intent

Vague prompts create expensive exploration. Claude spends tokens guessing what you want, then you spend more tokens correcting it.

### Use this prompt shape

```txt
Objective:
[What needs to be true when this is done]

Scope:
[Files/modules it may touch]

Out of scope:
[What it must not change]

Context:
[Why this matters / what changed]

Definition of done:
[Tests, behavior, output, acceptance criteria]

Constraints:
[No schema change, no PHI, preserve API, keep tenant isolation, etc.]

First step:
[Ask it to inspect, plan, implement, review, or test]
```

### Example

```txt
Objective:
Improve patient matching so minor spelling differences do not cause duplicate Concierge records.

Scope:
- src/concierge/identity/
- tests/concierge/identityMatching.test.ts

Out of scope:
- No database schema changes
- No changes to facility sharing policy
- No UI changes

Context:
Exact name matching is failing when facility data has spacing, middle initials, or punctuation differences.

Definition of done:
- Add tests for punctuation, middle initial, and transposed first/last names
- Existing identity tests pass
- Matching remains facility-scoped

Constraints:
- No PHI in tests
- Use fake patient IDs only
- Audit-relevant behavior must stay traceable

First step:
Inspect the current matching flow and propose the smallest safe implementation plan before editing.
```

---

## 6. Making Claude repeatedly re-read files after every small change

If Claude edits, then re-reads the same large files again and again, you burn context quickly.

### What to do

Ask for targeted reads and diffs.

Useful instructions:

```txt
Read only the function you need, not the whole file.
```

```txt
After editing, show only the diff and the tests you ran.
```

```txt
Do not re-open unchanged files unless a test failure points back to them.
```

```txt
If you need more context, ask for the specific symbol/file instead of scanning broadly.
```

---

## 7. Too many hooks, auto-context, and background tool outputs

Hooks and automated context can be useful, but they are not free. If every prompt triggers extra scripts, status dumps, linters, git output, dependency checks, or environment summaries, you may be spending tokens on information Claude did not need.

### What to do

Audit your Claude Code setup:

- What hooks run automatically?
- Do they print long output?
- Are they useful for every task?
- Could they be shortened?
- Could they run only on demand?

Keep auto-output short. Prefer summaries over full dumps.

### Bad

Every message prints:

- Full git status
- Full dependency tree
- Full environment variables
- Full recent logs
- Full test output

### Good

Every message prints only:

- Current branch
- Dirty files count
- Critical warnings only

Detailed output should be requested when needed.

---

## 8. Using screenshots/images when text would be cheaper

Images consume a lot of context. Screenshots are useful for UI review, but wasteful for simple errors, copy, API responses, or logs.

### What to do

Use text when the issue is textual.

Use screenshots only when layout, visual hierarchy, spacing, or visual state matters.

### Bad

Sending a screenshot of an error toast when you can copy the error text.

### Good

```txt
Toast says: “Unable to save patient note. Facility context missing.”
This appears after clicking Save from the patient profile page.
```

Use screenshots for:

- Broken layout
- Visual regressions
- Incorrect UI state
- Component alignment
- Design review

Do not use screenshots for:

- Stack traces
- JSON
- Console errors
- SQL output
- API responses

---

## 9. Treating one Claude session as planner, implementer, reviewer, and debugger forever

Claude performs better when the task mode is clear.

A planning session full of debate is not always the best session for implementation. A debugging session full of logs is not always the best session for final code cleanup.

### What to do

Split work into modes:

1. **Investigation** — find the issue, identify files, summarize evidence
2. **Planning** — propose a small implementation plan
3. **Implementation** — make the change with limited scope
4. **Verification** — run tests, inspect diff, check risks
5. **Review** — look for regressions, security/privacy issues, tenant isolation problems

For larger tasks, restart between modes with a compact handoff.

Example:

```txt
We are done investigating. Create a handoff for a fresh implementation session. Include only the final diagnosis, target files, implementation plan, constraints, and tests.
```


---

## 10. Using the strongest model as the executor for everything

Not every Claude Code token has the same job. A lot of token waste happens when we use the most expensive, highest-reasoning model for long edit/test/debug loops that a faster executor model can handle.

The stronger model should usually be used for judgment, not typing.

Use Opus / plan mode / advisor-style workflows for:

- Architecture decisions
- Risky implementation plans
- Large refactors
- API design
- Database or schema-sensitive work
- Tenant/facility isolation questions
- Audit logging and compliance-sensitive review
- Debugging where the root cause is genuinely unclear
- Final review before merging risky work

Use the normal executor model for:

- Reading targeted files
- Making straightforward edits
- Running tests
- Fixing lint/type errors
- Applying small plan-approved changes
- Repeating edit/test loops

### Bad

```txt
Use Opus for the entire session: explore the repo, read files, make edits, run tests, fix formatting, rerun tests, and keep looping until done.
```

That burns premium reasoning on mechanical work.

### Good

```txt
First, use plan/advisor mode to review the task:
- confirm the likely files
- identify risks
- propose the smallest safe plan
- define verification

Then use the normal executor to implement that plan.
Call the stronger model again only if the plan breaks, the risk changes, or final review needs deeper judgment.
```

For healthcare work, this matters even more. Use the strongest model before risky edits so it can catch bad assumptions early, especially around patient identity, facility boundaries, sharing policy, audit logging, and HIPAA-sensitive workflows.

The goal is not to avoid strong models. The goal is to use them where they create leverage.

---

# Practical Team Rules

## Rule 1: Start with a brief, not a vibe

Before asking Claude to code, write the brief.

Minimum brief:

```txt
Goal:

Relevant files:

Constraints:

Definition of done:

Tests to run:
```

If you cannot fill those in, ask Claude to help you create the brief first. Do not jump straight into implementation.

---

## Rule 2: Keep the working set small

Claude should usually work with 3-8 files, not 80.

If it needs more than that, pause and ask:

```txt
Before reading more files, explain exactly what information is missing and which file is most likely to contain it.
```

---

## Rule 3: Use `/clear` or a new session aggressively

Use a new session when the context gets messy.

Signs the context is messy:

- Claude is repeating old assumptions
- It references files that are no longer relevant
- It keeps trying the same failed fix
- It misses a constraint you already gave it
- The conversation contains large logs or multiple dead ends
- You changed the task halfway through

Restarting is not losing progress. Restarting is how you stop paying for stale context.

---

## Rule 4: Ask for plans before edits on risky work

For healthcare, identity, permissions, sharing policy, audit logging, or multi-tenant behavior, do not let Claude immediately edit.

Use:

```txt
Do not edit yet. First explain:
1. What you think the bug is
2. Which files matter
3. The smallest safe change
4. What could break
5. How you will verify tenant isolation / audit behavior / patient safety impact
```

Then approve the plan or correct it.


---

## Rule 5: Use Opus/plan mode for judgment, not typing

For large or risky work, split the job:

1. **Plan with the strongest model** — clarify approach, constraints, risks, files, and verification.
2. **Execute with the normal coding model** — make the edits, run tests, and fix routine failures.
3. **Review with the stronger model when needed** — especially for tenant isolation, audit logging, identity matching, or compliance-sensitive changes.

Do not spend premium model tokens on long mechanical loops unless every step genuinely requires deeper reasoning.

---

## Rule 6: Make Claude prove the work

Do not accept “done” without verification.

Ask for:

```txt
Show:
- Files changed
- Summary of behavior changed
- Tests run
- Test result
- Any tests not run and why
- Risks or follow-ups
```

If it cannot run tests, it must say why.

---

# Copy/Paste Prompt Templates

## Template 1: Bug Fix

```txt
Objective:
Fix [bug] in [feature/module].

Expected behavior:
[What should happen]

Actual behavior:
[What happens now]

Relevant files:
- [file 1]
- [file 2]
- [test file]

Constraints:
- Keep the change small
- Do not change public APIs unless necessary
- Do not change database schema
- Preserve tenant/facility isolation
- Do not use PHI in tests

Definition of done:
- Add or update tests for the bug
- Existing relevant tests pass
- Explain the root cause and the fix

First step:
Inspect the relevant files and propose a plan before editing.
```

---

## Template 2: Feature Implementation

```txt
Objective:
Implement [feature] so that [user outcome].

User workflow:
[Who uses this and what they are trying to do]

Scope:
- [module/file]
- [module/file]

Out of scope:
- [things not to touch]

Acceptance criteria:
1. [criterion]
2. [criterion]
3. [criterion]

Constraints:
- No PHI in examples/tests
- Preserve audit logging
- Preserve facility boundaries
- Keep UX simple enough that staff can explain it in one sentence

Definition of done:
- Implementation complete
- Tests added/updated
- Relevant tests pass
- Short summary of risks and follow-ups

First step:
Ask any blocking questions. If none, propose the smallest implementation plan.
```

---

## Template 3: Code Review

```txt
Review this change for:
1. Correctness
2. Regressions
3. Tenant/facility isolation
4. Audit logging impact
5. Patient safety or HIPAA concerns
6. Over-engineering
7. Missing tests

Do not rewrite the code yet.
Return:
- Must fix
- Should fix
- Nice to have
- Questions
- Recommended next action
```

---

## Template 4: Session Handoff

```txt
Create a compact handoff for a fresh Claude Code session.

Include only:
- Goal
- Final diagnosis/current state
- Relevant files
- Important constraints
- Decisions already made
- Failed approaches to avoid
- Next implementation step
- Tests to run

Keep it under 500 words.
```

---

# Thin Harness, Thick Skills

One more principle we should adopt as a team:

**Keep the harness thin. Make the skills thick.**

In plain English:

- The AI tool should not carry every instruction, every workflow, every edge case, and every historical decision in its default context.
- The default harness should stay lightweight: repo map, safety rules, test commands, and basic conventions.
- The deep process knowledge should live in focused, reusable Markdown playbooks, specs, checklists, and prompts that Claude reads only when the task needs them.

This is how we reduce token waste without losing quality.

## What belongs in the thin harness

Keep always-loaded instructions limited to:

- How to run the project
- Where important code lives
- Non-negotiable safety rules
- Core coding conventions
- How to verify work
- When to ask for human approval

## What belongs in thick skills

Move task-specific judgment into dedicated files, for example:

- `docs/identity-matching.md`
- `docs/facility-sharing-policy.md`
- `docs/audit-logging-rules.md`
- `docs/concierge-debugging-playbook.md`
- `docs/frontend-review-checklist.md`
- `docs/api-contract-review.md`

Then prompt Claude like this:

```txt
Use docs/identity-matching.md as the task playbook.
Do not read other playbooks unless needed.
Implement only the smallest change required for the current bug.
```

That gives Claude the right expertise at the right time instead of forcing every session to pay for every playbook.

## Why this matters

A fat harness creates hidden token waste. Every session starts by paying for instructions that may have nothing to do with the current task.

Thick skills are different. They are loaded on demand. They preserve team judgment, reduce repeated explanations, and keep the model focused.

The goal is not less context. The goal is **better context selection**.

---

# The Team Standard Going Forward

If you are hitting Claude limits more than once a week, assume your workflow is leaking tokens.

The fix is not “buy more tokens” or “wait for a better model.” The fix is better context discipline.

Before using Claude Code, ask yourself:

1. Did I give it a clear objective?
2. Did I limit the file scope?
3. Did I define what done means?
4. Did I remove irrelevant logs/history?
5. Did I restart when the session got noisy?
6. Did I use the strongest model for judgment instead of mechanical execution?
7. Did I ask it to verify instead of trusting the final message?

Claude is strongest when we treat context like an engineering resource, not an infinite dumping ground.

Use fewer tokens. Get better answers. Hit fewer limits.
