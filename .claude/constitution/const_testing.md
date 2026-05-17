---
name: const-testing
description: "Testing strategy — what to test, no DB mocks, determinism, collocated test files"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Testing Constitution

## What Gets Tested

- Pure business logic (transformations, calculations, rules, guards): unit tests.
- API endpoints and service layer: integration tests against a real database.
- Critical UI flows (auth, checkout, core user journey): end-to-end tests on golden paths only.
- Do not write tests for framework boilerplate, trivial getters, or generated code.

## No Database Mocks

- Never mock the database layer in integration tests — use a real DB (dedicated test instance or testcontainers).
- Mock only external third-party services (email, payment APIs, AI APIs) using recorded fixtures or lightweight fakes.
- If you cannot run a real DB in a test, that is an infrastructure problem to fix — not a justification for mocking.
- In-memory SQLite as a DB substitute is also forbidden — schema and query behaviour diverges from production.

## Determinism

- Tests produce the same result on every run, on any machine, in any order.
- No `Date.now()` or `Math.random()` in test assertions — inject via dependency or mock at the module level.
- No `setTimeout` real delays in tests — use fake timers (`vi.useFakeTimers()` / `jest.useFakeTimers()`).
- No test order dependencies — every test is fully independent and can run in isolation.

## Structure

- Test file lives next to the source file: `auth.service.ts` → `auth.service.test.ts`.
- Test names describe observable behavior: `it('returns 401 when token is expired')` not `it('works')`.
- Arrange / Act / Assert — one assertion concept per test. Split if you need multiple concepts.
- No shared mutable state in `beforeAll` across unrelated tests — use `beforeEach` for per-test setup.

## Coverage Expectations

- Business logic: high branch coverage — every conditional branch has a corresponding test.
- Integration tests cover the happy path and the primary error paths for every endpoint.
- Do not chase 100% line coverage — a meaningful test that covers 60% beats a meaningless test that covers 100%.
- Mutation testing is the gold standard for test quality — lines executed is not the same as behavior verified.
