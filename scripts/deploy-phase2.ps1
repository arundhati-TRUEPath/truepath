<#
.SYNOPSIS
  Phase 2: Azure Infrastructure Setup for TruePath staging environment.

.DESCRIPTION
  Creates all Azure resources needed before deploying container images.
  Fully idempotent — safe to re-run after any failure point.
  Outputs resource IDs/names to scripts/deploy-outputs.json for use by Phase 3/4.

.PREREQUISITES
  - Azure CLI installed (winget install Microsoft.AzureCLI)
  - az login completed
  - az extension add --name containerapp
  - backend/.env must exist with secrets (no blank values, no quoted values)

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
$KV_NAME    = "truepath-kv-stg"
$SA_NAME    = "truepathstorage"
$BLOB_CTR   = "rag-data"
$MI_NAME    = "truepath-staging-id"

# Resolve .env: explicit param > repo layout (scripts/../backend/.env) > same dir as script > cwd
if ($EnvFile -ne "" -and (Test-Path $EnvFile)) {
    $ENV_FILE = $EnvFile
} else {
    $candidates = @(
        (Join-Path $PSScriptRoot "..\backend\.env"),
        (Join-Path $PSScriptRoot "backend\.env"),
        (Join-Path $PSScriptRoot ".env"),
        (Join-Path (Get-Location) "backend\.env"),
        (Join-Path (Get-Location) ".env")
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
    $value = ($line -split '=', 2)[1].Trim()
    if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") { $value = $Matches[1] }
    if (-not $value) { Die "Key '$key' has an empty value in $file — fill it in before running." }
    return $value
}

function Read-EnvValueOptional($file, $key) {
    $line = Get-Content $file | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
    if (-not $line) { return $null }
    $value = ($line -split '=', 2)[1].Trim()
    if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") { $value = $Matches[1] }
    if (-not $value) { return $null }
    return $value
}

# ── Pre-flight ────────────────────────────────────────────────────────────────
Log "Checking prerequisites..."

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Die "Azure CLI not found. Install options:`n  1. MSI: Invoke-WebRequest -Uri 'https://aka.ms/installazurecliwindows' -OutFile AzureCLI.msi; Start-Process msiexec '/I AzureCLI.msi /quiet' -Wait`n  2. Cloud Shell: https://shell.azure.com (no install needed)"
}

$accountRaw = az account show 2>$null
if (-not $accountRaw) { Die "Not logged in. Run: az login" }
try { $account = $accountRaw | ConvertFrom-Json }
catch { Die "az account show returned unparseable output — try: az login" }
if (-not $account) { Die "Not logged in. Run: az login" }
Log "Logged in as: $($account.user.name)"

az account set --subscription $SUB_ID
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription $SUB_ID." }
$account = az account show | ConvertFrom-Json
Log "Active subscription: $($account.name) ($($account.id))"

# Pre-flight: check if deployer can create role assignments at the RG scope.
# Required for step 2.7 (AcrPull + Storage Blob on managed identity).
# Key Vault access uses access policies (az keyvault set-policy) and does NOT need this.
$DEPLOYER_OID = (az ad signed-in-user show --query id -o tsv 2>$null)
if ($DEPLOYER_OID) {
    $rgScope = "/subscriptions/$SUB_ID/resourceGroups/$RG"
    $hasOwner = (az role assignment list --assignee $DEPLOYER_OID --role "Owner" --scope $rgScope --query "[0].id" -o tsv 2>$null)
    $hasUAA   = (az role assignment list --assignee $DEPLOYER_OID --role "User Access Administrator" --scope $rgScope --query "[0].id" -o tsv 2>$null)
    if (-not $hasOwner -and -not $hasUAA) {
        Write-Host ""
        Write-Host "┌─────────────────────────────────────────────────────────────────┐"
        Write-Host "│ WARNING: Deployer lacks Owner / User Access Administrator at RG  │"
        Write-Host "│ Step 2.7 role assignments (AcrPull, Storage Blob) will fail.     │"
        Write-Host "│                                                                   │"
        Write-Host "│ Ask your Azure admin to run ONCE:                                 │"
        Write-Host "│   az role assignment create --assignee $DEPLOYER_OID             │"
        Write-Host "│     --role Owner --scope $rgScope │"
        Write-Host "│                                                                   │"
        Write-Host "│ Script will continue — Key Vault uses access policies (no Owner) │"
        Write-Host "└─────────────────────────────────────────────────────────────────┘"
        Write-Host ""
    }
}

