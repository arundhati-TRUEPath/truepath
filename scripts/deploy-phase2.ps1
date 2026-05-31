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
  - backend/.env must exist with secrets

.USAGE
  # From repo root (Windows):
  .\scripts\deploy-phase2.ps1

  # From Azure Cloud Shell (script and .env uploaded flat to home dir):
  ./deploy-phase2.ps1

  # Override the .env path explicitly:
  .\scripts\deploy-phase2.ps1 -EnvFile "C:\path\to\my.env"
#>

param(
    [string]$EnvFile = ""
)

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

# Resolve .env: explicit param > repo layout (scripts/../backend/.env) > same dir as script > cwd
if ($EnvFile -ne "" -and (Test-Path $EnvFile)) {
    $ENV_FILE = $EnvFile
} else {
    $candidates = @(
        (Join-Path $PSScriptRoot "..\backend\.env"),   # repo root run: scripts/../backend/.env
        (Join-Path $PSScriptRoot "backend\.env"),      # if script is at repo root
        (Join-Path $PSScriptRoot ".env"),              # Cloud Shell: script + .env uploaded together
        (Join-Path (Get-Location) "backend\.env"),     # cwd/backend/.env
        (Join-Path (Get-Location) ".env")              # cwd/.env
    )
    $ENV_FILE = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

# deploy-outputs.json lives next to the script when run from repo, or in cwd for Cloud Shell
$OUT_FILE = Join-Path $PSScriptRoot "deploy-outputs.json"
if (-not (Test-Path $PSScriptRoot -PathType Container)) {
    $OUT_FILE = Join-Path (Get-Location) "deploy-outputs.json"
}

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
    Die "Azure CLI not found. Install options:`n  1. MSI: Invoke-WebRequest -Uri 'https://aka.ms/installazurecliwindows' -OutFile AzureCLI.msi; Start-Process msiexec '/I AzureCLI.msi /quiet' -Wait`n  2. Cloud Shell: https://shell.azure.com (no install needed)"
}

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) { Die "Not logged in. Run: az login" }
Log "Logged in as: $($account.user.name)"

az account set --subscription $SUB_ID
$account = az account show | ConvertFrom-Json
Log "Active subscription: $($account.name) ($($account.id))"

if (-not $ENV_FILE -or -not (Test-Path $ENV_FILE)) {
    Die "No .env file found. Tried backend/.env, .env next to script, and cwd. Use -EnvFile to specify the path explicitly."
}
Log "Using .env file: $ENV_FILE"

# ── Read secrets from backend/.env ───────────────────────────────────────────
Log "Reading secrets from backend/.env..."
$secrets = @{
    "OPENAI-API-KEY"       = Read-EnvValue $ENV_FILE "OPENAI_API_KEY"
    "SUPABASE-URL"         = Read-EnvValue $ENV_FILE "SUPABASE_URL"
    "SUPABASE-SERVICE-KEY" = Read-EnvValue $ENV_FILE "SUPABASE_SERVICE_KEY"
}
Log "Secrets loaded: $($secrets.Keys -join ', ')"

# ── 2.1 Ensure extensions + register resource providers ──────────────────────
Log "Ensuring required az extensions..."
az extension add --name containerapp --only-show-errors 2>$null
az extension add --name log-analytics --only-show-errors 2>$null
Log "Extensions ready."

Log "Registering required resource providers (safe to run even if already registered)..."
$providers = @(
    "Microsoft.ContainerRegistry",   # ACR
    "Microsoft.App",                 # Container Apps
    "Microsoft.OperationalInsights", # Log Analytics
    "Microsoft.KeyVault",
    "Microsoft.Storage",
    "Microsoft.ManagedIdentity"
)
foreach ($ns in $providers) {
    $state = (az provider show --namespace $ns --query "registrationState" -o tsv 2>$null)
    if ($state -ne "Registered") {
        Log "  Registering $ns (state: $state) — this can take 1-3 min..."
        az provider register --namespace $ns --wait | Out-Null
        Log "  $ns registered."
    } else {
        Log "  $ns already registered."
    }
}

# ── 2.2 Azure Container Registry ─────────────────────────────────────────────
Log "Creating ACR: $ACR_NAME..."
$acrRaw = az acr create `
    --name $ACR_NAME `
    --resource-group $RG `
    --sku Basic `
    --admin-enabled true `
    --location $LOCATION
if ($LASTEXITCODE -ne 0) { Die "ACR creation failed. Raw output: $acrRaw" }
$acrJson = $acrRaw | ConvertFrom-Json
$ACR_LOGIN_SERVER = $acrJson.loginServer
Log "ACR created: $ACR_LOGIN_SERVER"

# ── 2.3 Log Analytics Workspace ───────────────────────────────────────────────
Log "Creating Log Analytics Workspace: $LAW_NAME..."
$lawRaw = az monitor log-analytics workspace create `
    --workspace-name $LAW_NAME `
    --resource-group $RG `
    --location $LOCATION
if ($LASTEXITCODE -ne 0) { Die "Log Analytics workspace creation failed. Raw output: $lawRaw" }
$lawJson = $lawRaw | ConvertFrom-Json
$LAW_RESOURCE_ID = $lawJson.id
$LAW_ID  = $lawJson.customerId   # GUID required by az containerapp env create
$LAW_KEY = (az monitor log-analytics workspace get-shared-keys `
    --workspace-name $LAW_NAME `
    --resource-group $RG | ConvertFrom-Json).primarySharedKey
Log "Log Analytics Workspace resource ID: $LAW_RESOURCE_ID"
Log "Log Analytics Workspace customer ID (GUID): $LAW_ID"

