<#
.SYNOPSIS
  Phase 2: Azure Infrastructure Setup for TruePath staging environment.

.DESCRIPTION
  Creates all Azure resources needed before deploying container images.
  Run this ONCE from the repo root after installing Azure CLI and logging in.
  Outputs resource IDs/names to scripts/deploy-outputs.json for use by Phase 3/4.

.PREREQUISITES
  - Azure CLI installed (winget install Microsoft.AzureCLI)
  - az login completed
  - az extension add --name containerapp
  - az extension add --name monitor-control-service  (for Log Analytics)
  - backend/.env must exist with secrets

.USAGE
  cd C:\Users\ArundhatiRoy\code\truepath
  .\scripts\deploy-phase2.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Config ──────────────────────────────────────────────────────────────────
$SUB_ID     = "b84e832c-ee7f-4b32-90d0-de721fed1a30"
$RG         = "Gitlab_TRUE_Path_rg"
$LOCATION   = "eastus"
$ACR_NAME   = "truepathacr"
$LAW_NAME   = "truepath-logs"
$ENV_NAME   = "truepath-staging-env"
$KV_NAME    = "truepath-kv"
$SA_NAME    = "truepathstorage"
$BLOB_CTR   = "rag-data"
$MI_NAME    = "truepath-staging-id"
$ENV_FILE   = Join-Path $PSScriptRoot "..\backend\.env"
$OUT_FILE   = Join-Path $PSScriptRoot "deploy-outputs.json"

# ── Helpers ──────────────────────────────────────────────────────────────────
function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" }
function Die($msg) { Write-Error "[FAIL] $msg"; exit 1 }

function Read-EnvValue($file, $key) {
    $line = Get-Content $file | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
    if (-not $line) { Die "Key '$key' not found in $file" }
    return ($line -split '=', 2)[1].Trim()
}

# ── Pre-flight ────────────────────────────────────────────────────────────────
Log "Checking prerequisites..."

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Die "Azure CLI not found. Install with: winget install Microsoft.AzureCLI, then re-run."
}

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) { Die "Not logged in. Run: az login" }
Log "Logged in as: $($account.user.name)"

az account set --subscription $SUB_ID
$account = az account show | ConvertFrom-Json
Log "Active subscription: $($account.name) ($($account.id))"

if (-not (Test-Path $ENV_FILE)) {
    Die "backend/.env not found at $ENV_FILE. Copy from backend/.env.example and fill in values."
}

# ── Read secrets from backend/.env ───────────────────────────────────────────
Log "Reading secrets from backend/.env..."
$secrets = @{
    "OPENAI-API-KEY"       = Read-EnvValue $ENV_FILE "OPENAI_API_KEY"
    "SUPABASE-URL"         = Read-EnvValue $ENV_FILE "SUPABASE_URL"
    "SUPABASE-SERVICE-KEY" = Read-EnvValue $ENV_FILE "SUPABASE_SERVICE_KEY"
}
Log "Secrets loaded: $($secrets.Keys -join ', ')"

# ── 2.1 Ensure extensions ────────────────────────────────────────────────────
Log "Ensuring required az extensions..."
az extension add --name containerapp --only-show-errors 2>$null
az extension add --name log-analytics --only-show-errors 2>$null
Log "Extensions ready."

# ── 2.2 Azure Container Registry ─────────────────────────────────────────────
Log "Creating ACR: $ACR_NAME..."
$acrJson = az acr create `
    --name $ACR_NAME `
    --resource-group $RG `
    --sku Basic `
    --admin-enabled true `
    --location $LOCATION | ConvertFrom-Json
$ACR_LOGIN_SERVER = $acrJson.loginServer
Log "ACR created: $ACR_LOGIN_SERVER"

# ── 2.3 Log Analytics Workspace ───────────────────────────────────────────────
Log "Creating Log Analytics Workspace: $LAW_NAME..."
$lawJson = az monitor log-analytics workspace create `
    --workspace-name $LAW_NAME `
    --resource-group $RG `
    --location $LOCATION | ConvertFrom-Json
$LAW_ID   = $lawJson.id
$LAW_KEY  = (az monitor log-analytics workspace get-shared-keys `
    --workspace-name $LAW_NAME `
    --resource-group $RG | ConvertFrom-Json).primarySharedKey
Log "Log Analytics Workspace ID: $LAW_ID"

# ── 2.4 Container Apps Environment ────────────────────────────────────────────
Log "Creating Container Apps Environment: $ENV_NAME..."
az containerapp env create `
    --name $ENV_NAME `
    --resource-group $RG `
    --logs-workspace-id $LAW_ID `
    --logs-workspace-key $LAW_KEY `
    --location $LOCATION | Out-Null
Log "Container Apps Environment created."

# ── 2.5 Key Vault + secrets ───────────────────────────────────────────────────
Log "Creating Key Vault: $KV_NAME..."
$kvJson = az keyvault create `
    --name $KV_NAME `
    --resource-group $RG `
    --location $LOCATION | ConvertFrom-Json
