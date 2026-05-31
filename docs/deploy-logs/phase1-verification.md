# Phase 1 Verification Log

**Date**: 2026-05-31
**Branch**: main
**Status**: PASSED — all steps complete, local dev unaffected

---

## Changes Made

### 1.1 — Next.js API proxy rewrite

| File | Change |
|---|---|
| `frontend/next.config.ts` | Added `rewrites()` — `/api/:path*` → `${BACKEND_URL}/api/:path*`. `output: 'standalone'` was already present. |
| `frontend/.env.local` | Replaced `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` with `BACKEND_URL=http://localhost:4000`. `BACKEND_URL` is server-side only — not baked into the Next.js bundle at build time. |
| `frontend/src/lib/api/client.ts` | Changed Axios `baseURL` from `process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'` to `''`. Browser calls now go to same origin; Next.js rewrites route them to Express. |
| `frontend/src/lib/api/endpoints.ts` | `pathwaysPdfUrl()` no longer reads `NEXT_PUBLIC_API_BASE_URL`. Now returns a relative path (`/api/v1/pathways/export-pdf?...`) that resolves through the proxy in both dev and production. |

**Why this matters for Azure**: `NEXT_PUBLIC_*` vars are baked at Docker build time. Using `BACKEND_URL` (server-side) means the frontend image is environment-agnostic — no rebuild needed to switch staging → production backend URL.

### 1.2 — RAG indexer cloud/local mode

| File | Change |
|---|---|
| `services/rag/indexer.py` | Added `STORAGE_MODE` env var check. `local` (default): reads `rag-data/` as before. `azure`: calls `_download_from_blob()` to pull blobs to a `tempfile.mkdtemp()` dir, processes them, then cleans up with `shutil.rmtree`. Uses `DefaultAzureCredential` — works with managed identity in Azure Container Apps and with `az login` locally. |
| `services/requirements.txt` | Added `azure-storage-blob>=12.0.0` and `azure-identity>=1.17.0`. |
| `services/run_indexer.py` | New entry point for the Container Apps Job. Calls `build_index()`, logs result, exits with code `1` if any files errored (so the job execution is marked failed in Azure). |

### 1.3 — Dockerfiles created

| File | Notes |
|---|---|
| `frontend/Dockerfile` | 3-stage: `deps` (npm ci) → `builder` (next build) → `runner` (standalone server.js). Static files and public dir copied into standalone output. `PORT=3000`, `HOSTNAME=0.0.0.0`. |
| `backend/Dockerfile` | 2-stage: `builder` (npm ci + tsc) → `runner` (npm ci --omit=dev + node dist/index.js). |
| `services/Dockerfile` | Single stage: `python:3.11-slim`, pip install, uvicorn on 0.0.0.0:8000. |

### 1.4 — .dockerignore files created

`frontend/.dockerignore`, `backend/.dockerignore`, `services/.dockerignore` — each excludes node_modules/dist/`__pycache__`, all `.env*` files, `.git`, and `rag-data/`.

---

## Local Verification Results

**Test method**: Programmatic end-to-end flow via PowerShell calling all endpoints through `http://localhost:3000` (the Next.js proxy), not directly to port 4000.

| Step | Endpoint (via :3000 proxy) | Result |
|---|---|---|
| Start session | `POST /api/v1/sessions/start` | Session ID: `2aee8421-96ec-4323-a9de-621ad1f602ed` |
| Load questions | `GET /api/v1/intake/questions` | 7 questions returned |
| Submit seed answers | `POST /api/v1/intake/followup` | 3 followup questions generated |
| Submit followup answers | `POST /api/v1/intake/followup/submit` | status: `complete` |
| Infer skills | `POST /api/v1/skills/infer` | 9 skills inferred |
| Confirm skills | `POST /api/v1/skills/confirm` | OK |
| Recommend pathways | `POST /api/v1/pathways/recommend` | 3 pathways — top: `CNA → LPN → RN` |
| Export PDF | `GET /api/v1/pathways/export-pdf?sessionId=...` | HTTP 200, `application/pdf`, 5885 bytes |

**Proxy confirmed**: All 8 calls went through `localhost:3000` (Next.js rewrite layer) — none called port 4000 directly from the test harness. Express on 4000 and FastAPI on 8000 were only reached via the internal proxy hop.

**Services health at test time**:
- `python:8000` → `200 {"status":"ok"}`
- `backend:4000` → `200 {"status":"ok"}`
- `frontend:3000` → `200` (HTML, 44960 bytes)

---

## Rollback Notes

If this phase needs to be reverted:

1. `frontend/next.config.ts` — remove the `rewrites()` block
2. `frontend/.env.local` — restore `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`, remove `BACKEND_URL`
3. `frontend/src/lib/api/client.ts` — restore `baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'`
4. `frontend/src/lib/api/endpoints.ts` — restore the `pathwaysPdfUrl` function to its original form
5. `services/rag/indexer.py` — remove `_download_from_blob()` and the `STORAGE_MODE` branch
6. `services/requirements.txt` — remove the two azure lines
7. Delete `services/run_indexer.py`, all three `Dockerfile`s, all three `.dockerignore` files
