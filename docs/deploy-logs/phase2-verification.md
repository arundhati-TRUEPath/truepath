# Phase 2 Verification Log

**Date executed**: _pending_
**Executed by**: _pending_
**Script**: `scripts/deploy-phase2.ps1`
**Outputs file**: `scripts/deploy-outputs.json`
**Status**: PENDING — az CLI and Docker not yet installed on this machine

---

## Prerequisites Checklist

| # | Check | Command | Status | Notes |
|---|---|---|---|---|
| P1 | az CLI installed | `az --version` | PENDING | `winget install Microsoft.AzureCLI` |
| P2 | az CLI logged in | `az account show` | PENDING | `az login` after install |
| P3 | containerapp extension | `az extension list` | PENDING | `az extension add --name containerapp` |
| P4 | Docker installed | `docker --version` | PENDING | Install Docker Desktop |
| P5 | `backend/.env` present | `Test-Path backend/.env` | PENDING | Copy from `.env.example`, fill values |

---

## Execution Log

Run `scripts/deploy-phase2.ps1` and fill in the **Actual Output** column as each step completes.

### Step 2.1 — Set subscription context

| Field | Value |
|---|---|
| Command | `az account set --subscription b84e832c-ee7f-4b32-90d0-de721fed1a30` |
| Expected | No output (exit code 0) |
| Verify | `az account show` → name = "Gitlab TRUE Path DevOps" |
| Status | PENDING |
| Actual output | _fill in_ |

---

### Step 2.2 — Azure Container Registry

| Field | Value |
|---|---|
| Command | `az acr create --name truepathacr --resource-group Gitlab_TRUE_Path_rg --sku Basic --admin-enabled true --location eastus` |
| Expected | JSON with `loginServer: "truepathacr.azurecr.io"` |
| Status | PENDING |
| Actual `loginServer` | _fill in_ |
| Actual `id` | _fill in_ |
| Contingency | If name taken → rename to `truepathacrstg`, update `deploy-outputs.json` |

---

### Step 2.3 — Log Analytics Workspace

| Field | Value |
|---|---|
| Command | `az monitor log-analytics workspace create --workspace-name truepath-logs --resource-group Gitlab_TRUE_Path_rg --location eastus` |
| Expected | JSON with `id` and `customerId` |
| Status | PENDING |
| Actual `id` (workspace resource ID) | _fill in_ |
| Actual `customerId` (workspace GUID) | _fill in_ |

---

### Step 2.4 — Container Apps Environment

| Field | Value |
|---|---|
| Command | `az containerapp env create --name truepath-staging-env --resource-group Gitlab_TRUE_Path_rg --logs-workspace-id <law-id> --logs-workspace-key <law-key> --location eastus` |
| Expected | Provisioning state: `Succeeded` |
| Status | PENDING |
| Actual provisioning state | _fill in_ |
| Actual `defaultDomain` | _fill in_ (needed for CORS_ORIGIN in Phase 4) |

---

### Step 2.5 — Key Vault

| Field | Value |
|---|---|
| Command | `az keyvault create --name truepath-kv --resource-group Gitlab_TRUE_Path_rg --location eastus` |
| Expected | JSON with `properties.vaultUri` |
| Status | PENDING |
| Actual `vaultUri` | _fill in_ |
| Contingency | If name taken → rename to `truepath-kv-stg`, update `deploy-outputs.json` |

---

### Step 2.5a — Store secrets in Key Vault

| Secret Name | Source in `backend/.env` | Status | Verify command |
|---|---|---|---|
| `OPENAI-API-KEY` | `OPENAI_API_KEY` | PENDING | `az keyvault secret show --vault-name truepath-kv --name OPENAI-API-KEY` |
| `SUPABASE-URL` | `SUPABASE_URL` | PENDING | `az keyvault secret show --vault-name truepath-kv --name SUPABASE-URL` |
| `SUPABASE-SERVICE-KEY` | `SUPABASE_SERVICE_KEY` | PENDING | `az keyvault secret show --vault-name truepath-kv --name SUPABASE-SERVICE-KEY` |

