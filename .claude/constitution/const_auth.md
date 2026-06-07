---
name: const-auth
description: "Authentication and identity rules — Entra ID, JWT verification, managed identity, allowlist, feature flags"
metadata:
  type: reference
---

# Authentication & Identity Constitution

## Frontend Authentication

- The frontend authenticates users via **NextAuth.js v5** with the **Microsoft Entra ID** provider.
- An email allowlist is enforced in the `signIn` callback. If the email is not in the allowlist, authentication is rejected with a clear message. The allowlist lives in the `app.allowlist` database table (not an env variable).
- Unauthenticated users are redirected to the sign-in page; they never see application content.
- Session tokens are `httpOnly`, `secure`, `sameSite=strict` cookies. Never store tokens in `localStorage` or `sessionStorage`.

## Backend JWT Verification

- The backend verifies the Entra ID JWT on **every** `/api/v1/*` route except `/health`.
- Verification is performed by a single centralized middleware (`backend/src/middleware/auth.ts`) using `jose.createRemoteJWKSet`. Verifying inline in a route handler or service is forbidden.
- The middleware validates: `iss` (issuer), `aud` (audience), `exp` (expiry), and email present in the allowlist.
- On success, `req.user` is populated with `{ email, sub }`. On failure, respond 401 with `{ error, requestId }` — never with token details or stack traces.
- JWKS keys are cached with a TTL (default: 10 minutes). Never fetch JWKS on every request.

## Azure Resource Access — Managed Identity Only

- **No API keys, passwords, or shared secrets** are used to authenticate to any Azure resource at runtime.
- All Azure resource access (Postgres, Azure OpenAI, Storage, Key Vault) uses `DefaultAzureCredential` from `@azure/identity` (Node) or `azure-identity` (Python).
- The User-Assigned Managed Identity `truepath-staging-id` is the single runtime identity. Its client ID is provided via `AZURE_CLIENT_ID` env var.
- An operator authenticates with `az login` (interactive) for deployment tasks. No service principal client secrets committed to the repo.

## Allowlist Management

- The allowlist table `app.allowlist (email TEXT PRIMARY KEY, created_at TIMESTAMPTZ)` is the authoritative source.
- Allowlist changes are SQL operations (INSERT / DELETE). Document the change in the ops runbook.
- The NextAuth `signIn` callback queries the DB allowlist synchronously. A DB failure must fail closed (deny the sign-in), never open.

## Feature Flags for Risky Auth Cutovers

- Auth enforcement ships behind `AUTH_ENFORCED=true|false`. Ship with `false`, smoke-test on staging, flip to `true` after 24 hours of clean operation. Remove the flag in the Phase 8 cleanup PR.
- Any change to the JWT verification logic ships the same way: code disabled behind a flag first, tested, then enabled.
- The flag state and its soak window are documented in `docs/ENTERPRISE_READINESS_PROGRAM.md` decision log.

## Rate Limiting

- Rate limiting is keyed on `req.user.email` once auth is live (Phase 4+). Before auth, key on IP.
- Expensive routes (`/api/v1/pathways`, LLM-backed operations) have tighter per-user limits than read routes.
- A 429 response includes `{ error: 'rate_limit_exceeded', retryAfterSeconds, requestId }`.

## Do / Don't

| Do | Don't |
|---|---|
| Verify JWT in `auth.ts` middleware, applied globally to `/api/v1/*` | Verify JWT inside a route handler or service function |
| Use `DefaultAzureCredential` for all Azure calls | Hardcode or env-store Azure resource passwords |
| Fail closed when the allowlist DB query errors | Catch the error and allow the sign-in |
| Return `401` with `requestId` on auth failure | Return `403` for expired/invalid tokens (that's authorization, not auth) |
| Ship auth changes behind `AUTH_ENFORCED` flag | Deploy auth verification live with no rollback path |

## PR Checklist (auth-related changes)

- [ ] JWT verification stays in `backend/src/middleware/auth.ts`, not in route handlers
- [ ] All `/api/v1/*` routes except `/health` protected (grep for `router.use(authMiddleware)`)
- [ ] No Azure credentials hardcoded; `DefaultAzureCredential` used
- [ ] Allowlist changes documented in the ops runbook
- [ ] `AUTH_ENFORCED` flag present if this is a risky cutover
