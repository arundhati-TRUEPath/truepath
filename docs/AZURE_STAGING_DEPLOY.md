# Azure Staging Deployment Plan — TruePath

## Target Environment
- **Subscription**: Gitlab TRUE Path DevOps (`b84e832c-ee7f-4b32-90d0-de721fed1a30`)
- **Resource Group**: `Gitlab_TRUE_Path_rg`
- **Environment name**: `truepath-staging-env`
- **External services (unchanged)**: Supabase Cloud, OpenAI API

---

## Architecture

```
Internet
    │  HTTPS
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Container Apps Environment: truepath-staging-env               │
│                                                                 │
│  [truepath-frontend]  ← External HTTPS ingress (public)        │
│    Next.js :3000  |  minReplicas: 1  |  maxReplicas: 3         │
│    Rewrites /api/* → http://truepath-backend (internal)         │
│                                                                 │
│  [truepath-backend]   ← Internal only                          │
│    Express :4000  |  minReplicas: 1  |  maxReplicas: 3         │
│    → calls truepath-python (internal)                           │
│    → calls Supabase (external)                                  │
│    → calls OpenAI (external)                                    │
│                                                                 │
│  [truepath-python]    ← Internal only                           │
│    FastAPI :8000  |  minReplicas: 1  |  maxReplicas: 3         │
│    → calls Supabase (external)                                  │
│    → calls OpenAI (external)                                    │
│                                                                 │
│  [truepath-rag-job]   ← Scheduled Job (no ingress)              │
│    Python indexer                                               │
│    Schedule: 0 6 * * * UTC  |  on-demand trigger supported     │
│    → reads from Azure Blob Storage (rag-data container)         │
│    → writes vectors to Supabase pgvector                        │
└─────────────────────────────────────────────────────────────────┘

Supporting resources (same resource group):
  truepathacr           Azure Container Registry  (image store)
  truepath-kv           Azure Key Vault           (secrets)
  truepathstorage       Azure Blob Storage        (rag-data container)
  truepath-logs         Log Analytics Workspace   (container logs)
```

### Key design decisions
- **Next.js as API proxy**: Next.js rewrites `/api/*` to the internal Express service.
  Express and Python are never exposed to the internet. Single public HTTPS endpoint.
  `BACKEND_URL` is a server-side runtime env var — not baked at Next.js build time.
- **Scale**: All services at `minReplicas: 1` for staging (no cold starts).
  Production may increase further based on load.
- **Secrets**: All sensitive values stored in Key Vault, referenced via Managed Identity.
  Nothing in env files or source code.

---

## Non-Negotiable Rule
> After every phase, restart the local dev server and verify the app works end-to-end
> before proceeding to the next phase. Do not break local dev.

---

## Phase 1 — Code Changes (local only, no Azure required)

> **Status: COMPLETE** — [Verification log](deploy-logs/phase1-verification.md)

### 1.1 — Next.js: standalone build output + API proxy rewrite
- [x] `frontend/next.config.ts` — `output: 'standalone'` (was already present); `rewrites()` added
- [x] `frontend/.env.local` — `BACKEND_URL=http://localhost:4000` added; `NEXT_PUBLIC_API_BASE_URL` removed
- [x] `frontend/src/lib/api/client.ts` — Axios `baseURL` changed to `''` (same-origin via proxy)
- [x] `frontend/src/lib/api/endpoints.ts` — `pathwaysPdfUrl()` returns relative path; no longer baked at build time

### 1.2 — RAG indexer: cloud/local mode switch
- [x] `services/rag/indexer.py` — `STORAGE_MODE` branch added (`azure` downloads via `DefaultAzureCredential`; `local` unchanged)
- [x] `services/requirements.txt` — `azure-storage-blob>=12.0.0` and `azure-identity>=1.17.0` added
- [x] `services/run_indexer.py` — entry point created; exits `1` on any file error so Azure marks job failed

### 1.3 — Dockerfiles
- [x] `frontend/Dockerfile` — 3-stage multi-stage build with Next.js standalone runner
- [x] `backend/Dockerfile` — 2-stage multi-stage build; `npm ci --omit=dev` in runner
- [x] `services/Dockerfile` — `python:3.11-slim`, pip install, uvicorn

