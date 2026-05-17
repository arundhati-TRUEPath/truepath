---
name: const-errors
description: "Error handling patterns — typed errors, no swallowing, operational vs programmer error distinction"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Error Handling Constitution

## Typed Error Classes

- Throw typed error classes, not raw strings: `throw new ValidationError('...')` not `throw 'invalid'`.
- Every error class extends a base `AppError` that carries: `code`, `message`, `statusCode`, `isOperational`.
- `isOperational: true` = expected failure (invalid input, not found, conflict). `false` = programmer error (assertion, null deref).
- Operational errors are caught, logged, and returned as structured API responses.
- Programmer errors crash the process — let the supervisor (PM2, Docker) restart. Do not swallow them.

## No Swallowing

- `catch(e) {}` with no body is forbidden.
- `catch(e) { console.log(e) }` with no re-throw or structured handling is forbidden.
- If you intentionally ignore an error, document why inline: `catch (_e) { /* redis down — degrade to DB */ }`.

## Async

- Every `Promise` is either `await`-ed, returned, or has `.catch()` attached — no floating promises.
- `Promise.all` for concurrent independent operations; `Promise.allSettled` when partial failure is acceptable.
- Never mix callbacks and promises in the same control flow.
- Top-level `async` route handlers are wrapped in a try/catch or a centralized async error handler middleware.

## Propagation

- Log at the throw site (the origin), not at every catch level along the stack.
- Re-throw after logging only if the caller must handle it differently.
- The HTTP layer is the only place that maps `AppError` to a status code and response shape.
- Never include stack traces in API error responses — log them server-side only.