# ── 2.4 Container Apps Environment ────────────────────────────────────────────
Log "Creating Container Apps Environment: $ENV_NAME..."
az containerapp env create `
    --name $ENV_NAME `
    --resource-group $RG `
    --logs-workspace-id $LAW_ID `
    --logs-workspace-key $LAW_KEY `
    --location $LOCATION | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Container Apps Environment creation failed." }
Log "Container Apps Environment created."

# ── 2.5 Key Vault + secrets ───────────────────────────────────────────────────
Log "Creating Key Vault: $KV_NAME..."
$kvExistingRaw = az keyvault show --name $KV_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $kvExistingRaw) {
    Log "Key Vault $KV_NAME already exists, reusing."
    $KV_URI = ($kvExistingRaw | ConvertFrom-Json).properties.vaultUri
} else {
    $kvRaw = az keyvault create --name $KV_NAME --resource-group $RG --location $LOCATION
    if ($LASTEXITCODE -ne 0) { Die "Key Vault creation failed. Raw output: $kvRaw" }
    $KV_URI = ($kvRaw | ConvertFrom-Json).properties.vaultUri
}
Log "Key Vault URI: $KV_URI"

# Grant the deploying identity "Key Vault Secrets Officer" so this script can write secrets.
# Key Vaults created in RBAC mode (the new default) give NO implicit access — not even to the creator.
$KV_SCOPE_WRITE = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME"
$DEPLOYER_OID = (az ad signed-in-user show --query id -o tsv 2>$null)
if (-not $DEPLOYER_OID) {
    Die "Cannot resolve deployer OID. Grant 'Key Vault Secrets Officer' manually on $KV_NAME, then re-run."
}
$existingDeployerRole = (az role assignment list --assignee $DEPLOYER_OID --role "Key Vault Secrets Officer" --scope $KV_SCOPE_WRITE --query "[0].id" -o tsv 2>$null)
if (-not $existingDeployerRole) {
    Log "Granting Key Vault Secrets Officer to deployer OID: $DEPLOYER_OID..."
    az role assignment create `
        --assignee-object-id $DEPLOYER_OID `
        --assignee-principal-type User `
        --role "Key Vault Secrets Officer" `
        --scope $KV_SCOPE_WRITE | Out-Null
    if ($LASTEXITCODE -ne 0) { Die "Failed to grant Key Vault Secrets Officer to deployer." }
    Log "Role granted. Waiting 20s for RBAC propagation..."
    Start-Sleep -Seconds 20
} else {
    Log "Key Vault Secrets Officer already assigned to deployer, skipping wait."
}

Log "Storing secrets in Key Vault..."
foreach ($entry in $secrets.GetEnumerator()) {
    az keyvault secret set --vault-name $KV_NAME --name $entry.Key --value $entry.Value | Out-Null
    if ($LASTEXITCODE -ne 0) { Die "Failed to store secret: $($entry.Key)" }
    Log "  Stored: $($entry.Key)"
}

# Capture version-less Key Vault secret URIs (used in Phase 4 --secrets flag)
$KV_SECRET_URIS = @{}
foreach ($key in $secrets.Keys) {
    $uri = (az keyvault secret show --vault-name $KV_NAME --name $key | ConvertFrom-Json).id
    $KV_SECRET_URIS[$key] = ($uri -replace '/[^/]+$', '')
    Log "  URI: $($KV_SECRET_URIS[$key])"
}

# ── 2.6 Storage Account + blob container ──────────────────────────────────────
Log "Creating Storage Account: $SA_NAME..."
$saRaw = az storage account create --name $SA_NAME --resource-group $RG --sku Standard_LRS --location $LOCATION
if ($LASTEXITCODE -ne 0) { Die "Storage account creation failed. Raw output: $saRaw" }
$saJson = $saRaw | ConvertFrom-Json
$SA_ID = $saJson.id
Log "Storage account created: $SA_ID"

Log "Creating blob container: $BLOB_CTR..."
az storage container create --name $BLOB_CTR --account-name $SA_NAME --auth-mode login | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Blob container creation failed." }
Log "Blob container '$BLOB_CTR' created."

# ── 2.7 Managed Identity + role assignments ────────────────────────────────────
Log "Creating Managed Identity: $MI_NAME..."
$miRaw = az identity create --name $MI_NAME --resource-group $RG
if ($LASTEXITCODE -ne 0) { Die "Managed Identity creation failed. Raw output: $miRaw" }
$miJson = $miRaw | ConvertFrom-Json
$MI_RESOURCE_ID    = $miJson.id
$MI_PRINCIPAL_ID   = $miJson.principalId
$MI_CLIENT_ID      = $miJson.clientId
Log "Identity principal ID: $MI_PRINCIPAL_ID"
Log "Identity client ID:    $MI_CLIENT_ID"

Log "Waiting 30s for identity propagation before role assignments..."
Start-Sleep -Seconds 30

$ACR_SCOPE = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME"
$KV_SCOPE  = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME"
$SA_SCOPE  = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.Storage/storageAccounts/$SA_NAME"

Log "Assigning AcrPull..."
az role assignment create --assignee $MI_PRINCIPAL_ID --role "AcrPull" --scope $ACR_SCOPE | Out-Null
if ($LASTEXITCODE -ne 0) { Die "AcrPull role assignment failed." }

Log "Assigning Key Vault Secrets User..."
az role assignment create --assignee $MI_PRINCIPAL_ID --role "Key Vault Secrets User" --scope $KV_SCOPE | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Key Vault Secrets User role assignment failed." }

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
    law_resource_id      = $LAW_RESOURCE_ID
    law_customer_id      = $LAW_ID
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
