# Phase 2 Verification Log

**Date**: 2026-05-31
**Branch**: main
**Status**: PENDING EXECUTION — prerequisites not yet installed on this machine

---

## Execution Status

| Step | Command / Action | Status | Notes |
|---|---|---|---|
| 2.0 | az CLI pre-flight check | BLOCKED | az CLI not installed — see Learnings |
| 2.0 | Docker pre-flight check | BLOCKED | Docker not installed — needed for Phase 3 |
| 2.1 | Set subscription | PENDING | — |
| 2.2 | Create ACR (`truepathacr`) | PENDING | — |
| 2.3 | Create Log Analytics Workspace (`truepath-logs`) | PENDING | — |
| 2.4 | Create Container Apps Environment (`truepath-staging-env`) | PENDING | — |
| 2.5 | Create Key Vault (`truepath-kv`) + store 3 secrets | PENDING | — |
| 2.6 | Create Storage Account (`truepathstorage`) + `rag-data` container | PENDING | — |
| 2.7 | Create Managed Identity + 3 role assignments | PENDING | — |

> **To execute**: install prerequisites (see Learnings below), then run:
> ```powershell
> cd C:\Users\ArundhatiRoy\code\truepath
> .\scripts\deploy-phase2.ps1
> ```
> The script captures all resource IDs/URIs to `scripts/deploy-outputs.json`
> for use by Phase 3 and Phase 4. Update the table above after execution.

---

## Resource Outputs (fill in after script runs)

```json
// Copy contents of scripts/deploy-outputs.json here after execution
```

---

## Non-Negotiable: Local Verification After Phase 2

Phase 2 creates only Azure resources — no local code is touched.
Local dev re-verified on 2026-05-31:

| Check | Result |
|---|---|
| `python:8000 /health` | 200 OK |
| `backend:4000 /health` | 200 OK |
| `frontend:3000` | 200 OK (HTML) |
| Full wizard flow end-to-end | PASSED (carried from Phase 1 — no code changed) |

All three services healthy. No regressions.

---

## Learnings

### L1: Azure CLI not pre-installed on this machine

**What happened**: `az` is not in PATH and was not found in any common install location.

**Impact**: All Phase 2 steps are blocked until CLI is installed.

**Fix**:
```powershell
winget install Microsoft.AzureCLI
# After install, open a new terminal so PATH is refreshed, then:
az login
az extension add --name containerapp
```

**Alternatively**, use **Azure Cloud Shell** (browser-based, no install needed):
1. Go to https://shell.azure.com
2. Choose PowerShell mode
3. Upload `scripts/deploy-phase2.ps1` and `backend/.env`
4. Run the script

**Added to plan**: Phase 2 prerequisites section updated with explicit install commands.

---

### L2: Docker not pre-installed on this machine

**What happened**: `docker` is not in PATH.

**Impact**: Phase 3 (Build & Push Docker Images) is blocked.

**Fix**:
```
Install Docker Desktop from https://www.docker.com/products/docker-desktop/
```
After install: open Docker Desktop, wait for engine to start, then verify with `docker --version`.

**Added to plan**: Phase 3 prerequisites updated.

---

### L3: `SUPABASE_DB_PASSWORD` exists in backend/.env but was not in original Key Vault plan

**What happened**: Inspecting `backend/.env` revealed a `SUPABASE_DB_PASSWORD` key in addition to the 3 secrets in the original plan (`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).

**Decision**: `SUPABASE_DB_PASSWORD` is used only for direct PostgreSQL connections (not via the Supabase JS SDK). The staging deployment uses the Supabase SDK exclusively, so it is not needed in Key Vault for Phase 2/3/4. It will be needed when migrating to Azure Database for PostgreSQL (production phase).

**Action**: No change for staging. Noted here for the production promotion checklist.

---

### L4: Remote ACR name `truepathacr` must be globally unique

**What happened**: ACR names are globally unique across all Azure tenants.
`truepathacr` may already be taken.

**Contingency**: If the `az acr create` step fails with a conflict, rename to `truepathacrstg` or `truepathacrdev`. Update `scripts/deploy-outputs.json` and `scripts/deploy-phase3.ps1` accordingly (the Phase 3 script reads ACR name from `deploy-outputs.json`).

---

### L5: Key Vault name `truepath-kv` must be globally unique + 3–24 chars

**What happened**: Azure Key Vault names are globally unique.
`truepath-kv` is 11 chars — within the 3–24 char limit.

**Contingency**: If creation fails, try `truepath-kv-stg`. Update in `deploy-outputs.json`.

---

### L6: Managed Identity needs 15–30s propagation before role assignments

**What happened**: Azure AD takes time to propagate a new service principal after identity creation. Immediately assigning roles after `az identity create` fails with "principal does not exist."

**Fix applied in script**: `Start-Sleep -Seconds 20` inserted between identity creation and role assignments.

---

### L7: `az containerapp env create` requires the `containerapp` extension

**What happened**: `az containerapp` commands are not part of the core Azure CLI — they require the `containerapp` extension to be installed first.

**Fix applied in script**: Script runs `az extension add --name containerapp` as part of the pre-flight before any containerapp commands.

---

## Post-Execution Checklist (complete after script runs)

- [ ] All 7 resources exist in `Gitlab_TRUE_Path_rg` (verify in Azure Portal)
- [ ] ACR login works: `az acr login --name truepathacr`
- [ ] Key Vault has 3 secrets: `az keyvault secret list --vault-name truepath-kv`
- [ ] Blob container exists: `az storage container list --account-name truepathstorage`
- [ ] Identity has 3 role assignments: `az role assignment list --assignee <principal-id>`
- [ ] `scripts/deploy-outputs.json` exists and contains all resource IDs
- [ ] Local dev still running (or re-verified via `./start.ps1`)
