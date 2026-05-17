---
name: const-data
description: "Data layer patterns — repository pattern, query safety, transactions, response transformation"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Data Layer Constitution

## Repository / Service Layer

- All database access goes through a repository or service layer — never raw queries in route handlers.
- Route handlers orchestrate; services contain business logic; repositories contain queries. These are strict boundaries.
- Services do not import other services directly — they accept dependencies via constructor injection or explicit function parameters.
- A repository method does one thing: fetch, insert, update, or delete. It does not contain business logic.

## Query Safety

- Parameterized queries only — see `[[const-security]]`.
- Never construct dynamic column names, table names, or `ORDER BY` clauses from user input without an explicit allowlist check.
- Paginate all list queries — no unbounded `SELECT *` without `LIMIT` and `OFFSET` (or cursor-based pagination).
- Detect and eliminate N+1 queries: if a loop body contains a DB call, refactor to a batch query or a join.

## Transactions

- Multi-step writes that must succeed or fail together are always wrapped in a transaction.
- Never leave partial writes on failure — the database must be in a consistent state at all times.
- Keep transactions as short as possible — no network calls, no heavy computation, no user interaction inside a transaction block.

## Response Transformation

- Never return raw ORM model objects through the API — always map to an explicitly defined response type.
- Sensitive fields (password hashes, internal audit columns, foreign keys not needed by the client) are explicitly excluded.
- Nullable DB fields are resolved before returning — no `undefined` leaking into API response shapes.

## Schema Changes

- Migrations are additive by default — add columns before dropping old ones; never rename in a single step.
- Breaking schema changes (rename, type change, drop) require a multi-step migration with a compatibility window.
- Every migration includes a `down` migration — rollback must be possible without data loss.
- Migrations run before code deploy — never simultaneously, never after.
