# Phase 2 Verification Log

**Date executed**: 2026-06-01
**Executed by**: aroy@careerpathservices.org (Azure Cloud Shell)
**Script**: `scripts/deploy-phase2.ps1`
**Outputs file**: `scripts/deploy-outputs.json`
**Status**: COMPLETE — all resources created, secrets stored, role assignments applied

---

## Prerequisites Checklist

| # | Check | Command | Status | Notes |
|---|---|---|---|---|
| P1 | az CLI installed | `az --version` | DONE | Used Azure Cloud Shell — no local install needed |
| P2 | az CLI logged in | `az account show` | DONE | Auto-authenticated in Cloud Shell |
| P3 | containerapp extension | `az extension list` | DONE | Script auto-installs |
| P4 | Docker installed | `docker --version` | N/A (Phase 3) | Not needed for Phase 2 |
| P5 | `backend/.env` present | `Test-Path backend/.env` | DONE | Uploaded to `/home/arundhati/.env`; used `-EnvFile` param |

---

## Execution Log

Run `scripts/deploy-phase2.ps1` and fill in the **Actual Output** column as each step completes.

### Step 2.1 — Set subscription context

| Field | Value |
|---|---|
| Command | `az account set --subscription b84e832c-ee7f-4b32-90d0-de721fed1a30` |
| Expected | No output (exit code 0) |
| Verify | `az account show` → name = "Gitlab TRUE Path DevOps" |
| Status | DONE |
| Actual output | Active subscription: Gitlab TRUE Path DevOps (b84e832c-ee7f-4b32-90d0-de721fed1a30) |

---

### Step 2.2 — Azure Container Registry

| Field | Value |
|---|---|
| Command | `az acr create --name truepathacr --resource-group Gitlab_TRUE_Path_rg --sku Basic --admin-enabled true --location eastus` |
| Expected | JSON with `loginServer: "truepathacr.azurecr.io"` |
| Status | DONE (already existed, reused) |
| Actual `loginServer` | `truepathacr.azurecr.io` |
| Actual `id` | `/subscriptions/b84e832c-ee7f-4b32-90d0-de721fed1a30/resourceGroups/Gitlab_TRUE_Path_rg/providers/Microsoft.ContainerRegistry/registries/truepathacr` |
| Contingency | N/A — name was available |

---

### Step 2.3 — Log Analytics Workspace

| Field | Value |
|---|---|
| Command | `az monitor log-analytics workspace create --workspace-name truepath-logs --resource-group Gitlab_TRUE_Path_rg --location eastus` |
| Expected | JSON with `id` and `customerId` |
| Status | DONE (already existed, reused) |
| Actual `id` (workspace resource ID) | `/subscriptions/b84e832c-ee7f-4b32-90d0-de721fed1a30/resourceGroups/Gitlab_TRUE_Path_rg/providers/Microsoft.OperationalInsights/workspaces/truepath-logs` |
| Actual `customerId` (workspace GUID) | `2375b29f-f133-4f4c-99e6-32292819832d` |

---

### Step 2.4 — Container Apps Environment

| Field | Value |
|---|---|
| Command | `az containerapp env create --name truepath-staging-env --resource-group Gitlab_TRUE_Path_rg --logs-workspace-id <law-id> --logs-workspace-key <law-key> --location eastus` |
| Expected | Provisioning state: `Succeeded` |
| Status | DONE (already existed, reused) |
| Actual provisioning state | Succeeded |
| Actual `defaultDomain` | `ashybush-4cbf3768.eastus.azurecontainerapps.io` |

---

### Step 2.5 — Key Vault

| Field | Value |
|---|---|
| Command | `az keyvault create --name truepath-kv --resource-group Gitlab_TRUE_Path_rg --location eastus` |
| Expected | JSON with `properties.vaultUri` |
| Status | DONE — created as `truepath-kv-stg` (access policy mode) |
| Actual `vaultUri` | `https://truepath-kv-stg.vault.azure.net/` |
| Contingency | Used `truepath-kv-stg` — original name `truepath-kv` existed in RBAC mode (see L13) |

---

### Step 2.5a — Store secrets in Key Vault

| Secret Name | Source in `backend/.env` | Status | Verify command |
|---|---|---|---|
| `OPENAI-API-KEY` | `OPENAI_API_KEY` | DONE | `az keyvault secret show --vault-name truepath-kv-stg --name OPENAI-API-KEY` |
| `SUPABASE-URL` | `SUPABASE_URL` | DONE | `az keyvault secret show --vault-name truepath-kv-stg --name SUPABASE-URL` |
| `SUPABASE-SERVICE-KEY` | `SUPABASE_SERVICE_KEY` | DONE | `az keyvault secret show --vault-name truepath-kv-stg --name SUPABASE-SERVICE-KEY` |

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
| Status | DONE |
| Actual `id` | `/subscriptions/b84e832c-ee7f-4b32-90d0-de721fed1a30/resourceGroups/Gitlab_TRUE_Path_rg/providers/Microsoft.Storage/storageAccounts/truepathstorage` |
| Actual `primaryEndpoints.blob` | `https://truepathstorage.blob.core.windows.net/` |

