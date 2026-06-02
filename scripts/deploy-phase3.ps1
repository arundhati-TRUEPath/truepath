<#
.SYNOPSIS
  Phase 3: Build and push Docker images to Azure Container Registry using ACR Tasks.

.DESCRIPTION
  Uses `az acr build` — no local Docker daemon required.
  Source context is uploaded from the local repo to ACR, which builds in Azure.
  Reads ACR name from scripts/deploy-outputs.json (written by deploy-phase2.ps1).
  Fully idempotent — safe to re-run; each `az acr build` overwrites the :staging tag.

.PREREQUISITES
  - Azure CLI installed and logged in (`az login`)
  - deploy-phase2.ps1 must have run successfully (deploy-outputs.json must exist)
  - Repo root must be accessible (script resolves it from $PSScriptRoot automatically)

.USAGE
  # From repo root:
  pwsh scripts/deploy-phase3.ps1

  # From scripts/ directory:
  ./deploy-phase3.ps1

  # Override repo root (e.g. cloned to a different path):
  pwsh scripts/deploy-phase3.ps1 -RepoRoot /home/arundhati/truepath
#>

param(
    [string]$RepoRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" }
function Die($msg) { Write-Error "[FAIL] $msg"; exit 1 }

# ── Resolve paths ─────────────────────────────────────────────────────────────
$SCRIPT_DIR = $PSScriptRoot
if (-not $SCRIPT_DIR) { $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path }

if ($RepoRoot -ne "" -and (Test-Path $RepoRoot)) {
    $REPO_ROOT = $RepoRoot
} else {
    $REPO_ROOT = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path
}

$OUTPUTS_FILE = Join-Path $SCRIPT_DIR "deploy-outputs.json"
# Cloud Shell: outputs file may be next to the script in home dir
if (-not (Test-Path $OUTPUTS_FILE)) {
    $OUTPUTS_FILE = Join-Path $SCRIPT_DIR "../deploy-outputs.json"
}
if (-not (Test-Path $OUTPUTS_FILE)) {
    $OUTPUTS_FILE = Join-Path (Get-Location) "deploy-outputs.json"
}
if (-not (Test-Path $OUTPUTS_FILE)) {
    Die "deploy-outputs.json not found. Run deploy-phase2.ps1 first, or place the file next to this script."
}

Log "Repo root:    $REPO_ROOT"
Log "Outputs file: $OUTPUTS_FILE"

# ── Pre-flight ────────────────────────────────────────────────────────────────
Log "Checking prerequisites..."

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Die "Azure CLI not found. Use Azure Cloud Shell or install locally."
}

$accountRaw = az account show 2>$null
if (-not $accountRaw) { Die "Not logged in. Run: az login" }
$account = $accountRaw | ConvertFrom-Json
Log "Logged in as: $($account.user.name) — $($account.name)"

# ── Read outputs ──────────────────────────────────────────────────────────────
$out = Get-Content $OUTPUTS_FILE | ConvertFrom-Json
$ACR_NAME    = $out.acr_name
$ACR_SERVER  = $out.acr_login_server
$SUB_ID      = $out.subscription_id
$RG          = $out.resource_group

if (-not $ACR_NAME)   { Die "acr_name missing in deploy-outputs.json — re-run deploy-phase2.ps1" }
if (-not $ACR_SERVER) { Die "acr_login_server missing in deploy-outputs.json — re-run deploy-phase2.ps1" }

az account set --subscription $SUB_ID
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription $SUB_ID." }
Log "Active subscription: $($account.name) ($SUB_ID)"

# ── Verify build contexts exist ───────────────────────────────────────────────
$services = @(
    [ordered]@{ Name = "truepath-frontend"; Context = (Join-Path $REPO_ROOT "frontend") },
    [ordered]@{ Name = "truepath-backend";  Context = (Join-Path $REPO_ROOT "backend")  },
    [ordered]@{ Name = "truepath-python";   Context = (Join-Path $REPO_ROOT "services") }
)

foreach ($svc in $services) {
    if (-not (Test-Path $svc.Context)) {
        Die "Build context not found: $($svc.Context). Pass -RepoRoot if the repo is in a non-standard location."
    }
    $dockerfile = Join-Path $svc.Context "Dockerfile"
    if (-not (Test-Path $dockerfile)) {
        Die "Dockerfile not found at $dockerfile"
    }
}
Log "All build contexts verified."

# ── Build + push via ACR Tasks ────────────────────────────────────────────────
# `az acr build` uploads the context to Azure and builds inside ACR — no local Docker needed.
foreach ($svc in $services) {
    $image = "$($svc.Name):staging"
    Log "Building $image from $($svc.Context)..."
    az acr build `
        --registry $ACR_NAME `
        --image $image `
        $svc.Context
    if ($LASTEXITCODE -ne 0) { Die "Build failed for $image. Check the ACR build log above." }
    Log "$image built and pushed."
}

# ── Verify images in ACR ──────────────────────────────────────────────────────
Log "Verifying images in ACR..."
$allOk = $true
foreach ($svc in $services) {
    $repo = $svc.Name
    $tagRaw = az acr repository show-tags --name $ACR_NAME --repository $repo --query "[?@=='staging']" -o tsv 2>$null
    if ($tagRaw -and $tagRaw.Trim() -eq "staging") {
        Log "  $repo`:staging — OK"
    } else {
        Write-Host "[WARN] $repo`:staging not found in ACR — build may have silently failed"
        $allOk = $false
    }
}
if (-not $allOk) { Die "One or more images missing from ACR. Check the build output above." }

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================"
Write-Host " PHASE 3 COMPLETE"
Write-Host "============================================"
Write-Host " Registry: $ACR_SERVER"
foreach ($svc in $services) {
    Write-Host " Image:    $ACR_SERVER/$($svc.Name):staging"
}
Write-Host "============================================"
Write-Host " Next: run pwsh scripts/deploy-phase4.ps1"