if (-not $ENV_FILE -or -not (Test-Path $ENV_FILE)) {
    Die "No .env file found. Tried backend/.env, .env next to script, and cwd. Use -EnvFile to specify the path explicitly."
}
Log "Using .env file: $ENV_FILE"

# ── Read secrets from backend/.env ───────────────────────────────────────────
Log "Reading secrets from backend/.env..."
$secrets = @{
    "OPENAI-API-KEY" = Read-EnvValue $ENV_FILE "OPENAI_API_KEY"
    "DATABASE-URL"   = Read-EnvValue $ENV_FILE "DATABASE_URL"
}

# GITHUB-PAT is optional — needed by Phase 3 to pull source from GitHub.
# Add GITHUB_PAT=<token> to .env to have it stored securely in Key Vault.
# Token requires repo read scope. Create at:
#   GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
$githubPatValue = Read-EnvValueOptional $ENV_FILE "GITHUB_PAT"
if ($githubPatValue) {
    $secrets["GITHUB-PAT"] = $githubPatValue
    Log "GITHUB_PAT found — will store in Key Vault for Phase 3."
} else {
    Log "GITHUB_PAT not in .env — skipping. Phase 3 requires it; add it and re-run this script."
}
Log "Secrets loaded: $($secrets.Keys -join ', ')"

# ── 2.1 Ensure extensions + register resource providers ──────────────────────
Log "Ensuring required az extensions..."
az extension add --name containerapp --only-show-errors 2>$null
az extension add --name log-analytics --only-show-errors 2>$null
Log "Extensions ready."

Log "Registering required resource providers (safe to run even if already registered)..."
$providers = @(
    "Microsoft.ContainerRegistry",
    "Microsoft.App",
    "Microsoft.OperationalInsights",
    "Microsoft.KeyVault",
    "Microsoft.Storage",
    "Microsoft.ManagedIdentity"
)
foreach ($ns in $providers) {
    $stateRaw = az provider show --namespace $ns --query "registrationState" -o tsv 2>$null
    if ($LASTEXITCODE -ne 0) { Die "Failed to query provider state for $ns — check subscription permissions." }
    $state = $stateRaw.Trim()
    if ($state -ne "Registered") {
        Log "  Registering $ns (state: $state) — this can take 1-3 min..."
        az provider register --namespace $ns --wait | Out-Null
        if ($LASTEXITCODE -ne 0) { Die "Failed to register provider $ns." }
        Log "  $ns registered."
    } else {
        Log "  $ns already registered."
    }
}

# ── 2.2 Azure Container Registry ─────────────────────────────────────────────
Log "Step 2.2 — Azure Container Registry: $ACR_NAME"
$acrExistingRaw = az acr show --name $ACR_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $acrExistingRaw) {
    Log "ACR $ACR_NAME already exists, reusing."
    $acrJson = $acrExistingRaw | ConvertFrom-Json
    if (-not $acrJson.loginServer) { Die "ACR exists but loginServer field is missing in response." }
    $ACR_LOGIN_SERVER = $acrJson.loginServer
} else {
    $acrRaw = az acr create `
        --name $ACR_NAME `
        --resource-group $RG `
        --sku Basic `
        --admin-enabled true `
        --location $LOCATION
    if ($LASTEXITCODE -ne 0) { Die "ACR creation failed. Raw output: $acrRaw" }
    $acrJson = $acrRaw | ConvertFrom-Json
    if (-not $acrJson.loginServer) { Die "ACR created but loginServer field missing in response." }
    $ACR_LOGIN_SERVER = $acrJson.loginServer
}
Log "ACR login server: $ACR_LOGIN_SERVER"

# ── 2.3 Log Analytics Workspace ───────────────────────────────────────────────
Log "Step 2.3 — Log Analytics Workspace: $LAW_NAME"
$lawExistingRaw = az monitor log-analytics workspace show --workspace-name $LAW_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $lawExistingRaw) {
    Log "Log Analytics Workspace $LAW_NAME already exists, reusing."
    $lawJson = $lawExistingRaw | ConvertFrom-Json
    $provState = $lawJson.provisioningState
    if ($provState -ne "Succeeded") {
        Die "Log Analytics Workspace exists but provisioningState=$provState — resolve before re-running."
    }
} else {
    $lawRaw = az monitor log-analytics workspace create `
        --workspace-name $LAW_NAME `
        --resource-group $RG `
        --location $LOCATION
    if ($LASTEXITCODE -ne 0) { Die "Log Analytics workspace creation failed. Raw output: $lawRaw" }
    $lawJson = $lawRaw | ConvertFrom-Json
    # Poll until Succeeded — get-shared-keys returns 404 if called while still provisioning
    Log "Waiting for Log Analytics Workspace to finish provisioning..."
    $maxAttempts = 60   # 5 min max (60 * 5s)
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        Start-Sleep -Seconds 5
        $provState = (az monitor log-analytics workspace show --workspace-name $LAW_NAME --resource-group $RG --query "provisioningState" -o tsv 2>$null)
        if ($provState -eq "Succeeded") { break }
        if ($provState -in @("Failed", "Canceled", "Deleting")) {
            Die "Log Analytics Workspace provisioning ended in terminal state: $provState"
        }
    }
    if ($provState -ne "Succeeded") {
        Die "Log Analytics Workspace did not reach Succeeded within $($maxAttempts * 5)s (last state: $provState)"
    }
    Log "Log Analytics Workspace provisioned."
    # Refresh to get final customerId
    $lawJson = az monitor log-analytics workspace show --workspace-name $LAW_NAME --resource-group $RG | ConvertFrom-Json
}
$LAW_RESOURCE_ID = $lawJson.id
$LAW_ID          = $lawJson.customerId
if (-not $LAW_RESOURCE_ID) { Die "Log Analytics workspace 'id' field missing in response." }
if (-not $LAW_ID) { Die "Log Analytics workspace 'customerId' (GUID) field missing — cannot proceed." }
Log "Log Analytics Workspace resource ID: $LAW_RESOURCE_ID"
Log "Log Analytics Workspace customer ID (GUID): $LAW_ID"

