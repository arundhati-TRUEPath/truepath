# Azure PostgreSQL Migration Checklist
## Supabase → Azure Database for PostgreSQL Flexible Server

**Target:** Azure Database for PostgreSQL Flexible Server (West US 2)  
**Strategy:** Single PostgreSQL instance handles both relational + vector (pgvector) workloads  
**Migration type:** Client-layer swap only — schema, SQL, and business logic unchanged

> This checklist was critique-reviewed for correctness. Critique findings are marked [CRITIQUE FIX].

---

## Phase 0 — Pre-Migration Preparation

- [ ] **0.1** Export a full backup from Supabase using `pg_dump` directly (not `supabase db dump` — the CLI may miss migration 005's DDL and the match_rag_chunks function)
  ```bash
  pg_dump "postgresql://postgres:<password>@db.oqcthtuqvkphclwvalsf.supabase.co:5432/postgres" \
    --schema=public > supabase_backup_$(date +%Y%m%d).sql
  ```
  After dumping, open the file and verify that `rag_documents`, `rag_chunks`, and `match_rag_chunks` are present. These come from missing migration 005 which was applied in Supabase but never committed to the repo. [CRITIQUE FIX I3]

- [ ] **0.2** Provision Azure Database for PostgreSQL Flexible Server
  - Region: West US 2 (closest to King County, WA)
  - Tier: Burstable B2ms (2 vCores, 8 GB RAM)
  - Storage: 32 GB with auto-grow enabled
  - PostgreSQL version: 16 (matches Supabase default)

- [ ] **0.3** Enable required extensions on Azure PostgreSQL
  - Azure Portal → your server → Server Parameters → search `azure.extensions`
  - Set value to: `vector,uuid-ossp` (lowercase — Azure parameter is case-sensitive; uppercase silently fails and `CREATE EXTENSION vector` will error with "not in allowlist") [CRITIQUE FIX C1]
  - Save and wait for the change to apply (no server restart needed)
  - The `CREATE EXTENSION IF NOT EXISTS vector;` in migration 005 will then succeed

- [ ] **0.4** Configure Azure PostgreSQL firewall rules
  - Allow Azure services (for Express backend on Azure App Service)
  - Allow your dev machine IP (for running migrations locally and testing)
  - For production: use VNet private endpoint (same VNet as Azure Blob Storage already in use)

- [ ] **0.5** Collect the `DATABASE_URL` connection string from Azure Portal
  - Format: `postgresql://<adminUser>@<server>:<password>@<host>.postgres.database.azure.com:5432/<dbname>?sslmode=require`
  - The `?sslmode=require` suffix is mandatory — Azure Flexible Server rejects plaintext connections [CRITIQUE FIX I4]
  - Store in Azure Key Vault for production; in `.env` for local dev only (never commit)

**Verification 0:**
```bash
psql "$DATABASE_URL" -c "SELECT version();"
# Expected: PostgreSQL 16.x on Azure
psql "$DATABASE_URL" -c "SHOW azure.extensions;"
# Expected: value includes 'vector'
```

---

## Phase 1 — Database Schema Migration

> **Critical gap:** Migration `005_rag_tables.sql` was never committed to the repo — it exists only in Supabase. It must be reconstructed before running on Azure.

- [ ] **1.1** Reconstruct and commit `backend/db/migrations/005_rag_tables.sql`
  ```sql
  -- Migration 005: RAG document store and vector chunks
  -- RECONSTRUCTED: this migration was applied in Supabase but never committed
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS rag_documents (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name    TEXT        NOT NULL UNIQUE,
    file_type    TEXT        NOT NULL CHECK (file_type IN ('pdf', 'excel')),
    source_path  TEXT        NOT NULL,
    chunk_count  INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS rag_chunks (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID         NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    chunk_index  INTEGER      NOT NULL,
    content      TEXT         NOT NULL,
    embedding    vector(1536) NOT NULL,
    metadata     JSONB        NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
  );

  CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
  ALTER TABLE rag_documents DISABLE ROW LEVEL SECURITY;
  ALTER TABLE rag_chunks    DISABLE ROW LEVEL SECURITY;
  ```
  > `vector(1536)` matches `text-embedding-3-small` output dimension.
  > Cross-check against the Supabase backup from step 0.1 — if Supabase's actual schema differs (e.g., column names, constraints), the backup is authoritative.

- [ ] **1.2** Create `backend/db/migrations/007_match_rag_chunks_fn.sql`
  ```sql
  -- Migration 007: cosine similarity search function
  -- Replaces the match_rag_chunks RPC that Supabase auto-generated from pgvector
  CREATE OR REPLACE FUNCTION match_rag_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count     int
  )
  RETURNS TABLE (
    id          uuid,
    document_id uuid,
    chunk_index integer,
    content     text,
    metadata    jsonb,
    file_name   text,
    similarity  float
  )
  LANGUAGE sql STABLE
  AS $$
    SELECT
      rc.id,
      rc.document_id,
      rc.chunk_index,
      rc.content,
      rc.metadata,
      rd.file_name,
      1 - (rc.embedding <=> query_embedding) AS similarity
    FROM rag_chunks rc
    JOIN rag_documents rd ON rd.id = rc.document_id
    WHERE 1 - (rc.embedding <=> query_embedding) > match_threshold
    ORDER BY rc.embedding <=> query_embedding
    LIMIT match_count;
  $$;
  ```

- [ ] **1.3** Create `backend/db/migrations/008_hnsw_index.sql` — **run this AFTER data is loaded in Phase 4, not now**
  ```sql
  -- Migration 008: HNSW index for fast approximate nearest-neighbour vector search
  -- Build after data load: HNSW construction is faster on a populated table
  CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
    ON rag_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  ```

- [ ] **1.4** Run migrations in sequence on Azure PostgreSQL
  ```bash
  for f in 001 002 003 004 005 006 007; do
    psql "$DATABASE_URL" -f "backend/db/migrations/${f}_*.sql"
  done
  # Run 008 only after Phase 4 (RAG re-indexing) completes
  ```
  > Migration 003 drops and recreates questions/choices/responses tables (001's tables go away) then inserts 7 seed questions inline. This is expected on a fresh DB.
  > Migration 002 (`DISABLE ROW LEVEL SECURITY`) is harmless on plain PostgreSQL (RLS is off by default) but runs cleanly before 003 drops those tables. [CRITIQUE FIX I2]
  > Do NOT run `backend/db/seeds/001_questions.sql` — migration 003 already contains all seed data. Running both creates duplicates.

**Verification 1:**
```sql
-- Run against Azure PostgreSQL
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- Expected: question_choices, questions, rag_chunks, rag_documents,
--           session_pathways, session_responses, session_skills, sessions

SELECT proname FROM pg_proc WHERE proname = 'match_rag_chunks';
-- Expected: 1 row

SELECT count(*) FROM questions WHERE source = 'seed';
-- Expected: 7

SELECT extname FROM pg_extension WHERE extname = 'vector';
-- Expected: 1 row (vector extension installed)
```

---

## Phase 2 — TypeScript Backend: Replace Supabase Client

> **Pre-flight grep** — before touching any code, run this to get the full list of Supabase call sites: [CRITIQUE FIX M3]
> ```bash
> grep -r "supabase\|SUPABASE_" backend/src/ --include="*.ts" -l
> ```
> Expected files: db/client.ts, config.ts, all 4 repos, sessions.test.ts, intake.test.ts

- [ ] **2.1** Update `backend/package.json`
  - Move `pg` from `devDependencies` to `dependencies` (already in devDeps — just move it)
  - Remove `@supabase/supabase-js` from `dependencies`
  - `@types/pg` can stay in `devDependencies`
  - Run `npm install` to update `package-lock.json`

- [ ] **2.2** Rewrite `backend/src/db/client.ts`
  ```typescript
  import { Pool } from 'pg';
  import { config } from '../config';

  export const pool = new Pool({
    connectionString: config.database.url,
    ssl: { rejectUnauthorized: true },   // Azure uses DigiCert — valid public CA, no need to disable verification
    max: 10,                              // Azure B2ms default max_connections ~100; keep pool well under that
  });
  ```
  > Do NOT use `ssl: { rejectUnauthorized: false }` — that disables TLS verification entirely. Azure uses a valid public CA cert. [CRITIQUE FIX I1]

- [ ] **2.3** Rewrite `backend/src/config.ts`
  - Remove `supabase: { url, serviceKey }` block
  - Add `database: { url: requireEnv('DATABASE_URL') }`

- [ ] **2.4** Rewrite `backend/src/repositories/sessions.repo.ts` (4 functions → raw SQL)
  - `createSession` → `INSERT INTO sessions (status) VALUES ('in_progress') RETURNING id, created_at, status`
  - `saveResponses` → parameterized bulk INSERT (loop or unnest)
  - `updateSessionStatus` → `UPDATE sessions SET status = $1, updated_at = now() WHERE id = $2`
  - `getSessionQA` → JOIN across session_responses, questions, question_choices

- [ ] **2.5** Rewrite `backend/src/repositories/questions.repo.ts` (2 functions → raw SQL)
  - `getAllSeedQuestions` → SELECT with LEFT JOIN to question_choices, ORDER BY display_order
  - `insertFollowupQuestions` → INSERT questions + choices wrapped in a `BEGIN`/`COMMIT` transaction

- [ ] **2.6** Rewrite `backend/src/repositories/skills.repo.ts` (4 functions → raw SQL)
  - `saveSkills` → bulk INSERT
  - `getSkills` / `getConfirmedSkills` → SELECT with optional `AND confirmed = true`
  - `confirmSkills` → two-step UPDATE in one transaction: reset all to false, then set ids to true

- [ ] **2.7** Rewrite `backend/src/repositories/pathways.repo.ts` (2 functions → raw SQL)
  - `getPathways` → SELECT returning JSONB columns; return null if no rows
  - `savePathways` → `INSERT INTO session_pathways (...) ON CONFLICT (session_id) DO UPDATE SET ...`

- [ ] **2.8** Update `backend/src/routes/sessions.test.ts` and `intake.test.ts`
  - Replace `db.from('sessions').delete()` cleanup with `pool.query('DELETE FROM sessions WHERE id = ANY($1)', [ids])`
  - Import `pool` from `../db/client`
  - Add `afterAll(() => pool.end())` to each test suite to release pool connections cleanly [CRITIQUE FIX M4]

- [ ] **2.9** Update `backend/.env.example` and `backend/.env`
  - Remove `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
  - Add `DATABASE_URL=postgresql://<user>@<server>:<password>@<host>.postgres.database.azure.com:5432/<db>?sslmode=require`

**Verification 2:**
```bash
cd backend
npm run type-check    # tsc --noEmit — must report zero errors
npm run test          # all integration tests against Azure PostgreSQL
```

---

## Phase 3 — Python Services: Replace Supabase Client

- [ ] **3.1** Update `services/requirements.txt`
  - Remove `supabase>=2.10.0`
  - Add `psycopg2-binary>=2.9.0` [CRITIQUE FIX M2 — 2.9.9 doesn't exist; use 2.9.0]
  - Add `pgvector>=0.3.0` [CRITIQUE FIX M2 — 0.3.6 doesn't exist; use 0.3.0]
  - `azure-storage-blob` and `azure-identity` remain unchanged (no Supabase dependency there)

- [ ] **3.2** Rewrite `services/rag/indexer.py`
  ```python
  import psycopg2
  import psycopg2.extras
  from pgvector.psycopg2 import register_vector

  def _connect():
      conn = psycopg2.connect(os.environ["DATABASE_URL"])
      register_vector(conn)   # MUST be called before any vector query [CRITIQUE FIX C2]
      conn.autocommit = True  # prevent silent rollback on connection close [CRITIQUE FIX C3]
      return conn
  ```
  - Replace `.table("rag_documents").upsert(...)` with `INSERT INTO rag_documents ... ON CONFLICT (file_name) DO UPDATE`
  - Replace `.table("rag_chunks").upsert(...)` with `psycopg2.extras.execute_values(cur, "INSERT INTO rag_chunks ... ON CONFLICT (document_id, chunk_index) DO UPDATE ...", rows)`
  - With `autocommit=True`, each statement commits immediately — appropriate for batch indexing

- [ ] **3.3** Rewrite `services/rag/retriever.py`
  ```python
  import psycopg2
  from pgvector.psycopg2 import register_vector

  def _connect():
      conn = psycopg2.connect(os.environ["DATABASE_URL"])
      register_vector(conn)   # required for vector parameter serialization [CRITIQUE FIX C2]
      return conn

  def retrieve(query, top_k=5, threshold=0.5):
      from pgvector import Vector
      embedding = embed_text(query)
      conn = _connect()
      with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
          cur.execute(
              "SELECT * FROM match_rag_chunks(%s::vector, %s, %s)",
              [embedding, threshold, top_k]
          )
          return cur.fetchall() or []
  ```
  > `register_vector` is required before passing a Python list as a `vector` parameter — without it psycopg2 will raise a type error at runtime. [CRITIQUE FIX C2]

- [ ] **3.4** Update `services/.env.example` and `services/.env`
  - Remove `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
  - Add `DATABASE_URL=postgresql://...?sslmode=require`

**Verification 3:**
```bash
cd services
pip install -r requirements.txt
python -c "
import os; os.environ['DATABASE_URL'] = 'postgresql://test'
from rag.indexer import build_index
from rag.retriever import retrieve
print('imports ok')
"
```

---

## Phase 4 — RAG Re-indexing

- [ ] **4.1** Confirm Azure Blob Storage env vars are present (no change — already used)
  - `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_CONTAINER`, `AZURE_CLIENT_ID`

- [ ] **4.2** Run the indexer against Azure PostgreSQL
  ```bash
  cd services
  STORAGE_MODE=azure DATABASE_URL="$DATABASE_URL" python run_indexer.py
  ```

- [ ] **4.3** Build the HNSW index after data is loaded
  ```bash
  psql "$DATABASE_URL" -f backend/db/migrations/008_hnsw_index.sql
  ```

**Verification 4:**
```sql
SELECT count(*) FROM rag_chunks;        -- must be > 0
SELECT count(*) FROM rag_documents;     -- must be > 0
-- Smoke test the function with a real vector:
SELECT file_name, similarity
FROM match_rag_chunks(
  (SELECT embedding FROM rag_chunks LIMIT 1),
  0.5,
  3
);
-- Expected: up to 3 rows with similarity > 0.5
```

---

## Phase 5 — End-to-End Verification

- [ ] **5.1** Start both services locally pointed at Azure PostgreSQL
  ```bash
  # Terminal 1 — Python FastAPI
  cd services && DATABASE_URL="$DATABASE_URL" uvicorn main:app --reload --port 8000

  # Terminal 2 — Express backend
  cd backend && npm run dev
  ```

- [ ] **5.2** Run the full integration test suite
  ```bash
  cd backend && npm run test
  # All tests must pass
  ```

- [ ] **5.3** Manual smoke test — complete session flow
  ```bash
  # 1. Start session
  curl -s -X POST http://localhost:4000/api/v1/sessions/start | jq
  # → 201 { data: { sessionId: "<uuid>" }, error: null, meta: null }

  # 2. Get seed questions
  curl -s http://localhost:4000/api/v1/intake/questions | jq '.data | length'
  # → 7

  # 3. Submit intake (triggers LLM + saves responses)
  SESSION_ID="<uuid from step 1>"
  curl -s -X POST http://localhost:4000/api/v1/intake/followup \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"$SESSION_ID\",\"answers\":[{\"questionId\":\"situation\",\"optionIds\":[\"changer\"]},{\"questionId\":\"education\",\"optionIds\":[\"ba\"]},{\"questionId\":\"timeframe\",\"optionIds\":[\"6m\"]},{\"questionId\":\"schedule\",\"optionIds\":[\"days\"]},{\"questionId\":\"environment\",\"optionIds\":[\"bedside\"]},{\"questionId\":\"support\",\"optionIds\":[\"transit\"]},{\"questionId\":\"location\",\"optionIds\":[\"seattle\"]}]}" | jq
  # → 200 with 3 followup questions

  # 4. RAG semantic search (Python service)
  curl -s -X POST http://localhost:8000/search \
    -H "Content-Type: application/json" \
    -d '{"query":"CNA training programs King County","top_k":5,"threshold":0.5}' | jq
  # → 200 { results: [...], count: N } where N > 0

  # 5. Pathway generation
  curl -s -X POST http://localhost:4000/api/v1/pathways/generate \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"$SESSION_ID\"}" | jq
  # → 200 with 3 pathway objects
  ```

- [ ] **5.4** Confirm zero remaining Supabase references in source
  ```bash
  grep -r "supabase\|SUPABASE_" backend/src/ services/ \
    --include="*.ts" --include="*.py" -l
  # Expected: no output (zero files)
  ```

- [ ] **5.5** Final TypeScript type check
  ```bash
  cd backend && npm run type-check
  # Expected: zero errors
  ```

---

## Rollback Plan

The Supabase instance is untouched throughout (never dropped, never migrated). To roll back at any point:
1. Restore `.env` files to Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)
2. Revert `backend/src/db/client.ts`, `config.ts`, and the 4 repos to their Supabase versions
3. Revert `services/rag/indexer.py` and `retriever.py` to Supabase client
4. Application is back on Supabase with zero data loss

---

## Summary of All Changed Files

| File | Change |
|---|---|
| `backend/db/migrations/005_rag_tables.sql` | **New** — reconstructed from Supabase backup |
| `backend/db/migrations/007_match_rag_chunks_fn.sql` | **New** — replaces Supabase auto-RPC |
| `backend/db/migrations/008_hnsw_index.sql` | **New** — production HNSW vector index |
| `backend/package.json` | Move `pg` to dependencies; remove `@supabase/supabase-js` |
| `backend/src/config.ts` | Replace `supabase.*` with `database.url` |
| `backend/src/db/client.ts` | Replace Supabase client with `pg.Pool` |
| `backend/src/repositories/sessions.repo.ts` | Rewrite 4 functions to raw SQL |
| `backend/src/repositories/questions.repo.ts` | Rewrite 2 functions to raw SQL |
| `backend/src/repositories/skills.repo.ts` | Rewrite 4 functions to raw SQL |
| `backend/src/repositories/pathways.repo.ts` | Rewrite 2 functions to raw SQL |
| `backend/src/routes/sessions.test.ts` | Replace Supabase cleanup + add pool.end() |
| `backend/src/routes/intake.test.ts` | Replace Supabase cleanup + add pool.end() |
| `backend/.env.example` | Replace `SUPABASE_*` with `DATABASE_URL` |
| `backend/.env` | Replace `SUPABASE_*` with `DATABASE_URL` |
| `services/requirements.txt` | Remove `supabase`; add `psycopg2-binary`, `pgvector` |
| `services/rag/indexer.py` | Replace Supabase client with `psycopg2` |
| `services/rag/retriever.py` | Replace Supabase RPC with `psycopg2` SQL |
| `services/.env.example` | Replace `SUPABASE_*` with `DATABASE_URL` |
| `services/.env` | Replace `SUPABASE_*` with `DATABASE_URL` |

---

## Critique Review Summary

The following issues were found and corrected in this checklist:

| ID | Severity | Issue | Fix Applied |
|---|---|---|---|
| C1 | Critical | `azure.extensions` must use lowercase (`vector,uuid-ossp`) — uppercase silently fails | Step 0.3 updated |
| C2 | Critical | `register_vector(conn)` required before any psycopg2 vector query — omitting causes runtime type error | Steps 3.2, 3.3 updated |
| C3 | Critical | psycopg2 defaults to `autocommit=False` — indexer would silently lose all data on connection close | Step 3.2 updated with `conn.autocommit = True` |
| I1 | Important | `ssl: { rejectUnauthorized: false }` disables TLS verification — Azure uses public CA, no override needed | Step 2.2 updated |
| I2 | Important | Migration 002 is harmless but redundant on plain PostgreSQL (no RLS by default) | Step 1.4 annotated |
| I3 | Important | `supabase db dump` may miss migration 005 DDL — use `pg_dump` directly | Step 0.1 rewritten |
| I4 | Important | `DATABASE_URL` must include `?sslmode=require` — Azure rejects plaintext connections | Steps 0.5, 2.9, 3.4 updated |
| M1 | Minor | HNSW parameters and syntax are correct | No change |
| M2 | Minor | `pgvector>=0.3.6` and `psycopg2-binary>=2.9.9` don't exist as releases | Step 3.1 updated to `>=0.3.0` and `>=2.9.0` |
| M3 | Minor | Supabase grep should be a Phase 2 pre-flight, not Phase 5 | Moved to Phase 2 pre-flight |
| M4 | Minor | Test pool needs `afterAll(() => pool.end())` to avoid open-handle warnings | Step 2.8 updated |
