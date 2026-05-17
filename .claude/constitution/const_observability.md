---
name: const-observability
description: "Logging and observability rules — structured JSON logs, request IDs, no PII, log levels"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Observability Constitution

## Structured Logging

- All logs are structured JSON — never raw `console.log` strings in application code.
- Every log entry includes: `timestamp` (ISO 8601), `level`, `requestId`, `service`, `message`.
- Use a logger instance (pino, winston) — never `console.log` directly. The logger is injected, not imported globally.
- Log once per significant operation at the boundary — not inside every helper called by that operation.

## Request IDs

- Every inbound HTTP request gets a UUID request ID at the entry point (first middleware).
- The request ID is attached to the logger context for the entire lifetime of the request.
- The request ID is returned in the response header (`X-Request-ID`) so clients can correlate logs with responses.

## What to Log

- Service entry/exit for operations crossing boundaries: DB calls, external API calls, queue messages.
- Errors at the throw site — include `code`, `message`, and stack trace (server-side only, never in response body).
- Auth events: login success, login failure, token refresh, permission denial — these are the audit trail.
- Significant business events at `info` level: user registered, application submitted, payment processed.

## What Never to Log

- PII: names, email addresses, phone numbers, addresses, government IDs — even in debug level.
- Secrets: passwords, tokens, API keys, session IDs, cookie values.
- Full request/response bodies on auth endpoints.
- Individual field values from user-submitted forms.

## Log Levels

- `error`: unexpected failures requiring immediate attention or investigation.
- `warn`: expected failures or degraded operation (cache miss, retry attempt, deprecated API called).
- `info`: significant business events that would interest a product stakeholder.
- `debug`: developer diagnostics — must be disabled in production by default.

## No Log Noise

- Never log inside a loop unless the iteration count is bounded and small.
- Do not log at every function call — log at the entry and exit of service boundaries only.
- Repeated identical logs in a short window should be sampled or rate-limited — not emitted on every occurrence.
