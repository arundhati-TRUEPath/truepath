# Azure PostgreSQL Migration — Verification Log
**Date:** 2026-06-04  
**Migration:** Supabase → Azure Database for PostgreSQL Flexible Server

---

## Phase 0 — Pre-Migration Preparation

### Steps Completed
| Step | Status | Notes |
|---|---|---|
| 0.1 Supabase pg_dump backup | DEFERRED | `pg_dump` not installed; Docker not running on dev machine. Rollback is safe: Supabase instance untouched. Command for later: `docker run --rm postgres:16 pg_dump "postgresql://postgres:tr%40ep%40th%40321@db.oqcthtuqvkphclwvalsf.supabase.co:5432/postgres" > supabase_backup.sql` |
| 0.2 Provision Azure PostgreSQL | DONE | `truepath-db` in `Gitlab_TRUE_Path_rg`, `northcentralus`, Standard_B2ms, PG 16 |
| 0.3 Enable extensions | DONE | `azure.extensions = vector,uuid-ossp`, `isConfigPendingRestart: false` |
| 0.4 Firewall — Azure services | DONE | Created during provisioning with `--public-access 0.0.0.0` |
| 0.4 Firewall — dev machine | DONE | Rule `AllowDevMachine` for IP `76.121.14.63` |
| 0.5 DATABASE_URL in Key Vault | DONE | Secret `DATABASE-URL` stored in `truepath-kv-stg` |
| 0.5 .env files updated | DONE | `backend/.env` and `services/.env` updated |

### Azure Resource Details
- **Server name:** `truepath-db`
- **FQDN:** `truepath-db.postgres.database.azure.com`
- **Resource group:** `Gitlab_TRUE_Path_rg` (same as all other infra)
- **Region:** `northcentralus` (eastus/eastus2 blocked at subscription level)
- **Tier:** Standard_B2ms, 2 vCores, 8 GB RAM
- **Storage:** 32 GB auto-grow
- **Admin user:** `truepathdb`
- **Version:** PostgreSQL 16

### Learnings — Phase 0
- **LN-01:** `eastus` and `eastus2` are subscription-restricted for `Microsoft.DBforPostgreSQL`. `northcentralus` was the first available US region. Always check region availability before specifying in scripts.
- **LN-02:** `Microsoft.DBforPostgreSQL` provider was not registered in the subscription. Must register before any `az postgres` commands succeed.
- **LN-03:** `az postgres flexible-server execute` and `az postgres flexible-server connect` do NOT exist in the version of Azure CLI installed. Use Python + psycopg2 or install a db-up extension for running migration files.
- **LN-04:** `azure.extensions` parameter is case-sensitive — must be lowercase (`vector,uuid-ossp`). Uppercase silently resets to empty, causing `CREATE EXTENSION vector` to fail with "not in allowlist".
- **LN-05:** `--public-access 0.0.0.0` during server creation allows Azure services only. A separate firewall rule is required for dev machine connections.

---

## Phase 1 — Database Schema Migration

### Migration Files
| File | Status | Notes |
|---|---|---|
| `001_schema.sql` | Applied | Core tables: sessions, questions, question_choices, session_responses |
| `002_disable_rls.sql` | Applied | Harmless on plain PostgreSQL (RLS is off by default) |
| `003_refactor_questions.sql` | Applied | Drops+recreates questions tables; inserts 7 seed questions inline |
| `004_session_skills.sql` | Applied | session_skills table |
| `005_rag_tables.sql` | Applied (RECONSTRUCTED) | Reconstructed from Supabase schema — was never committed to repo. Added `vector(1536)` for pgvector |
| `006_session_pathways.sql` | Applied | session_pathways JSONB table |
| `007_match_rag_chunks_fn.sql` | Applied | Cosine similarity search function (replaced Supabase auto-RPC) |
| `008_hnsw_index.sql` | DEFERRED | Run after RAG re-indexing (Phase 4) |

### Verification SQL Results
| Query | Expected | Actual |
|---|---|---|
| `SELECT tablename FROM pg_tables WHERE schemaname='public'` | 8 tables | 8 tables ✓ |
| `SELECT count(*) FROM questions WHERE source='seed'` | 7 | 7 ✓ |
| `SELECT proname FROM pg_proc WHERE proname='match_rag_chunks'` | 1 row | 1 row ✓ |
| `SELECT extname FROM pg_extension WHERE extname='vector'` | 1 row | 1 row ✓ |

