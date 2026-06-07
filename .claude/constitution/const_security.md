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

## Backend Hardening Checklist

Every new Express route must satisfy all of the following before it can be merged:

- [ ] Auth middleware applied (see `const_auth.md`) — all `/api/v1/*` routes except `/health`
- [ ] Zod schema validates the request body, query params, and relevant headers
- [ ] Rate limiting applies — use the per-route override if the route is LLM-backed or expensive
- [ ] `express.json({ limit: '256kb' })` body cap is active (set globally in `app.ts`)
- [ ] Response does not expose raw DB model shapes (see `const_api.md`)
- [ ] Error responses include `requestId` and no stack trace

## PII in Logs Is a Build-Breaking Error

- Intake answers, user names, email addresses, financial details, location, and caregiving information are PII.
- Logging any PII — at any level, in any runtime — is a blocking defect, not a style issue.
- The redactor unit test in `backend/src/lib/llmRedact.test.ts` takes a known intake payload and asserts it does not appear in captured log output. This test is a required CI gate. If it fails, the PR does not merge.

## Supply-Chain Security

- Before adding any npm or Python dependency: run `npm audit --production` (Node) or `pip-audit` (Python) locally. A high or critical finding blocks the addition.
- Trivy scans are run on all container images in the CI pipeline. High and critical CVEs block deployment.
- SBOM (Software Bill of Materials) is generated via `syft` and published as a pipeline artifact on every release.
- Dependabot is configured for npm, pip, and GitHub Actions dependencies.

## Secrets Hygiene

- No raw OpenAI API keys, Azure resource keys, or DB passwords in `.env` files, scripts, or source code.
- `.env.example` contains variable **names only** — no values, not even placeholder values that look like real secrets.
- Key Vault is the authoritative secret store. Secrets are referenced in Container Apps via `secretref:` + `keyvaultref:` + `identityref:`.
- `OPENAI_API_KEY` is archived in KV as `archive-OPENAI-API-KEY` for 30 days post-AOAI migration, then deleted.

## Dependencies

- `npm audit --production` runs in CI — high/critical severity vulnerabilities block merge.
- `pip-audit` runs in CI — high/critical vulnerabilities block merge.
- Pin exact versions in `package.json` for applications (floating ranges are for libraries only).
- No new dependency added without a stated justification in the PR description.
