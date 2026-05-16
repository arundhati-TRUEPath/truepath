# CLAUDE.md

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

- One concern per message. Never bundle multiple asks.
- Be specific: name the file, function, or line. Don't say "look at the codebase."
- Skip explanations unless you need them. "Implement X" not "Implement X and explain why."
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