### Learnings — Phase 1
- **LN-06:** Migration 005 (`rag_tables`) was never committed to the repo — it existed only in Supabase's applied-but-not-tracked history. Always commit every migration immediately after applying. Reconstructed from indexer.py and retriever.py source code.
- **LN-07:** `supabase db dump` CLI may not capture pgvector-generated RPCs like `match_rag_chunks`. The match function must be recreated manually as a standard SQL function.
- **LN-08:** Running migrations 001→002→003 on a fresh DB is idempotent but wasteful (001 creates tables that 003 immediately drops and recreates). Consider collapsing these on fresh installs.
- **LN-09:** When using Python psycopg2 as migration runner, `conn.autocommit = True` is required — psycopg2 wraps everything in a transaction by default. Without it, multi-statement migration files (like 003 with its DO $$ block) error with "can't run inside a transaction block".

---

## Phase 2 — TypeScript Backend

### Files Changed
| File | Change | Type-check |
|---|---|---|
| `backend/package.json` | `pg` → dependencies; `@supabase/supabase-js` removed | ✓ |
| `backend/src/config.ts` | `supabase.*` → `database.url` | ✓ |
| `backend/src/db/client.ts` | Supabase client → `pg.Pool` with TLS | ✓ |
| `backend/src/repositories/sessions.repo.ts` | 4 functions → raw SQL | ✓ |
| `backend/src/repositories/questions.repo.ts` | 2 functions → raw SQL | ✓ |
| `backend/src/repositories/skills.repo.ts` | 4 functions → raw SQL | ✓ |
| `backend/src/repositories/pathways.repo.ts` | 2 functions → raw SQL | ✓ |
| `backend/src/routes/sessions.test.ts` | Supabase cleanup → `pool.query` + `pool.end()` | ✓ |
| `backend/src/routes/intake.test.ts` | Supabase cleanup → `pool.query` + `pool.end()` | ✓ |
| `backend/.env.example` | `SUPABASE_*` → `DATABASE_URL` | — |

### Verification
- `tsc --noEmit`: **zero errors** ✓
- Supabase grep in `backend/src/`: **zero results** ✓
- `npm install`: 8 packages removed ✓
- `vitest run`: **12/12 tests pass** ✓ (sessions: 3 tests, intake: 9 tests)

### Learnings — Phase 2
- **LN-10:** `pg` was pre-staged in `devDependencies` (someone anticipated the migration). Always check if a dependency is already present before adding it.
- **LN-11:** PostgreSQL `json_agg()` with an `ORDER BY` clause inside the aggregate requires the `ORDER BY` inside the parens: `json_agg(... ORDER BY col)`. This replaced Supabase's nested relation syntax `question_choices(option_key, label, display_order)`.
- **LN-12:** `pg` npm package automatically parses JSONB columns to JS objects and TEXT[] to JS string arrays — same behavior as Supabase JS client. No manual JSON.parse() needed in repositories.
- **LN-13:** Integration test pool cleanup needs `afterAll(() => pool.end())` to release connections cleanly. Without it Vitest reports open handles and may hang.
- **LN-18:** When multiple `describe` blocks share the same `pg.Pool` instance, `pool.end()` must be called in a single top-level `afterAll`, not inside each describe's `afterAll`. Calling it in multiple places causes "Cannot use a pool after calling end" and "Called end on pool more than once" errors in Vitest.
- **LN-19:** Integration test fixtures that exercise FK-constrained columns must use real DB-resident values, not synthetic strings. `intake.test.ts` used `questionId: 'situation'` (a category name) where the schema requires a UUID FK to `questions.id`. The fix: fetch real question UUIDs from `GET /api/v1/intake/questions` in `beforeAll` and use the first option of each question as the test answer.

---

## Phase 3 — Python Services

### Files Changed
| File | Change | Status |
|---|---|---|
| `services/requirements.txt` | `supabase` removed; `psycopg2-binary>=2.9.0`, `pgvector>=0.3.0` added | ✓ |
| `services/rag/indexer.py` | Supabase client → psycopg2 with `register_vector`, `autocommit=True`, `execute_values` | ✓ |
| `services/rag/retriever.py` | Supabase RPC → psycopg2 `RealDictCursor` SQL call | ✓ |
| `services/.env.example` | `SUPABASE_*` → `DATABASE_URL` | ✓ |