Secret URI format (versionless, used in Phase 4 `--secrets` flag):
```
https://truepath-kv.vault.azure.net/secrets/<SECRET-NAME>
```
_Fill in actual URIs in `deploy-outputs.json` after creation._

---

### Step 2.6 — Storage Account

| Field | Value |
|---|---|
| Command | `az storage account create --name truepathstorage --resource-group Gitlab_TRUE_Path_rg --sku Standard_LRS --location eastus` |
| Expected | JSON with `id` and `primaryEndpoints.blob` |
| Status | PENDING |
| Actual `id` | _fill in_ |
| Actual `primaryEndpoints.blob` | _fill in_ |

---

### Step 2.6a — Blob container

| Field | Value |
|---|---|
| Command | `az storage container create --name rag-data --account-name truepathstorage --auth-mode login` |
| Expected | `{"created": true}` |
| Status | PENDING |
| Actual output | _fill in_ |

---

### Step 2.7 — Managed Identity

| Field | Value |
|---|---|
| Command | `az identity create --name truepath-staging-id --resource-group Gitlab_TRUE_Path_rg` |
| Expected | JSON with `id`, `principalId`, `clientId` |
| Status | PENDING |
| Actual `id` (resource ID) | _fill in_ |
| Actual `principalId` | _fill in_ |
| Actual `clientId` | _fill in_ |
| Note | Script waits 20s before role assignments for AAD propagation |

---

### Step 2.7a — Role Assignments

| Role | Scope | Status | Actual assignment ID |
|---|---|---|---|
| `AcrPull` | ACR `truepathacr` | PENDING | _fill in_ |
| `Key Vault Secrets User` | Key Vault `truepath-kv` | PENDING | _fill in_ |
| `Storage Blob Data Contributor` | Storage `truepathstorage` | PENDING | _fill in_ |

Verify all three:
```powershell
az role assignment list --assignee <principalId> --output table
```

---

## Post-Execution: Update deploy-outputs.json

After the script runs, `scripts/deploy-outputs.json` is auto-populated.
Verify the file contains no `<pending>` values before proceeding to Phase 3.

```powershell
Select-String -Path scripts/deploy-outputs.json -Pattern "<pending>"
# Should return no matches
```

---

## Non-Negotiable: Local Verification

Phase 2 creates only Azure resources — no local code is touched.
Local dev re-verified on 2026-05-31:

| Service | Endpoint | Status |
|---|---|---|
| Python services | `http://localhost:8000/health` | 200 OK |
| Express backend | `http://localhost:4000/health` | 200 OK |
| Next.js frontend | `http://localhost:3000` | 200 OK |
| Full wizard flow | intake → skills → pathways → PDF | PASSED |

---

## Learnings

### L1: az CLI not pre-installed
**Fix**: `winget install Microsoft.AzureCLI` — open new terminal after install.
**Alternative**: Azure Cloud Shell at https://shell.azure.com (az pre-installed, no local install needed).

### L2: Docker not pre-installed
**Fix**: Install Docker Desktop from https://www.docker.com/products/docker-desktop/
**Impact**: Blocks Phase 3 (image builds). Install alongside az CLI.

### L3: `SUPABASE_DB_PASSWORD` exists in `.env` but not stored in Key Vault
**Decision**: Used only for direct PostgreSQL connections, not needed for Supabase SDK usage in staging.
Deferred to production phase when migrating to Azure Database for PostgreSQL.

### L4: ACR name `truepathacr` must be globally unique
**Contingency**: If taken, use `truepathacrstg`. Update `scripts/deploy-outputs.json` and all Phase 3/4 image tags.

### L5: Key Vault name `truepath-kv` must be globally unique (3–24 chars)
**Contingency**: If taken, use `truepath-kv-stg`. Update `scripts/deploy-outputs.json`.

### L6: Managed Identity needs 20s propagation before role assignments
**Fix applied**: `Start-Sleep -Seconds 20` in `deploy-phase2.ps1` between identity creation and role assignments.
If role assignments still fail, wait another 30s and re-run the three `az role assignment create` commands manually.

### L7: `containerapp` az extension required before any Container Apps commands
**Fix applied**: Script runs `az extension add --name containerapp` in the pre-flight section.
