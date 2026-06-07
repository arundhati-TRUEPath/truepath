# TruePath — Enterprise Readiness Program

## Executive Summary

TruePath is a working career-guidance application. This program closes the gap between "it runs" and "a staff engineer at a major technology company would sign off on it." The work covers: end-to-end request tracing, authentication and access control, database access via Managed Identity, a migration from direct OpenAI to Azure OpenAI Service, Infrastructure-as-Code, and CI/CD. Staging is treated as production throughout; the frontend is invite-only. Each phase is independently shippable and ends with a verified smoke test.

---

## Current-State Baseline (Gap Inventory at Program Start)

| Gap | Severity | Addressed In |
|---|---|---|
| Backend has **zero authentication** — every API route is publicly accessible | Critical | Phase 4 |
| Frontend `app/error.tsx` returns `null` — client errors are silently dropped | High | Phase 1 |
| LLM full prompts and raw responses are logged — intake answers contain PII (location, finances, caregiving) | High | Phase 1 |
| No end-to-end request ID — three independent IDs, nothing crosses boundaries | High | Phases 1 + 2 |
| Pino file logs are pretty-printed multi-line JSON — incompatible with log shippers | Medium | Phase 1 |
| Python logging is stdlib plain text, no file output, no rotation | Medium | Phase 1 |
| No App Insights SDK — only Container Apps stdout forwarded to Log Analytics | Medium | Phase 1 |
| Database uses password auth in `DATABASE_URL` — no Managed Identity | High | Phase 5 |
| Python has zero DB connection pooling — new `psycopg2.connect()` per call | Medium | Phase 5 |
| No index on `sessions.status` or `sessions.created_at` | Medium | Phase 5 |
| Direct OpenAI API — no Azure AI governance, quotas, or content filtering | Medium | Phase 6 |
| Duplicate types between backend and frontend (`Pathway`, `Limitations`, intake DTOs) | Low | Phase 6 |
| `deploy-phase4.ps1` only updates image tag on re-run — env/secret changes silently ignored | High | Phase 7 |
| Hardcoded subscription ID and RG name in deploy scripts | Medium | Phase 7 |
| ACR admin credentials enabled — MI is already wired for pulls | Low | Phase 3 |
| No rate limiting, no Helmet, no body-size cap | High | Phase 3 |
| No CI/CD, no Dependabot, no supply-chain scanning | High | Phase 7 |
| No App Insights dashboards or alerts | Medium | Phase 8 |

---

## Roadmap

| Phase | Name | Status | Verification |
|---|---|---|---|
| 0 | Document the Program & Extend the Engineering Constitution | ✅ Complete | All constitution files present; program doc readable |
| 1 | Observability & Logging Floor | ⬜ Pending | App Insights traces correlated; PII absent from logs |
| 2 | End-to-End Request-ID Propagation | ⬜ Pending | Single UUID traceable across frontend + backend + Python |
| 3 | Backend Edge Hardening | ⬜ Pending | Unlisted origin rejected; 1 MB body rejected; smoke test green |
| 4 | Auth: NextAuth (Entra ID) + Backend JWT | ⬜ Pending | Unauthenticated curl → 401; allowlisted user completes flow |
| 5 | DB Hardening: Entra MI Auth + Pooling + Indexes | ⬜ Pending | `pg_stat_activity` shows MI principal; pool stable under load |
| 6 | Azure OpenAI Migration + Shared Types | ⬜ Pending | All 5 LLM sites on Azure; comparable App Insights latency |
| 7 | IaC + CI/CD (ADO-ready) + Supply Chain | ⬜ Pending | `what-if` shows zero changes; deploy via script succeeds |
| 8 | Operational Polish | ⬜ Pending | Dashboards live; flags removed; runbooks complete |

---

## Cross-Cutting Principles

1. **Every phase ships independently.** No half-finished feature flags carried across phases. Each PR merges only when the smoke test passes locally.
2. **Reversible rollbacks.** Risky cutovers ship behind feature flags (`AUTH_ENFORCED`, `DB_AUTH_MODE`, `LLM_PROVIDER`) with a documented soak window. Flags are removed in Phase 8.
3. **Measure before changing.** Observability lands in Phase 1 so every later change can be evaluated against real metrics, not guesses.
4. **Lock the front door before opening Entra.** Phase 3 (edge hardening) runs before Phase 4 (auth) so Helmet/rate-limit errors are isolated from JWT debugging.
5. **No modularity for its own sake.** The codebase is already disciplined (largest file: 198 lines). Refactors happen only where a phase already touches the file.

---

## End-to-End Smoke Test

This test is run at the end of every phase, on local and staging. A phase is not complete until it passes.

