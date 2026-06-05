<#
.SYNOPSIS
  Phase 4: Deploy Container Apps -- python → backend → frontend.

.DESCRIPTION
  Deploys all three services to the Container Apps Environment.
  Reads all resource IDs from scripts/deploy-outputs.json (written by deploy-phase2.ps1).
  Idempotent: first run creates with full config; subsequent runs update the image only.
  Writes the frontend public URL to deploy-outputs.json on completion.

.PREREQUISITES
  - deploy-phase2.ps1 completed (deploy-outputs.json populated)
  - deploy-phase3.ps1 completed (images present in ACR)

.USAGE
  # Cloud Shell -- upload this script and deploy-outputs.json, then:
  ./deploy-phase4.ps1

  # From inside the repo:
  pwsh scripts/deploy-phase4.ps1
#>

param(
    [string]$OutputsFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" }
function Die($msg) { Write-Error "[FAIL] $msg"; exit 1 }

# ── Resolve outputs file ──────────────────────────────────────────────────────
$SCRIPT_DIR = $PSScriptRoot
if (-not $SCRIPT_DIR) { $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path }

if ($OutputsFile -and (Test-Path $OutputsFile)) {
    $OUTPUTS_FILE = $OutputsFile
} else {
    $OUTPUTS_FILE = @(
        (Join-Path $SCRIPT_DIR "deploy-outputs.json"),
        (Join-Path $SCRIPT_DIR "../deploy-outputs.json"),
        (Join-Path (Get-Location) "deploy-outputs.json")
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $OUTPUTS_FILE) {
    Die "deploy-outputs.json not found. Run deploy-phase2.ps1 first."
}
Log "Outputs file: $OUTPUTS_FILE"

# ── Pre-flight ────────────────────────────────────────────────────────────────
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Die "Azure CLI not found. Use Azure Cloud Shell."
}
$accountRaw = az account show 2>$null
if (-not $accountRaw) { Die "Not logged in. Run: az login" }
$account = $accountRaw | ConvertFrom-Json
Log "Logged in as: $($account.user.name) -- $($account.name)"

# ── Read outputs ──────────────────────────────────────────────────────────────
$out = Get-Content $OUTPUTS_FILE | ConvertFrom-Json

$SUB_ID     = $out.subscription_id
$RG         = $out.resource_group
$ACR_SERVER = $out.acr_login_server
$ENV_NAME   = $out.env_name
$KV_NAME    = $out.kv_name
$MI_ID      = $out.identity_resource_id
$ENV_DOMAIN = $out.env_default_domain

$KV_OPENAI_URI = $out.kv_secret_uris.'OPENAI-API-KEY'
$KV_DB_URL_URI = $out.kv_secret_uris.'DATABASE-URL'

foreach ($v in @($SUB_ID,$RG,$ACR_SERVER,$ENV_NAME,$KV_NAME,$MI_ID,$ENV_DOMAIN,$KV_OPENAI_URI,$KV_DB_URL_URI)) {
    if (-not $v -or $v -like "<pending*") { Die "deploy-outputs.json has unpopulated values -- re-run deploy-phase2.ps1" }
}

az account set --subscription $SUB_ID
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription." }

# Derived values
$FRONTEND_FQDN  = "truepath-frontend.$ENV_DOMAIN"
$FRONTEND_URL   = "https://$FRONTEND_FQDN"
$CORS_ORIGIN    = $FRONTEND_URL

# Shared secret refs (same set on python and backend)
$COMMON_SECRETS = @(
    "openai-key=keyvaultref:$KV_OPENAI_URI,identityref:$MI_ID",
    "database-url=keyvaultref:$KV_DB_URL_URI,identityref:$MI_ID"
)
$COMMON_SECRET_ENVVARS = @(
    "OPENAI_API_KEY=secretref:openai-key",
    "DATABASE_URL=secretref:database-url"
)

# ── Helper: deploy or update a container app ──────────────────────────────────
function Deploy-ContainerApp {
    param(
        [string]$Name,
        [string]$Image,
        [string]$IngressType,
        [int]$TargetPort,
        [string[]]$Secrets,
        [string[]]$EnvVars
    )

    $existingRaw = az containerapp show --name $Name --resource-group $RG 2>$null
    if ($LASTEXITCODE -eq 0 -and $existingRaw) {
        Log "$Name already exists -- updating image to $Image..."
        az containerapp update `
            --name $Name `
            --resource-group $RG `
            --image $Image
        if ($LASTEXITCODE -ne 0) { Die "Failed to update $Name." }
        Log "$Name updated."
    } else {
        Log "Creating $Name (image: $Image, ingress: $IngressType, port: $TargetPort)..."
        $createArgs = @(
            "containerapp", "create",
            "--name",             $Name,
            "--resource-group",   $RG,
            "--environment",      $ENV_NAME,
            "--image",            $Image,
            "--registry-server",  $ACR_SERVER,
            "--user-assigned",    $MI_ID,
            "--registry-identity",$MI_ID,
            "--ingress",          $IngressType,
            "--target-port",      "$TargetPort",
            "--min-replicas",     "1",
            "--max-replicas",     "3",
            "--secrets"
        ) + $Secrets + @("--env-vars") + $EnvVars

        az @createArgs
        if ($LASTEXITCODE -ne 0) { Die "Failed to create $Name." }
        Log "$Name created."
    }

    # Confirm provisioning state
    $state = az containerapp show --name $Name --resource-group $RG --query "properties.provisioningState" -o tsv 2>$null
    if ($state -ne "Succeeded") {
        Die "$Name provisioning state is '$state' -- expected Succeeded. Check Azure Portal logs."
    }
    Log "$Name provisioning state: $state"
}

# ── 4.1 Python services (internal) ───────────────────────────────────────────
Log "Step 4.1 -- truepath-python"
Deploy-ContainerApp `
    -Name        "truepath-python" `
    -Image       "$ACR_SERVER/truepath-python:staging" `
    -IngressType "internal" `
    -TargetPort  8000 `
    -Secrets     $COMMON_SECRETS `
    -EnvVars     ($COMMON_SECRET_ENVVARS + @("STORAGE_MODE=local"))

# ── 4.2 Express backend (internal) ───────────────────────────────────────────
Log "Step 4.2 -- truepath-backend"
Deploy-ContainerApp `
    -Name        "truepath-backend" `
    -Image       "$ACR_SERVER/truepath-backend:staging" `
    -IngressType "internal" `
    -TargetPort  4000 `
    -Secrets     $COMMON_SECRETS `
    -EnvVars     ($COMMON_SECRET_ENVVARS + @(
        "PYTHON_SERVICES_URL=http://truepath-python",
        "CORS_ORIGIN=$CORS_ORIGIN",
        "PORT=4000",
        "NODE_ENV=production",
        "OPENAI_MODEL=gpt-4o",
        "OPENAI_FOLLOWUP_MODEL=gpt-4.1-mini",
        "OPENAI_EMBEDDING_MODEL=text-embedding-3-small",
        "OPENAI_SKILLS_MODEL=gpt-4.1-mini"
    ))

# ── 4.3 Next.js frontend (external) ──────────────────────────────────────────
Log "Step 4.3 -- truepath-frontend"
Deploy-ContainerApp `
    -Name        "truepath-frontend" `
    -Image       "$ACR_SERVER/truepath-frontend:staging" `
    -IngressType "external" `
    -TargetPort  3000 `
    -Secrets     @() `
    -EnvVars     @(
        "BACKEND_URL=http://truepath-backend",
        "NODE_ENV=production",
        "NEXT_TELEMETRY_DISABLED=1",
        "NEXT_PUBLIC_ENV=staging"
    )

# ── Get frontend public URL ───────────────────────────────────────────────────
$actualFqdn = az containerapp show `
    --name truepath-frontend `
    --resource-group $RG `
    --query "properties.configuration.ingress.fqdn" -o tsv
if (-not $actualFqdn) { Die "Could not retrieve frontend FQDN." }

# Persist URL to outputs file
$outObj = Get-Content $OUTPUTS_FILE | ConvertFrom-Json
$outObj | Add-Member -NotePropertyName "frontend_url" -NotePropertyValue "https://$actualFqdn" -Force
$outObj | ConvertTo-Json -Depth 6 | Set-Content -Path $OUTPUTS_FILE -Encoding UTF8
Log "Frontend URL saved to $OUTPUTS_FILE"

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================"
Write-Host " PHASE 4 COMPLETE"
Write-Host "============================================"
Write-Host " truepath-python   : internal (http://truepath-python)"
Write-Host " truepath-backend  : internal (http://truepath-backend)"
Write-Host " truepath-frontend : $FRONTEND_URL"
Write-Host " Actual FQDN       : https://$actualFqdn"
Write-Host "============================================"
Write-Host " Next: Phase 5 (RAG job) or go straight to Phase 6 validation"
