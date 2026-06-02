<#
.SYNOPSIS
  Phase 3: Build and push Docker images to Azure Container Registry using ACR Tasks.

.DESCRIPTION
  Uses `az acr build` — no local Docker daemon required.
  Source context is uploaded to ACR, which builds the images inside Azure.
  Reads ACR name from deploy-outputs.json (written by deploy-phase2.ps1).
  Fully idempotent — safe to re-run; each `az acr build` overwrites the :staging tag.

  Repo resolution order:
    1. -RepoRoot param if provided and exists
    2. $PSScriptRoot/.. if it contains frontend/ backend/ services/ (script is inside the repo)
    3. Auto-clone from $RepoUrl into ~/truepath-src (Cloud Shell case)
       If the clone target already exists, `git pull` to get latest instead.

.PREREQUISITES
  - Azure CLI installed and logged in (auto in Cloud Shell)
  - deploy-phase2.ps1 must have run successfully (deploy-outputs.json next to this script)

.USAGE
  # Cloud Shell — upload this script and deploy-outputs.json, then:
  ./deploy-phase3.ps1

  # From inside the repo:
  pwsh scripts/deploy-phase3.ps1
#>

param(
    [string]$RepoRoot = "",
    [string]$RepoUrl  = "https://github.com/arundhati-TRUEPath/truepath.git"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" }
function Die($msg) { Write-Error "[FAIL] $msg"; exit 1 }

function Test-RepoRoot($path) {
    return (Test-Path (Join-Path $path "frontend")) -and
           (Test-Path (Join-Path $path "backend"))  -and
           (Test-Path (Join-Path $path "services"))
}

# ── Resolve outputs file ──────────────────────────────────────────────────────
$SCRIPT_DIR = $PSScriptRoot
if (-not $SCRIPT_DIR) { $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path }

$OUTPUTS_FILE = @(
    (Join-Path $SCRIPT_DIR "deploy-outputs.json"),
    (Join-Path $SCRIPT_DIR "../deploy-outputs.json"),
    (Join-Path (Get-Location) "deploy-outputs.json")
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $OUTPUTS_FILE) {
    Die "deploy-outputs.json not found. Run deploy-phase2.ps1 first, or place the file next to this script."
}
Log "Outputs file: $OUTPUTS_FILE"

# ── Pre-flight ────────────────────────────────────────────────────────────────
Log "Checking prerequisites..."

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Die "Azure CLI not found. Use Azure Cloud Shell."
}

$accountRaw = az account show 2>$null
if (-not $accountRaw) { Die "Not logged in. Run: az login" }
$account = $accountRaw | ConvertFrom-Json
Log "Logged in as: $($account.user.name) — $($account.name)"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Die "git not found. Azure Cloud Shell includes git — ensure you are running in Cloud Shell."
}

# ── Read outputs ──────────────────────────────────────────────────────────────
$out = Get-Content $OUTPUTS_FILE | ConvertFrom-Json
$ACR_NAME   = $out.acr_name
$ACR_SERVER = $out.acr_login_server
$SUB_ID     = $out.subscription_id

if (-not $ACR_NAME)   { Die "acr_name missing in deploy-outputs.json — re-run deploy-phase2.ps1" }
if (-not $ACR_SERVER) { Die "acr_login_server missing in deploy-outputs.json — re-run deploy-phase2.ps1" }

az account set --subscription $SUB_ID
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription $SUB_ID." }

# ── Resolve repo root ─────────────────────────────────────────────────────────
if ($RepoRoot -ne "" -and (Test-Path $RepoRoot) -and (Test-RepoRoot $RepoRoot)) {
    $REPO_ROOT = $RepoRoot
    Log "Using provided repo root: $REPO_ROOT"
} elseif (Test-RepoRoot (Join-Path $SCRIPT_DIR "..")) {
    $REPO_ROOT = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path
    Log "Running from inside repo: $REPO_ROOT"
} else {
    # Cloud Shell / standalone: clone or update the repo
    $cloneTarget = Join-Path $HOME "truepath-src"
    if (Test-Path $cloneTarget) {
        Log "Repo already cloned at $cloneTarget — pulling latest..."
        git -C $cloneTarget pull
        if ($LASTEXITCODE -ne 0) { Die "git pull failed in $cloneTarget" }
    } else {
        Log "Cloning $RepoUrl into $cloneTarget..."
        git clone $RepoUrl $cloneTarget
        if ($LASTEXITCODE -ne 0) { Die "git clone failed. Check repo URL and network access." }
    }
    if (-not (Test-RepoRoot $cloneTarget)) {
        Die "Cloned repo at $cloneTarget is missing expected directories (frontend/, backend/, services/). Check the repo URL."
    }
    $REPO_ROOT = $cloneTarget
    Log "Repo root: $REPO_ROOT"
}

# ── Verify Dockerfiles ────────────────────────────────────────────────────────
$services = @(
    [ordered]@{ Name = "truepath-frontend"; Context = (Join-Path $REPO_ROOT "frontend") },
    [ordered]@{ Name = "truepath-backend";  Context = (Join-Path $REPO_ROOT "backend")  },
    [ordered]@{ Name = "truepath-python";   Context = (Join-Path $REPO_ROOT "services") }
)

foreach ($svc in $services) {
    if (-not (Test-Path (Join-Path $svc.Context "Dockerfile"))) {
        Die "Dockerfile not found at $($svc.Context)/Dockerfile"
    }
}
Log "All Dockerfiles verified."

# ── Build + push via ACR Tasks ────────────────────────────────────────────────
foreach ($svc in $services) {
    $image = "$($svc.Name):staging"
    Log "Building $image ..."
    az acr build `
        --registry $ACR_NAME `
        --image $image `
        $svc.Context
    if ($LASTEXITCODE -ne 0) { Die "Build failed for $image. See ACR build log above." }
    Log "$image pushed to $ACR_SERVER."
}

# ── Verify images in ACR ──────────────────────────────────────────────────────
Log "Verifying images in ACR..."
$allOk = $true
foreach ($svc in $services) {
    $tagRaw = az acr repository show-tags --name $ACR_NAME --repository $svc.Name --query "[?@=='staging']" -o tsv 2>$null
    if ($tagRaw -and $tagRaw.Trim() -eq "staging") {
        Log "  $($svc.Name):staging — OK"
    } else {
        Write-Host "[WARN] $($svc.Name):staging not confirmed in ACR"
        $allOk = $false
    }
}
if (-not $allOk) { Die "One or more images missing from ACR after build." }

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