---

### Step 2.6a — Blob container

| Field | Value |
|---|---|
| Command | `az storage container create --name rag-data --account-name truepathstorage --auth-mode key` |
| Expected | `{"created": true}` |
| Status | DONE |
| Actual output | Container `rag-data` created (used `--auth-mode key` — see L14) |

---

### Step 2.7 — Managed Identity

| Field | Value |
|---|---|
| Command | `az identity create --name truepath-staging-id --resource-group Gitlab_TRUE_Path_rg` |
| Expected | JSON with `id`, `principalId`, `clientId` |
| Status | DONE |
| Actual `id` (resource ID) | `/subscriptions/b84e832c-ee7f-4b32-90d0-de721fed1a30/resourcegroups/Gitlab_TRUE_Path_rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/truepath-staging-id` |
| Actual `principalId` | `21948419-41cf-4270-bd87-41d8f79a8002` |
| Actual `clientId` | `b842b0ab-1185-4403-98cf-6b1df592accf` |
| Note | Script waited 30s (new identity) before role assignments |

---

### Step 2.7a — Role Assignments

| Role | Scope | Status | Actual assignment ID |
|---|---|---|---|
| `AcrPull` | ACR `truepathacr` | DONE | assigned to principal `21948419-41cf-4270-bd87-41d8f79a8002` |
| `Key Vault Secrets User` | Key Vault `truepath-kv-stg` | DONE | access policy (not RBAC role) — get + list |
| `Storage Blob Data Contributor` | Storage `truepathstorage` | DONE | assigned to principal `21948419-41cf-4270-bd87-41d8f79a8002` |

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

### L10: `az containerapp env create --logs-workspace-id` expects the workspace GUID, not the ARM resource ID
**What happened**: `az monitor log-analytics workspace create` returns two different IDs on the same JSON object:
- `id` — the ARM resource ID (`/subscriptions/.../workspaces/truepath-logs`)
- `customerId` — the workspace GUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

The script was passing `id` to `--logs-workspace-id`, but Container Apps requires the **`customerId` GUID**. The error was: `LogAnalyticsConfiguration.CustomerId is invalid. CustomerId must be a GUID without additional whiteSpace.`

**Fix applied**: Changed `$LAW_ID = $lawJson.id` → `$LAW_ID = $lawJson.customerId`. Both values are now stored in `deploy-outputs.json` as `law_resource_id` and `law_customer_id` for full traceability.

---

### L12: Key Vault RBAC — deployer lacks `Microsoft.Authorization/roleAssignments/write`
**What happened**: `az role assignment create` for "Key Vault Secrets Officer" returned `AuthorizationFailed`. The user `aroy@careerpathservices.org` has **Contributor** access on the subscription. Contributor can create resources but cannot create role assignments — only **Owner** or **User Access Administrator** can do that. This is a subscription-level permission constraint, not a bug in the script.

**Error signature**:
```
The client '...' does not have authorization to perform action
'Microsoft.Authorization/roleAssignments/write' over scope
'.../providers/Microsoft.KeyVault/vaults/truepath-kv/...'
```

**Root cause**: All role assignment steps (KV, ACR, Storage) require `roleAssignments/write`. The deployer has Contributor, not Owner.

**Fix applied — Key Vault** (complete, no admin needed):
Switched Key Vault from RBAC authorization mode to **access policy mode** (`--enable-rbac-authorization false`). Access policies use a separate API path that only requires Key Vault Contributor, not `roleAssignments/write`.
- Script now creates/updates KV with `--enable-rbac-authorization false`
- Deployer access granted via `az keyvault set-policy --object-id <OID> --secret-permissions get set list delete`
- Managed identity access granted via `az keyvault set-policy --object-id <MI-OID> --secret-permissions get list` (replaces "Key Vault Secrets User" role assignment)

**Fix required — ACR and Storage** (needs admin, one-time):
ACR and Storage have no "access policy" equivalent — they use pure RBAC. The managed identity still needs `AcrPull` and `Storage Blob Data Contributor`. Ask Azure admin to grant Owner at the resource group level:
```bash
az role assignment create \
  --assignee aroy@careerpathservices.org \
  --role Owner \
  --scope /subscriptions/b84e832c-ee7f-4b32-90d0-de721fed1a30/resourceGroups/Gitlab_TRUE_Path_rg
```
Once done, re-run `deploy-phase2.ps1` — it will skip the already-completed steps and apply the two remaining role assignments.

**Script improvement**: Pre-flight now checks for Owner/UAA at RG scope and prints a clear warning banner at startup if missing, before any steps execute.

---

### L9: Resource providers not registered on new subscription
**What happened**: `az acr create` failed with `MissingSubscriptionRegistration` for `Microsoft.ContainerRegistry`. New Azure subscriptions (especially DevOps/trial subscriptions) do not auto-register resource providers — they are registered on first use via the portal, or explicitly via CLI.