1. Open the frontend in a fresh browser; log in with an allowlisted account (Phase 4+; skip login before Phase 4).
2. Complete intake → receive 3 AI follow-up questions → submit answers.
3. Receive 9 transferable skills → confirm.
4. Receive 3 career pathway recommendations → view limitations for each.
5. Generate career plan → download PDF.
6. (Phase 1+) From App Insights end-to-end transaction view, confirm a single `requestId` correlates: frontend client log, Express log, Python log, and LLM call telemetry.
7. Container Apps → Revisions shows latest revision as `Provisioned: Succeeded`, `RunningStatus: Running`.
8. `pg_stat_activity` shows healthy connection count (below pool max, no idle-in-transaction accumulation).

---

## Decision Log

| # | Decision | Rationale | Status |
|---|---|---|---|
| D-01 | Auth via NextAuth.js v5 + Entra ID (not magic links) | Entra tenant already exists; RS256 JWKS verification requires no shared secret; Entra gives group claims for future role gating without rebuilding; magic links require email delivery infra (ACS) and a token store — net-new dependencies | Active |
| D-02 | Invite-only frontend with email allowlist in DB | Staging treated as production; external access must be controlled | Active |
| D-03 | Single staging environment; no separate prod | Development and testing on local; staging promoted to users. Prod split deferred to a later program. | Active |
| D-04 | DB auth via Entra MI on all paths (Node, Python, migrations) | Eliminates the password rotation problem entirely; UAMI already exists for ACR/Blob/KV; aligns with the "no shared secrets" principle | Active — `AUTH_ENFORCED`, `DB_AUTH_MODE` flags gate the cutover |
| D-05 | Azure OpenAI via DefaultAzureCredential (no API key) | Reuses UAMI; eliminates the OpenAI API key rotation problem; Azure AI governance, content filtering, and quota management | Active — `LLM_PROVIDER` flag gates the cutover |
| D-06 | ADO pipelines planned now, executed after repo migration from GitHub to ADO | `azure-pipelines.yml` committed to repo but inactive; activated when the repo moves | Pending repo migration |
| D-07 | Bicep IaC using `--mode Incremental`; existing resources imported, not destroyed | Stateful resources (Postgres, KV, Storage) must never be destroyed by a deploy | Active |
| D-08 | Key Vault moved from access-policy to RBAC in Phase 7 | Changing KV auth model mid-program entangles with DB/AOAI MI rollouts; Phase 7 is already a coherent IaC change | Deferred to Phase 7 |
| D-09 | `AUTH_ENFORCED` soak window: 24 hours on staging before enabling | Low-traffic staging; 24h covers a business day of invite-only testers | Active until Phase 8 |
| D-10 | `OPENAI_API_KEY` archived in KV (renamed `archive-OPENAI-API-KEY`) for 30 days post-migration, then deleted | Provides a rollback path without key rotation; ensures Azure OpenAI is stable before removing fallback | Pending Phase 6 |

---

## Active Feature Flags

| Flag | Values | Default | Remove in |
|---|---|---|---|
| `AUTH_ENFORCED` | `true` \| `false` | `false` (ship disabled, flip after soak) | Phase 8 |
| `DB_AUTH_MODE` | `password` \| `mi` | `password` (flip per runtime after verification) | Phase 8 |
| `LLM_PROVIDER` | `openai` \| `azure` | `openai` (flip per call site after verification) | Phase 8 |

---

## Glossary

| Term | Meaning |
|---|---|
| ACA | Azure Container Apps |
| ACR | Azure Container Registry |
| AOAI | Azure OpenAI Service |
| HNSW | Hierarchical Navigable Small World (vector index algorithm used by pgvector) |
| JWKS | JSON Web Key Set — the public key endpoint used to verify RS256 JWTs |
| KV | Azure Key Vault |
| LAW | Log Analytics Workspace |
| MI | Managed Identity |
| PITR | Point-In-Time Restore (Postgres backup mechanism) |
| RAG | Retrieval-Augmented Generation |
| RG | Azure Resource Group |
| UAMI | User-Assigned Managed Identity (`truepath-staging-id`) |

---

## Architecture Reference

- **Backend**: Express 4.21 + TypeScript, runs in `truepath-backend` Container App (internal, port 4000)
- **Frontend**: Next.js 15 App Router, runs in `truepath-frontend` Container App (external, port 3000)
- **Python services**: FastAPI, runs in `truepath-python` Container App (internal, port 8000)
- **Database**: Azure Postgres Flexible Server `truepath-db` (northcentralus) with pgvector extension + HNSW index
- **Vector store**: pgvector on the same Postgres instance; `rag_chunks.embedding` column (1536 dimensions, `text-embedding-3-small`)
- **Container environment**: `truepath-staging-env` in RG `Gitlab_TRUE_Path_rg` (eastus)
- **Identity**: UAMI `truepath-staging-id` (client ID in `AZURE_CLIENT_ID`)
- **Key Vault**: `truepath-kv-stg` (access-policy mode → RBAC in Phase 7)
- **Log Analytics**: `truepath-logs` workspace; App Insights resource workspace-backed on same LAW (Phase 1+)
- **Storage**: `truepathstorage` / container `rag-data` — source documents for RAG indexer