### Learnings — Phase 3
- **LN-14:** `register_vector(conn)` from `pgvector.psycopg2` MUST be called immediately after `psycopg2.connect()` before any query that reads or writes a `vector` column. Without it, psycopg2 cannot serialize/deserialize vector values and raises a type error at runtime.
- **LN-15:** psycopg2 defaults to `autocommit=False` (all statements in implicit transactions). For the RAG indexer, `conn.autocommit = True` is the right setting — batch upserts are idempotent and don't need rollback semantics. If autocommit were left off, all ingested data would silently roll back on connection close.
- **LN-16:** `psycopg2.extras.execute_values` with ON CONFLICT DO UPDATE works with vector parameters only after `register_vector` is called. The rows tuple can contain a plain Python `list[float]` for the vector column.
- **LN-17:** The duplicate `requirements.txt` entries (all packages listed twice) were a pre-existing bug. Cleaned up as part of this migration.

---

## Phase 4 — RAG Re-indexing

### Steps Completed
| Step | Status | Notes |
|---|---|---|
| Run indexer (local mode) | DONE | 13 files, 78 chunks, 0 errors |
| Apply `008_hnsw_index.sql` | DONE | `CREATE INDEX USING hnsw` on `rag_chunks.embedding` |
| Retriever smoke test | DONE | `match_rag_chunks` returns 3 results, top similarity 0.576 for "nursing career pathway healthcare" |

### Verification SQL Results
| Query | Expected | Actual |
|---|---|---|
| `SELECT COUNT(*) FROM rag_documents` | 13 | 13 ✓ |
| `SELECT COUNT(*) FROM rag_chunks` | 78 | 78 ✓ |

### Learnings — Phase 4
- **LN-20:** `conn.autocommit = True` must be set BEFORE `register_vector(conn)`. `register_vector` issues a query that starts a transaction; setting `autocommit` inside an open transaction raises `psycopg2.ProgrammingError: set_session cannot be used inside a transaction`.
- **LN-21:** PDF chunks are extracted as a single chunk per file with the current `pdf_parser`. This is a pre-existing limitation — each PDF produces 1 chunk. Excel files chunk by row (17-18 chunks each). RAG quality for PDF content may be limited until the parser is improved.

## Phase 5 — End-to-End Verification

### Steps Completed
| Step | Status | Notes |
|---|---|---|
| Start Python service (port 8000) | DONE | uvicorn, `GET /health → ok` |
| Start backend (port 4000) | DONE | tsx, `GET /health → ok` |
| `POST /sessions/start` | DONE | sessionId returned ✓ |
| `GET /intake/questions` | DONE | 7 seed questions ✓ |
| `POST /intake/followup` | DONE | 3 followup questions returned, 7 session_responses saved ✓ |
| `POST /skills/infer` | DONE | 9 skills (6 high confidence) ✓ |
| `POST /skills/confirm` | DONE | status: confirmed ✓ |
| `POST /pathways/recommend` | DONE | 3 pathways, sources: Nursing / Rehabilitation / Pharmacy PDFs ✓ |

### Verification Results
| Check | Expected | Actual |
|---|---|---|
| Seed questions | 7 | 7 ✓ |
| Followup questions | 3 | 3 ✓ |
| Skills inferred | ≥1 | 9 (6 high) ✓ |
| Pathways generated | 3 | 3 ✓ |
| RAG sources used | PDF files | Nursing / Rehabilitation / Pharmacy ✓ |
| Integration tests | 12/12 | 12/12 ✓ |

### Learnings — Phase 5
- **LN-22:** PowerShell background jobs (`Start-Job`) do not persist between separate PowerShell tool calls — each tool invocation is a new process. Use `Start-Process` with `-WindowStyle Hidden` for services that must survive across calls.

---

## Deploy Script Changes

| File | Change |
|---|---|
| `scripts/deploy-phase2.ps1` | Secrets: `SUPABASE-URL`+`SUPABASE-SERVICE-KEY` → `DATABASE-URL` |
| `scripts/deploy-phase4.ps1` | Secret refs and env vars: Supabase → `DATABASE_URL` |
| `scripts/deploy-phase5.ps1` | RAG job secret refs and env vars: Supabase → `DATABASE_URL` |
| `scripts/deploy-outputs.json` | Flattened to match script-expected format; added `DATABASE-URL` URI; added `db_server_name`, `db_host`, `db_location` |
| `scripts/run_migrations.py` | **New** — Python-based migration runner (replaces `az postgres flexible-server execute` which is not available in the installed CLI version) |

---

## Rollback Plan
Supabase instance untouched throughout. To roll back:
1. Restore `.env` files with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
2. Revert `backend/src/db/client.ts` and `config.ts` to Supabase client
3. Revert 4 repositories
4. Revert `services/rag/indexer.py` and `retriever.py`
5. All data safe in Supabase — no data loss on rollback