### 1.4 — .dockerignore files
- [x] `frontend/.dockerignore`, `backend/.dockerignore`, `services/.dockerignore` — created

### 1.5 — Local verification (non-negotiable)
- [x] Local dev server restarted (`./start.ps1`)
- [x] Full flow verified: intake (7 questions) → followup (3 questions) → skills (9 inferred) → pathways (3, top: CNA → LPN → RN) → PDF (200 OK, application/pdf, 5885 bytes)
- [x] All 8 API calls confirmed going through `:3000` proxy — none hitting `:4000` directly
- [x] No regressions

---

## Phase 2 — Azure Infrastructure Setup

> **Status: COMPLETE** — [Verification & Learnings log](deploy-logs/phase2-verification.md)
>
> **Automation script**: `scripts/deploy-phase2.ps1` — run this instead of manual commands.
> It reads secrets from `backend/.env`, creates all resources, and writes all output IDs/URIs
> to `scripts/deploy-outputs.json` (consumed by Phase 3 and Phase 4 scripts).

### Prerequisites (must be done before running the script)

```powershell
# 1. Install Azure CLI
winget install Microsoft.AzureCLI
# Open a new terminal after install so PATH refreshes

# 2. Log in and install required extensions
az login
az extension add --name containerapp

# 3. Install Docker Desktop
# https://www.docker.com/products/docker-desktop/
# Required for Phase 3 — install now so it's ready
docker --version
```

