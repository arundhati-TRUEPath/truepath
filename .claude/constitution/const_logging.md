---
name: const-logging
description: "Log file format, rotation, restart sequencing, field schema, and no-console-log rules across all three runtimes"
metadata:
  type: reference
---

# Logging File Convention Constitution

## Single-Line JSON Only

- Every log line in every file sink is a single, complete JSON object terminated by a newline (`\n`). No pretty-printing, no multi-line output, no blank lines between entries.
- Pretty-printing is incompatible with log shippers (Loki, Fluent Bit, Azure Monitor Agent). Stdout may be pretty-printed for local dev only via `NODE_ENV=development` — never in the file sink.
- The file sink and the stdout sink are independent transports. Stdout format may differ from the file format; file format is always compact JSON.

## Log File Naming and Location

One file per runtime. Files live in the `logs/` directory at the root of each runtime's working directory:

| Runtime | Pattern | Example |
|---|---|---|
| Backend (Express) | `logs/backend-YYYY-MM-DD.<n>.log` | `logs/backend-2026-06-06.2.log` |
| Frontend (Next.js server) | `logs/frontend-YYYY-MM-DD.<n>.log` | `logs/frontend-2026-06-06.1.log` |
| Python (FastAPI) | `logs/python-YYYY-MM-DD.<n>.log` | `logs/python-2026-06-06.3.log` |

- `<n>` is a restart sequence number that increments each time the process starts within the same calendar day. The first start of the day is `.1`, the second is `.2`, etc.
- The sequence number is determined by counting existing log files matching the current date pattern at startup. It never resets within a day.
- Rolling over to a new date creates a new file with sequence `.1`. Old date files are not deleted by the application.
- Log file retention (deletion of files older than N days) is an ops concern, not an application concern.

## Required Fields on Every Log Line

All log lines across all three runtimes must include:

| Field | Type | Description |
|---|---|---|
| `ts` | ISO 8601 string | Timestamp with millisecond precision |
| `level` | `"error"` \| `"warn"` \| `"info"` \| `"debug"` | Log level |
| `msg` | string | Human-readable message |
| `requestId` | UUID string \| `null` | The end-to-end request ID (null for background/startup events) |
| `service` | `"backend"` \| `"frontend"` \| `"python"` | Which runtime emitted this line |

Additional fields added by context (not required on every line but must be present when applicable):

| Field | When present |
|---|---|
| `route` | Any HTTP request log line |
| `latencyMs` | Any operation timing log |
| `statusCode` | HTTP response log lines |
| `userEmail` | After Phase 4 auth is live (never before — don't log email for unauthenticated requests) |
| `error` | Error log lines — include `code`, `message`, `stack` (server-side only, never in HTTP responses) |

## No `console.log` in Production Paths

- `console.log`, `console.error`, `console.warn`, `console.info` are forbidden in any file that runs server-side in production.
- On the frontend: `console.*` is acceptable only in development builds, gated by `process.env.NODE_ENV === 'development'`. Client-side errors use `clientLogger` from `frontend/src/lib/log/`.
- Violations caught in PR review are blocking. `grep -r "console\.log" backend/src/ services/` must return zero matches (excluding test files) before merge.

## Frontend Client Logging

- Client-side logs are collected by `frontend/src/lib/log/clientLogger.ts`.
- Logs are batched and POSTed to `POST /api/v1/_telemetry` on the backend, which writes them to `logs/frontend-YYYY-MM-DD.<n>.log`.
- The `clientLogger` is the sole error reporting path from `app/error.tsx` and `components/shared/ErrorBoundary.tsx`.
- Client log lines include the `requestId` of the fetch that was in flight when the error occurred (if available).

## Background and Startup Events

- Process startup, shutdown, and background job events use `requestId: null` — they are not associated with a user request.
- Cron job and migration runner events follow the same field schema, with `service: "python"` and an operation-scoped ID in `requestId`.

## Do / Don't

| Do | Don't |
|---|---|
| Write compact single-line JSON to file sinks | Pretty-print JSON in file sinks |
| Increment `<n>` on restart within the same day | Overwrite the previous log file on restart |
| Include `requestId` on every HTTP-related log line | Emit log lines without a `requestId` for request-scoped events |
| Use the project logger instance | Call `console.log` in production code paths |
| Keep `logs/` in `.gitignore` | Commit log files to the repo |

## PR Checklist (logging-related changes)

- [ ] File sink uses compact single-line JSON
- [ ] Log file naming follows `<runtime>-YYYY-MM-DD.<n>.log` pattern
- [ ] New log lines include all required fields (`ts`, `level`, `msg`, `requestId`, `service`)
- [ ] No `console.log` in server-side production code paths
- [ ] Frontend errors routed through `clientLogger`, not `console.error`
