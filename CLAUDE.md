# CLAUDE.md

## Engineering Constitution

These rules apply to every line of code in every task. They are not guidelines — they are hard constraints.

### Type Safety
- `any` is forbidden. Treat it as a build failure.
- All external input (requests, env vars, third-party responses) validated with Zod at the system boundary before use.
- `tsc --noEmit` must pass with zero errors before a task is considered done.

### Error Handling
- Every async path has explicit error handling — no floating promises.
- Never swallow errors silently. Every `catch` either handles, re-throws, or logs with justification.

### Security
- No raw string SQL — parameterized queries only.
- No secrets in source code, config files, or logs — environment variables only.
- Auth/authz checked at the route boundary before any handler logic runs.

### Structure & Maintainability
- Functions do one thing, max ~50 lines. If the name contains "and", split it.
- Guard clauses over nested conditionals — return early.
- No dead code, no commented-out code, no TODOs without a linked issue.
- Dependencies flow one direction: UI → service → data. No circular imports.

### Change Safety
- Before changing shared code: grep for all callers first.
- Stay within the stated task scope — do not touch code outside the task boundary.
- A change touching >5 unrelated files signals a design problem — stop and redesign.
- Never expose DB model shapes directly through API responses.

### Testing
- Business logic has unit tests. API endpoints have integration tests against a real DB.
- No database mocks in integration tests.

### Constitution Files
Detailed rules for each domain live in `.claude/constitution/`:
`const_types` · `const_errors` · `const_security` · `const_testing` · `const_data` · `const_api` · `const_ui` · `const_observability` · `const_structure` · `const_change` · `const_prompts`

---

## Default Model
Always start with:
```
/model opusplan
```
Opus handles planning. Sonnet handles execution. Switches automatically.

---

## Model Selection

| Task Type | Model | Command |
|-----------|-------|---------|
| Architecture, hard bugs, security, ambiguous design | Opus | `/model opus` |
| Everyday coding, refactoring, tests, debugging | Sonnet | `/model sonnet` |
| Formatting, renaming, doc strings, mechanical edits | Haiku | `/model haiku` |

**After any Opus spike, return to default:**
```
/model opusplan
```

---

## Prompt Rules (follow these to reduce token waste)

- Always act like a professional principal software engineer
- One concern per message. Never bundle multiple asks.
- Be specific: name the file, function, or line. Don't say "look at the codebase."
- Skip explanations unless you need them. "Implement X" not "Implement X and explain why."
- Reduce verbosity
- Prefer targeted edits over full file rewrites.
- Use `ultrathink` in your prompt only for genuinely hard reasoning (concurrency bugs, security design). It spends tokens aggressively.

---

## Context Management

**Run `/compact` proactively** — don't wait until the context is full:
- After completing a major feature or milestone
- When switching to a different part of the codebase
- When the conversation has grown long with back-and-forth
- Before starting a new task in the same session

**Use `/clear`** when switching to a completely unrelated task. Cheaper than carrying irrelevant history.

**Start a fresh session** for long refactors split across multiple logical chunks. Re-reading a large history to make a small change is wasteful.

---

## Behavior

- Operate autonomously — proceed unless an action is truly irreversible or destructive (e.g., dropping a database, force-pushing main).
- Prefer editing existing files over creating new ones.
- Do not add features, refactors, or abstractions beyond what the task requires.
- Do not create README or documentation files unless explicitly asked.
- Do not add trailing summaries explaining what you just did — the diff speaks for itself.

---

## Git

- Create new commits rather than amending.
- Never skip hooks (`--no-verify`) without explicit instruction.
- Never force-push `main` or `master`.

---

## Quick Reference

```
/model opusplan   → default (Opus plans, Sonnet executes)
/model opus       → hard problems only
/model sonnet     → everyday coding
/model haiku      → mechanical tasks
/compact          → summarize context, run regularly
/clear            → wipe context for unrelated task
/status           → check active model
```
