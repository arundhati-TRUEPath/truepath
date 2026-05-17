---
name: const-security
description: "Security rules — input validation, auth, secrets, OWASP top 10 mitigations"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Security Constitution

## Input Validation

- Validate ALL external input server-side with Zod before touching it — client-side validation is UX only, not a security control.
- Whitelist allowed values; reject everything else. Never blacklist known bad values.
- Strip unknown fields from request bodies before processing (`z.object().strict()` or explicit `.strip()`).
- Validate query parameters, path params, and headers — not just request bodies.

## SQL / Data Access

- Parameterized queries only — no string interpolation into SQL under any circumstances.
- ORM query builders are acceptable only if they do not expose raw SQL escape hatches without code review.
- Never construct `ORDER BY`, `LIMIT`, column names, or table names from user input without an explicit allowlist.

## Authentication & Authorization

- Auth check at the route/middleware boundary — never inside business logic or service layer.
- Sessions use `httpOnly`, `secure`, `sameSite=strict` cookies. Never store tokens in `localStorage`.
- Password hashing: `bcrypt` with cost factor ≥12. MD5, SHA1, and unsalted hashes are forbidden.
- Rate-limit all auth endpoints: login, register, password reset, token refresh.
- Permission checks are fail-closed — deny if the authorization decision is ambiguous.

## Secrets

- Secrets live in environment variables only — never in source code, committed config files, or logs.
- Access secrets through a typed config module that validates presence at startup and fails fast if missing.
- Never log request headers, authorization tokens, API keys, or passwords — even in debug mode.

## Output Safety

- Never use `innerHTML` or `dangerouslySetInnerHTML` with user-supplied content without explicit DOMPurify sanitization.
- No `eval`, `new Function()`, or `setTimeout(string, ...)`.
- Set `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers on all HTTP responses.

## Dependencies

- `npm audit` runs in CI — high/critical severity vulnerabilities block merge.
- Pin exact versions in `package.json` for applications (floating ranges are for libraries only).
- No new dependency added without a stated justification in the PR description.
