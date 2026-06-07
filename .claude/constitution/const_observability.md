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

## End-to-End Request ID Propagation Contract

- Every inbound HTTP request either accepts an `x-request-id` header (forwarded from the caller) or mints a new UUIDv7. UUIDv7 is required — not UUIDv4 — because it is time-ordered and cannot be duplicated across restarts.
- The same `requestId` flows through the entire call chain: **browser fetch → Express middleware → Python FastAPI → LLM call telemetry**. Breaking this chain at any boundary is a bug.
- Express forwards `x-request-id` on every outbound call to the Python service (`backend/src/services/embeddings.ts`, `backend/src/services/rag.ts`).
- Python adopts the inbound `x-request-id` as its own request ID. It does not generate a new ID if one is provided.
- The `requestId` is included in every LLM call log line (see `const_llm.md`).
- CORS configuration includes `x-request-id` in `Access-Control-Allow-Headers`.

## App Insights as the Single Observability Surface

- `@azure/monitor-opentelemetry` (Node/Express) and `azure-monitor-opentelemetry` (Python/FastAPI) are required in all three runtimes.
- The `APPLICATIONINSIGHTS_CONNECTION_STRING` is loaded from Key Vault via `secretref:` at Container Apps startup — the same pattern as other secrets.
- App Insights is the authoritative view for end-to-end traces, dependency maps, and performance metrics. Log Analytics raw queries supplement it but do not replace it.
- Auto-instrumentation covers HTTP, pg, psycopg2, and outbound fetch/httpx. Do not disable auto-instrumentation.

## Behavior Metrics Catalog

Emit these as custom App Insights events (`trackEvent`) at the named points in the user flow:

| Event name | When | Properties |
|---|---|---|
| `session_started` | New session created | `sessionId`, `requestId` |
| `intake_submitted` | Intake answers saved | `sessionId`, `requestId` |
| `skills_confirmed` | Skills confirmed by user | `sessionId`, `requestId` |
| `pathways_viewed` | Pathway recommendations rendered | `sessionId`, `requestId` |
| `plan_generated` | Career plan generated | `sessionId`, `requestId`, `latencyMs` |
| `pdf_downloaded` | PDF download triggered | `sessionId`, `requestId` |
| `page_time` | User navigates away from a wizard step | `step`, `durationMs`, `sessionId` |

These events power the behavior dashboards in Phase 8 and must not be removed or renamed without updating the dashboard KQL queries.