$lawKeysRaw = az monitor log-analytics workspace get-shared-keys `
    --workspace-name $LAW_NAME `
    --resource-group $RG
if ($LASTEXITCODE -ne 0) { Die "Failed to get LAW shared keys. Raw: $lawKeysRaw" }
$LAW_KEY = ($lawKeysRaw | ConvertFrom-Json).primarySharedKey
if (-not $LAW_KEY) { Die "primarySharedKey was null in LAW shared-keys response." }

# ── 2.4 Container Apps Environment ────────────────────────────────────────────
Log "Step 2.4 — Container Apps Environment: $ENV_NAME"
$envExistingRaw = az containerapp env show --name $ENV_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $envExistingRaw) {
    Log "Container Apps Environment $ENV_NAME already exists, reusing."
    $envJson = $envExistingRaw | ConvertFrom-Json
} else {
    $envRaw = az containerapp env create `
        --name $ENV_NAME `
        --resource-group $RG `
        --logs-workspace-id $LAW_ID `
        --logs-workspace-key $LAW_KEY `
        --location $LOCATION
    if ($LASTEXITCODE -ne 0) { Die "Container Apps Environment creation failed. Raw output: $envRaw" }
    Log "Container Apps Environment created."
    $envJson = $envRaw | ConvertFrom-Json
}
$ENV_RESOURCE_ID    = $envJson.id
$ENV_DEFAULT_DOMAIN = $envJson.properties.defaultDomain
if (-not $ENV_DEFAULT_DOMAIN) { Die "Container Apps Environment defaultDomain missing in response — cannot proceed." }
Log "Container Apps Environment default domain: $ENV_DEFAULT_DOMAIN"

# ── 2.5 Key Vault + secrets ───────────────────────────────────────────────────
# Key Vault uses ACCESS POLICIES (not RBAC) so deployer only needs Key Vault Contributor,
# not Microsoft.Authorization/roleAssignments/write (which requires Owner).
Log "Step 2.5 — Key Vault: $KV_NAME"
$kvExistingRaw = az keyvault show --name $KV_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $kvExistingRaw) {
    Log "Key Vault $KV_NAME already exists, reusing."
    $kvJson = $kvExistingRaw | ConvertFrom-Json
    if (-not $kvJson.properties -or -not $kvJson.properties.vaultUri) {
        Die "Key Vault exists but properties.vaultUri is missing in response."
    }
    $KV_URI = $kvJson.properties.vaultUri
    # If vault was created in RBAC mode, switch it to access policy mode
    if ($kvJson.properties.enableRbacAuthorization -eq $true) {
        Log "Vault is in RBAC mode — switching to access policy mode (requires only Contributor)..."
        az keyvault update --name $KV_NAME --resource-group $RG --enable-rbac-authorization false | Out-Null
        if ($LASTEXITCODE -ne 0) { Die "Failed to switch Key Vault to access policy mode." }
        Log "Vault switched to access policy mode."
    }
} else {
    # Create with access policies disabled (legacy model — no roleAssignments/write needed)
    $kvRaw = az keyvault create --name $KV_NAME --resource-group $RG --location $LOCATION --enable-rbac-authorization false
    if ($LASTEXITCODE -ne 0) { Die "Key Vault creation failed. Raw output: $kvRaw" }
    $kvJson = $kvRaw | ConvertFrom-Json
    if (-not $kvJson.properties -or -not $kvJson.properties.vaultUri) {
        Die "Key Vault created but properties.vaultUri is missing in response."
    }
    $KV_URI = $kvJson.properties.vaultUri
}
Log "Key Vault URI: $KV_URI"

# Grant deployer access via access policy — no roleAssignments/write needed.
if (-not $DEPLOYER_OID) { Die "DEPLOYER_OID not set — this should have been resolved in pre-flight." }
Log "Setting Key Vault access policy for deployer OID: $DEPLOYER_OID..."
az keyvault set-policy --name $KV_NAME --object-id $DEPLOYER_OID --secret-permissions get set list delete | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Failed to set Key Vault access policy for deployer." }
Log "Deployer access policy set."

Log "Storing secrets in Key Vault..."
foreach ($entry in $secrets.GetEnumerator()) {
    az keyvault secret set --vault-name $KV_NAME --name $entry.Key --value $entry.Value | Out-Null
    if ($LASTEXITCODE -ne 0) { Die "Failed to store secret: $($entry.Key)" }
    Log "  Stored: $($entry.Key)"
}

# Capture version-less Key Vault secret URIs (used in Phase 4 --secrets flag)
$KV_SECRET_URIS = @{}
foreach ($key in $secrets.Keys) {
    $secretRaw = az keyvault secret show --vault-name $KV_NAME --name $key
    if ($LASTEXITCODE -ne 0) { Die "Failed to read back secret '$key' from Key Vault. Raw: $secretRaw" }
    $uri = ($secretRaw | ConvertFrom-Json).id
    $KV_SECRET_URIS[$key] = ($uri -replace '/[^/]+$', '')
    Log "  URI: $($KV_SECRET_URIS[$key])"
}

# ── 2.6 Storage Account + blob container ──────────────────────────────────────
Log "Step 2.6 — Storage Account: $SA_NAME"
$saExistingRaw = az storage account show --name $SA_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $saExistingRaw) {
    Log "Storage account $SA_NAME already exists, reusing."
    $saJson = $saExistingRaw | ConvertFrom-Json
    if ($saJson.provisioningState -ne "Succeeded") {
        Die "Storage account exists but provisioningState=$($saJson.provisioningState) — resolve before re-running."
    }
    $SA_ID = $saJson.id
} else {
    $saRaw = az storage account create --name $SA_NAME --resource-group $RG --sku Standard_LRS --location $LOCATION
    if ($LASTEXITCODE -ne 0) { Die "Storage account creation failed. Raw output: $saRaw" }
    $SA_ID = ($saRaw | ConvertFrom-Json).id
}
Log "Storage account ID: $SA_ID"

Log "Creating blob container: $BLOB_CTR..."
# --auth-mode key avoids needing Storage Blob Data Contributor on the deployer identity (not assigned until 2.7).
$containerRaw = az storage container create --name $BLOB_CTR --account-name $SA_NAME --auth-mode key
if ($LASTEXITCODE -ne 0) { Die "Blob container creation failed. Raw: $containerRaw" }
Log "Blob container '$BLOB_CTR' ready."

# ── 2.7 Managed Identity + role assignments ────────────────────────────────────
Log "Step 2.7 — Managed Identity: $MI_NAME"
$miExistingRaw = az identity show --name $MI_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $miExistingRaw) {
    Log "Managed Identity $MI_NAME already exists, reusing."
    $miJson = $miExistingRaw | ConvertFrom-Json
    $isNewIdentity = $false
} else {
    $miRaw = az identity create --name $MI_NAME --resource-group $RG
    if ($LASTEXITCODE -ne 0) { Die "Managed Identity creation failed. Raw output: $miRaw" }
    $miJson = $miRaw | ConvertFrom-Json
    $isNewIdentity = $true
}
$MI_RESOURCE_ID  = $miJson.id
$MI_PRINCIPAL_ID = $miJson.principalId
$MI_CLIENT_ID    = $miJson.clientId
if (-not $MI_PRINCIPAL_ID) { Die "Managed Identity principalId missing in response." }
Log "Identity principal ID: $MI_PRINCIPAL_ID"
Log "Identity client ID:    $MI_CLIENT_ID"

# Always sleep before role assignments — AAD replication for brand-new SPs can take 1-2 min.
# On re-use the sleep is short; on new creation it's the full 30s.
$propagationSleep = if ($isNewIdentity) { 30 } else { 10 }
Log "Waiting ${propagationSleep}s for identity propagation before role assignments..."
Start-Sleep -Seconds $propagationSleep

# Key Vault access for managed identity: use access policy, not RBAC role assignment.
Log "Setting Key Vault access policy for managed identity (get + list secrets)..."
az keyvault set-policy --name $KV_NAME --object-id $MI_PRINCIPAL_ID --secret-permissions get list | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Failed to set Key Vault access policy for managed identity." }
Log "Managed identity Key Vault access policy set."

# ACR and Storage require RBAC role assignments — needs Owner at resource group scope.
$ACR_SCOPE = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME"
$SA_SCOPE  = "/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.Storage/storageAccounts/$SA_NAME"

foreach ($assignment in @(
    [ordered]@{ Role = "AcrPull";                      Scope = $ACR_SCOPE; Label = "AcrPull" },
    [ordered]@{ Role = "Storage Blob Data Contributor"; Scope = $SA_SCOPE;  Label = "Storage Blob Data Contributor" }
)) {
    $exists = (az role assignment list --assignee $MI_PRINCIPAL_ID --role $assignment.Role --scope $assignment.Scope --query "[0].id" -o tsv 2>$null)
    if (-not $exists) {
        Log "Assigning $($assignment.Label)..."
        # Use --assignee-object-id to skip AAD Graph resolution — avoids PrincipalNotFound on fresh identities.
        az role assignment create `
            --assignee-object-id $MI_PRINCIPAL_ID `
            --assignee-principal-type ServicePrincipal `
            --role $assignment.Role `
            --scope $assignment.Scope | Out-Null
        if ($LASTEXITCODE -ne 0) { Die "$($assignment.Label) role assignment failed. If this is AuthorizationFailed, you need Owner at resource group scope. See pre-flight warning above." }
        Log "$($assignment.Label) assigned."
    } else {
        Log "$($assignment.Label) already assigned, skipping."
    }
}
Log "Role assignments complete."

# ── Write outputs ─────────────────────────────────────────────────────────────
$outputs = [ordered]@{
    subscription_id        = $SUB_ID
    resource_group         = $RG
    location               = $LOCATION
    acr_name               = $ACR_NAME
    acr_login_server       = $ACR_LOGIN_SERVER
    law_resource_id        = $LAW_RESOURCE_ID
    law_customer_id        = $LAW_ID
    env_name               = $ENV_NAME
    env_resource_id        = $ENV_RESOURCE_ID
    env_default_domain     = $ENV_DEFAULT_DOMAIN
    kv_name                = $KV_NAME
    kv_uri                 = $KV_URI
    kv_secret_uris         = $KV_SECRET_URIS
    storage_account_name   = $SA_NAME
    blob_container         = $BLOB_CTR
    storage_account_id     = $SA_ID
    identity_name          = $MI_NAME
    identity_resource_id   = $MI_RESOURCE_ID
    identity_principal_id  = $MI_PRINCIPAL_ID
    identity_client_id     = $MI_CLIENT_ID
}
$outputs | ConvertTo-Json -Depth 4 | Set-Content -Path $OUT_FILE -Encoding UTF8
Log "Outputs saved to $OUT_FILE"

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================"
Write-Host " PHASE 2 COMPLETE"
Write-Host "============================================"
Write-Host " ACR:            $ACR_LOGIN_SERVER"
Write-Host " CAE domain:     $ENV_DEFAULT_DOMAIN"
Write-Host " Key Vault:      $KV_URI"
Write-Host " Storage:        $SA_NAME"
Write-Host " Identity ID:    $MI_RESOURCE_ID"
Write-Host " Outputs:     $OUT_FILE"
Write-Host "============================================"
Write-Host " Next: run .\scripts\deploy-phase3.ps1"