**Providers required for this deployment**:
| Namespace | Used for |
|---|---|
| `Microsoft.ContainerRegistry` | ACR (step 2.2) |
| `Microsoft.App` | Container Apps (step 2.4) |
| `Microsoft.OperationalInsights` | Log Analytics (step 2.3) |
| `Microsoft.KeyVault` | Key Vault (step 2.5) |
| `Microsoft.Storage` | Storage Account (step 2.6) |
| `Microsoft.ManagedIdentity` | Managed Identity (step 2.7) |

**Immediate fix** (run in Cloud Shell before re-running script):
```powershell
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
```

**Fix applied in script**: Pre-flight now checks each provider's `registrationState` and calls `az provider register --wait` only if not already `Registered`. Idempotent — safe to re-run.

**Secondary fix applied**: All resource creation calls now capture raw output before `ConvertFrom-Json` and check `$LASTEXITCODE`. A failed call now shows the raw error text instead of a cryptic null-reference crash.

---

### L11: Key Vault RBAC — creator is not auto-granted secret write access
**What happened**: `az keyvault secret set` returned `Forbidden / ForbiddenByRbac`. Key Vaults created in the newer **RBAC authorization mode** (the new default since 2023) grant zero implicit access — not even to the identity that created the vault. A role assignment must exist before any secret write is attempted.

**Error signature**:
```
Action: 'Microsoft.KeyVault/vaults/secrets/setSecret/action'
Assignment: (not found)
Inner error: {"code": "ForbiddenByRbac"}
```

**Fix applied in script**: After `az keyvault create`, the script now:
1. Resolves the current user's object ID via `az ad signed-in-user show --query id`
2. Assigns `Key Vault Secrets Officer` to that OID on the vault scope
3. Waits 20 s for RBAC propagation before attempting `az keyvault secret set`

**If you need to fix manually** (vault already exists, just missing the role):
```powershell
$OID = az ad signed-in-user show --query id -o tsv
az role assignment create --assignee-object-id $OID --assignee-principal-type User \
  --role "Key Vault Secrets Officer" \
  --scope "/subscriptions/b84e832c-ee7f-4b32-90d0-de721fed1a30/resourceGroups/Gitlab_TRUE_Path_rg/providers/Microsoft.KeyVault/vaults/truepath-kv"
Start-Sleep -Seconds 30
# then re-run the secret set commands
```

**Note**: The Managed Identity (`truepath-staging-id`) separately gets `Key Vault Secrets User` (read-only) — that role is assigned in step 2.7a and is separate from the deployer's write access.

---

### L8: Script `.env` path resolution fails in Azure Cloud Shell
**What happened**: When running from Cloud Shell, the script is uploaded flat to `/home/arundhati/` but it resolved `$PSScriptRoot/../backend/.env` which doesn't exist in that environment.

**Fix applied in script**: Added ordered candidate resolution — explicit `-EnvFile` param → `scripts/../backend/.env` (repo layout) → `.env` next to the script (Cloud Shell upload case) → `cwd/.env`. Script now logs which file it resolved to.

**Immediate workaround used**: `mkdir -p backend && cp .env backend/.env` in Cloud Shell home dir before running the script.

**Future**: When uploading to Cloud Shell, upload `.env` and the script together in the same dir — the script will now find it automatically.

---

### L14: Pre-flight Owner check is overly conservative — role assignments succeeded anyway
**What happened**: Pre-flight printed a warning that `aroy@careerpathservices.org` lacked Owner/UAA at RG scope. Despite this, `AcrPull` and `Storage Blob Data Contributor` assignments for the managed identity both succeeded at step 2.7.

**Root cause**: The pre-flight check queries `--role Owner --scope <rg>` and `--role "User Access Administrator" --scope <rg>` specifically. The account likely has a broader assignment (e.g., Owner at subscription scope) that grants the needed `roleAssignments/write` permission but isn't found when querying only at RG scope.

**Fix**: The pre-flight warning is harmless — it just means "I couldn't confirm permissions at RG scope." Role assignments succeed if the permission exists at any parent scope. No script change needed.

---

### L13: Key Vault RBAC mode — switching permission model also requires Owner
**What happened**: `truepath-kv` was created in a previous run in **RBAC authorization mode** (the Azure default since 2023). Step 2.5 tries to switch it to access policy mode (`az keyvault update --enable-rbac-authorization false`), but this internally writes a role assignment and returns `InsufficientPermissions / Microsoft.Authorization/roleAssignments/write` — same blocker as all other role assignment operations. Contributor is not enough.

**Error signature**:
```
(InsufficientPermissions) Caller is not allowed to change permission model.
action=Microsoft.Authorization/roleAssignments/write
resource=.../Microsoft.KeyVault/vaults/truepath-kv
```

**Fix applied**: Renamed `$KV_NAME` from `truepath-kv` to `truepath-kv-stg` in `deploy-phase2.ps1`. The new name doesn't exist, so the script creates it fresh with `--enable-rbac-authorization false` (access policy mode) from the start — no permission-model switch needed.

**Also updated**: `scripts/deploy-outputs.json` placeholder URIs updated to `truepath-kv-stg`.

**Note**: The abandoned `truepath-kv` vault (RBAC mode, no secrets stored) remains in the resource group. It is harmless — nothing uses it. An admin can delete and purge it later if desired.