> **Alternative**: use Azure Cloud Shell (https://shell.azure.com) — az CLI is pre-installed.
> Upload `scripts/deploy-phase2.ps1` and `backend/.env` to the shell, then run.

### 2.1 — Subscription context
- [ ] `az account set --subscription b84e832c-ee7f-4b32-90d0-de721fed1a30`
- [ ] `az account show` — verify correct subscription is active

### 2.2 — Azure Container Registry
- [ ] `az acr create --name truepathacr --resource-group Gitlab_TRUE_Path_rg --sku Basic --admin-enabled true`
- [ ] Note the login server: `truepathacr.azurecr.io`
- [ ] **Contingency**: if name taken, use `truepathacrstg` — update `deploy-outputs.json`

### 2.3 — Log Analytics Workspace
- [ ] `az monitor log-analytics workspace create --workspace-name truepath-logs --resource-group Gitlab_TRUE_Path_rg --location eastus`
- [ ] Note the workspace ID (captured automatically by script)

### 2.4 — Container Apps Environment
- [ ] `az containerapp env create --name truepath-staging-env ...` (see script)
- [ ] Environment created and in `Succeeded` state

### 2.5 — Key Vault + secrets
- [ ] `az keyvault create --name truepath-kv ...` (if name taken, use `truepath-kv-stg`)
- [ ] `OPENAI-API-KEY` stored
- [ ] `SUPABASE-URL` stored
- [ ] `SUPABASE-SERVICE-KEY` stored
- [ ] Secret version-less URIs captured in `deploy-outputs.json`

### 2.6 — Storage Account + blob container (RAG data)
- [ ] Storage account `truepathstorage` created (Standard_LRS)
- [ ] `rag-data` blob container created

### 2.7 — Managed Identity
- [ ] Identity `truepath-staging-id` created
- [ ] `AcrPull` on ACR assigned
- [ ] `Key Vault Secrets User` on Key Vault assigned
- [ ] `Storage Blob Data Contributor` on Storage Account assigned
- [ ] All IDs captured in `deploy-outputs.json`

### 2.8 — Local verification (non-negotiable)
- [ ] Run `./start.ps1` to confirm local dev still works after any env changes
- [ ] Full wizard flow end-to-end passes (Phase 2 touches no local code — this is a sanity check)

---

## Phase 3 — Build & Push Docker Images

> **No local Docker required.** Uses `az acr build` (ACR Tasks) — source is uploaded from Cloud Shell
> and built inside Azure. Run via `scripts/deploy-phase3.ps1`.
>
> **Automation script**: `scripts/deploy-phase3.ps1` — reads ACR name from `scripts/deploy-outputs.json`.

### Run the script

```powershell
# Cloud Shell — upload deploy-phase3.ps1 + deploy-outputs.json, then:
./deploy-phase3.ps1
```

The script resolves the repo automatically:
- If running from inside the cloned repo → uses it in place
- Otherwise → clones `https://github.com/arundhati-TRUEPath/truepath.git` into `~/truepath-src`
  (or `git pull` if the clone already exists)

The script builds and pushes all three images using `az acr build`:
- `truepath-frontend:staging` from `./frontend`
- `truepath-backend:staging` from `./backend`
- `truepath-python:staging` from `./services`

- [ ] All 3 images build without errors
- [ ] All 3 images appear in ACR (`az acr repository list --name truepathacr`)

### Local verification (non-negotiable)
- [ ] Confirm local dev server still works (`./start.ps1`) — `az acr build` never touches local files

---

## Phase 4 — Deploy Container Apps

> Deploy order: python → backend → frontend (each depends on the one below it)

### 4.1 — Python Services (internal ingress)
```bash
az containerapp create \
  --name truepath-python \
  --resource-group Gitlab_TRUE_Path_rg \
  --environment truepath-staging-env \
  --image truepathacr.azurecr.io/truepath-python:staging \
  --registry-server truepathacr.azurecr.io \
  --user-assigned <identity-resource-id> \
  --registry-identity <identity-resource-id> \
  --ingress internal --target-port 8000 \
  --min-replicas 1 --max-replicas 3 \
  --secrets "openai-key=keyvaultref:<kv-secret-uri>,identityref:<identity-resource-id>" \
            "supabase-url=keyvaultref:<kv-secret-uri>,identityref:<identity-resource-id>" \
            "supabase-key=keyvaultref:<kv-secret-uri>,identityref:<identity-resource-id>" \
  --env-vars "OPENAI_API_KEY=secretref:openai-key" \
             "SUPABASE_URL=secretref:supabase-url" \
             "SUPABASE_SERVICE_KEY=secretref:supabase-key" \
             "STORAGE_MODE=local"
```
- [ ] Container App created, status `Running`
- [ ] Health endpoint reachable internally: `GET /health` returns 200

### 4.2 — Express Backend (internal ingress)
```bash
az containerapp create \
  --name truepath-backend \
  --resource-group Gitlab_TRUE_Path_rg \
  --environment truepath-staging-env \
  --image truepathacr.azurecr.io/truepath-backend:staging \
  --registry-server truepathacr.azurecr.io \
  --user-assigned <identity-resource-id> \
  --registry-identity <identity-resource-id> \
  --ingress internal --target-port 4000 \
  --min-replicas 1 --max-replicas 3 \
  --secrets "openai-key=keyvaultref:..." "supabase-url=keyvaultref:..." "supabase-key=keyvaultref:..." \
  --env-vars "OPENAI_API_KEY=secretref:openai-key" \
             "SUPABASE_URL=secretref:supabase-url" \
             "SUPABASE_SERVICE_KEY=secretref:supabase-key" \
             "PYTHON_SERVICES_URL=http://truepath-python" \
             "CORS_ORIGIN=https://truepath-frontend.<env-domain>" \
             "PORT=4000" \
             "NODE_ENV=production"
```
- [ ] Container App created, status `Running`

### 4.3 — Next.js Frontend (external ingress)
```bash
az containerapp create \
  --name truepath-frontend \
  --resource-group Gitlab_TRUE_Path_rg \
  --environment truepath-staging-env \
  --image truepathacr.azurecr.io/truepath-frontend:staging \
  --registry-server truepathacr.azurecr.io \
  --user-assigned <identity-resource-id> \
  --registry-identity <identity-resource-id> \
  --ingress external --target-port 3000 \
  --min-replicas 1 --max-replicas 3 \
  --env-vars "BACKEND_URL=http://truepath-backend" \
             "NODE_ENV=production" \
             "NEXT_TELEMETRY_DISABLED=1"
```
- [ ] Container App created, status `Running`
- [ ] Note public URL from `az containerapp show` → `properties.configuration.ingress.fqdn`

---

## Phase 5 — RAG Scheduled Job

### 5.1 — Upload RAG source files to blob storage
```bash
az storage blob upload-batch \
  --destination rag-data \
  --source ./rag-data \
  --account-name truepathstorage \
  --auth-mode login
```
- [ ] Files uploaded — verify with `az storage blob list --container-name rag-data --account-name truepathstorage`

### 5.2 — Create Container Apps Job
```bash
az containerapp job create \
  --name truepath-rag-job \
  --resource-group Gitlab_TRUE_Path_rg \
  --environment truepath-staging-env \
  --image truepathacr.azurecr.io/truepath-python:staging \
  --registry-server truepathacr.azurecr.io \
  --user-assigned <identity-resource-id> \
  --registry-identity <identity-resource-id> \
  --trigger-type Schedule \
  --cron-expression "0 6 * * *" \
  --replica-timeout 1800 \
  --secrets "openai-key=keyvaultref:..." "supabase-url=keyvaultref:..." "supabase-key=keyvaultref:..." \
  --env-vars "OPENAI_API_KEY=secretref:openai-key" \
             "SUPABASE_URL=secretref:supabase-url" \
             "SUPABASE_SERVICE_KEY=secretref:supabase-key" \
             "STORAGE_MODE=azure" \
             "AZURE_STORAGE_ACCOUNT_NAME=truepathstorage" \
             "AZURE_STORAGE_CONTAINER=rag-data" \
  --command "python" "run_indexer.py"
```
- [ ] Job created
- [ ] Trigger manual run: `az containerapp job start --name truepath-rag-job --resource-group Gitlab_TRUE_Path_rg`
- [ ] Job completes successfully (check execution logs in Log Analytics)
- [ ] Supabase `rag_chunks` table populated — verify row count

---

## Phase 6 — Staging Validation Checklist

- [ ] Frontend loads at `https://<fqdn>.azurecontainerapps.io`
- [ ] Intake questions load (Supabase read)
- [ ] Followup questions generate (OpenAI call via Express)
- [ ] Skills page renders correctly
- [ ] Pathways page renders with RAG context
- [ ] PDF downloads successfully
- [ ] No CORS errors in browser console
- [ ] Logs visible in Azure portal → Container Apps → Log stream
- [ ] Log Analytics shows structured JSON logs from all 3 services

---

## Environment Variables Reference

| Variable | Service | Source | Example |
|---|---|---|---|
| `NEXT_PUBLIC_ENV` | frontend | env | `staging` |
| `BACKEND_URL` | frontend | env | `http://truepath-backend` |
| `PORT` | backend | env | `4000` |
| `NODE_ENV` | backend | env | `production` |
| `CORS_ORIGIN` | backend | env | `https://<frontend-fqdn>` |
| `PYTHON_SERVICES_URL` | backend | env | `http://truepath-python` |
| `OPENAI_API_KEY` | backend, python | Key Vault | — |
| `OPENAI_MODEL` | backend | env | `gpt-4o` |
| `OPENAI_FOLLOWUP_MODEL` | backend | env | `gpt-4.1-mini` |
| `OPENAI_EMBEDDING_MODEL` | backend | env | `text-embedding-3-small` |
| `OPENAI_SKILLS_MODEL` | backend | env | `gpt-4.1-mini` |
| `SUPABASE_URL` | backend, python | Key Vault | — |
| `SUPABASE_SERVICE_KEY` | backend, python | Key Vault | — |
| `STORAGE_MODE` | python (rag-job) | env | `azure` |
| `AZURE_STORAGE_ACCOUNT_NAME` | python (rag-job) | env | `truepathstorage` |
| `AZURE_STORAGE_CONTAINER` | python (rag-job) | env | `rag-data` |

---

## Future: Production Promotion Checklist (not in scope yet)

- [ ] Increase minReplicas based on load testing results
- [ ] Switch Supabase → Azure Database for PostgreSQL + pgvector
- [ ] Switch OpenAI API → Azure OpenAI Service
- [ ] Custom domain + Azure-managed TLS certificate
- [ ] Azure Front Door or API Management for rate limiting
- [ ] CI/CD pipeline (GitLab CI or GitHub Actions) for automated image builds + deploys
- [ ] Blue/green or canary deployment strategy
- [ ] Automated smoke tests post-deploy
