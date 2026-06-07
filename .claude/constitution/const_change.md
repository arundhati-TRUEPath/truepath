---
name: const-change
description: "Change safety rules — caller identification, scope discipline, regression prevention, deployment safety"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Change Safety Constitution

## Before Any Change

- Identify all callers of the function, type, or module being changed before writing a single line.
- Use TypeScript references and grep to find every call site — do not rely on memory or assumptions.
- If the change touches shared code (auth, DB schema, API envelope, shared utilities), explicitly state the blast radius before proceeding.
- If existing tests are absent, write a minimal test capturing current behavior before modifying it — this is the baseline.

## Scope Discipline

- Only change what the task requires — do not fix unrelated issues in the same commit.
- If you notice a separate bug while working, note it and stop. Do not fix it in-band — create a follow-up issue.
- A change that requires touching more than 5 unrelated files is a signal the abstraction is wrong — stop and redesign before continuing.
- Do not rename, reformat, or reorganize code that is outside the stated scope of the task.

## Signature and Contract Changes

- When a function signature changes, every call site is updated in the same commit — never leave callers in a broken intermediate state.
- API response shape changes are breaking — a new API version is required (see `[[const-api]]`).
- DB schema changes are additive first — the old column or table remains until all consumers are fully migrated.
- Never change the type signature of a shared utility without running `tsc --noEmit` to confirm zero downstream breakage.

## TypeScript as Safety Net

- Run `tsc --noEmit` after every change that touches a shared type or interface — zero errors before moving on.
- TypeScript errors are hard failures, not warnings — a type error means something downstream is broken.
- Do not use `// @ts-ignore` or `// @ts-expect-error` to silence an error caused by your own change.

## Testing After Change

- After any change, run the test suite for the changed module and its direct dependents — not only the changed file.
- If tests fail after a refactor that was meant to be behavior-preserving, stop and investigate — do not adjust the test to match the new behavior without understanding why it changed.

## Deployment Safety

- Feature flags wrap changes to shared infrastructure that cannot be rolled back instantly.
- Database migrations run before code deploys — never after, never simultaneously.
- If a rollback would require running a destructive down migration against production data, the change strategy is wrong — redesign to be additive before merging.

## Feature Flags for Risky Boundary Changes

Risky boundary changes are those that affect the auth model, DB auth method, or LLM provider. These three changes require the following discipline:

1. **Ship disabled.** The new code path is behind an env flag (`AUTH_ENFORCED`, `DB_AUTH_MODE`, `LLM_PROVIDER`). The default is the old behavior. The new code is deployed but not active.
2. **Smoke test with the flag.** Flip the flag on staging and run the full end-to-end smoke test (see `docs/ENTERPRISE_READINESS_PROGRAM.md`).
3. **Soak.** Leave the flag enabled for the documented soak window (default: 24 hours on staging) before considering the cutover complete.
4. **Document.** Record the flag, its current state, and the soak window in the decision log in `docs/ENTERPRISE_READINESS_PROGRAM.md`.
5. **Remove.** In the follow-up cleanup PR (Phase 8), remove the flag and the old code path entirely. No permanent flags.

Applying a flag to a change that does not require it is waste. Skipping a flag on a change that does require it is a production risk.

The three active flags for the enterprise-readiness program are: `AUTH_ENFORCED`, `DB_AUTH_MODE`, `LLM_PROVIDER`. All three are removed in Phase 8.