$KV_URI = $kvJson.properties.vaultUri
Log "Key Vault URI: $KV_URI"

Log "Storing secrets in Key Vault..."
foreach ($entry in $secrets.GetEnumerator()) {
    az keyvault secret set `
        --vault-name $KV_NAME `
        --name $entry.Key `
        --value $entry.Value | Out-Null
    Log "  Stored: $($entry.Key)"
}

# Capture Key Vault secret URIs (needed for Container App --secrets flag)
$KV_SECRET_URIS = @{}
foreach ($key in $secrets.Keys) {
    $uri = (az keyvault secret show --vault-name $KV_NAME --name $key | ConvertFrom-Json).id
    # Strip the version suffix so the reference always gets the latest
    $KV_SECRET_URIS[$key] = ($uri -replace '/[^/]+$', '')
    Log "  URI: $($KV_SECRET_URIS[$key])"
}

# ── 2.6 Storage Account + blob container ──────────────────────────────────────
Log "Creating Storage Account: $SA_NAME..."
$saJson = az storage account create `
    --name $SA_NAME `
    --resource-group $RG `
    --sku Standard_LRS `
    --location $LOCATION | ConvertFrom-Json
$SA_ID = $saJson.id
Log "Storage account created: $SA_ID"

Log "Creating blob container: $BLOB_CTR..."
az storage container create `
    --name $BLOB_CTR `
    --account-name $SA_NAME `
    --auth-mode login | Out-Null
Log "Blob container '$BLOB_CTR' created."

# ── 2.7 Managed Identity + role assignments ────────────────────────────────────
Log "Creating Managed Identity: $MI_NAME..."
$miJson = az identity create `
    --name $MI_NAME `
    --resource-group $RG | ConvertFrom-Json
$MI_RESOURCE_ID    = $miJson.id
$MI_PRINCIPAL_ID   = $miJson.principalId
$MI_CLIENT_ID      = $miJson.clientId
Log "Identity principal ID: $MI_PRINCIPAL_ID"
Log "Identity client ID:    $MI_CLIENT_ID"

Log "Waiting 20s for identity propagation before role assignments..."
Start-Sleep -Seconds 20

$ACR_SCOPE = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME"
$KV_SCOPE  = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME"
$SA_SCOPE  = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.Storage/storageAccounts/$SA_NAME"

Log "Assigning AcrPull..."
az role assignment create --assignee $MI_PRINCIPAL_ID --role "AcrPull"            --scope $ACR_SCOPE | Out-Null

Log "Assigning Key Vault Secrets User..."
az role assignment create --assignee $MI_PRINCIPAL_ID --role "Key Vault Secrets User" --scope $KV_SCOPE | Out-Null

Log "Assigning Storage Blob Data Contributor..."
az role assignment create --assignee $MI_PRINCIPAL_ID --role "Storage Blob Data Contributor" --scope $SA_SCOPE | Out-Null

Log "Role assignments complete."

# ── Write outputs ─────────────────────────────────────────────────────────────
$outputs = [ordered]@{
    subscription_id      = $SUB_ID
    resource_group       = $RG
    location             = $LOCATION
    acr_name             = $ACR_NAME
    acr_login_server     = $ACR_LOGIN_SERVER
    law_id               = $LAW_ID
    env_name             = $ENV_NAME
    kv_name              = $KV_NAME
    kv_uri               = $KV_URI
    kv_secret_uris       = $KV_SECRET_URIS
    storage_account_name = $SA_NAME
    blob_container       = $BLOB_CTR
    storage_account_id   = $SA_ID
    identity_name        = $MI_NAME
    identity_resource_id = $MI_RESOURCE_ID
    identity_principal_id= $MI_PRINCIPAL_ID
    identity_client_id   = $MI_CLIENT_ID
}
$outputs | ConvertTo-Json -Depth 4 | Set-Content -Path $OUT_FILE -Encoding UTF8
Log "Outputs saved to $OUT_FILE"

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================"
Write-Host " PHASE 2 COMPLETE"
Write-Host "============================================"
Write-Host " ACR:         $ACR_LOGIN_SERVER"
Write-Host " Key Vault:   $KV_URI"
Write-Host " Storage:     $SA_NAME"
Write-Host " Identity ID: $MI_RESOURCE_ID"
Write-Host " Outputs:     $OUT_FILE"
Write-Host "============================================"
Write-Host " Next: run .\scripts\deploy-phase3.ps1"
