<#
.SYNOPSIS
  Phase 3: Build and push Docker images to Azure Container Registry using ACR Tasks.

.DESCRIPTION
  Uses `az acr build` — no local Docker daemon required.
  Reads ACR name from deploy-outputs.json (written by deploy-phase2.ps1).
  Fully idempotent — safe to re-run; each `az acr build` overwrites the :staging tag.

  Build source resolution order:
    1. $PSScriptRoot/.. if it contains frontend/ backend/ services/ (running from inside the repo)
    2. -RepoRoot param if provided
    3. GitHub URL (requires -GitHubPat with a Personal Access Token that has repo read scope)
       az acr build pulls directly from GitHub — no local clone needed.

  To create a GitHub PAT:
    GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
    Scopes required: repo (read)

.PREREQUISITES
  - Azure CLI installed and logged in (auto in Cloud Shell)
  - deploy-phase2.ps1 must have run successfully (deploy-outputs.json next to this script)
  - GitHub PAT required only when running outside the repo (e.g. Cloud Shell standalone)

.USAGE
  # Cloud Shell — upload this script and deploy-outputs.json, then:
  ./deploy-phase3.ps1 -GitHubPat <your-pat>

  # From inside the repo (no PAT needed):
  pwsh scripts/deploy-phase3.ps1
#>

param(
    [string]$RepoRoot  = "",
    [string]$RepoUrl   = "https://github.com/arundhati-TRUEPath/truepath.git",
    [string]$GitHubPat = $env:GITHUB_PAT   # fallback: set GITHUB_PAT env var
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" }
function Die($msg) { Write-Error "[FAIL] $msg"; exit 1 }

function Test-RepoRoot($path) {
    return (Test-Path $path) -and
           (Test-Path (Join-Path $path "frontend")) -and
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

# ── Read outputs ──────────────────────────────────────────────────────────────
$out = Get-Content $OUTPUTS_FILE | ConvertFrom-Json
$ACR_NAME   = $out.acr_name
$ACR_SERVER = $out.acr_login_server
$SUB_ID     = $out.subscription_id

if (-not $ACR_NAME)   { Die "acr_name missing in deploy-outputs.json — re-run deploy-phase2.ps1" }
if (-not $ACR_SERVER) { Die "acr_login_server missing in deploy-outputs.json — re-run deploy-phase2.ps1" }

az account set --subscription $SUB_ID
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription $SUB_ID." }

# ── Resolve build source ──────────────────────────────────────────────────────
# Prefer local paths (no PAT needed). Fall back to GitHub URL if running standalone.
$useLocal = $false
$localRoot = ""

if ($RepoRoot -ne "" -and (Test-RepoRoot $RepoRoot)) {
    $localRoot = $RepoRoot
    $useLocal  = $true
    Log "Using provided repo root: $localRoot"
} elseif (Test-RepoRoot (Join-Path $SCRIPT_DIR "..")) {
    $localRoot = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path
    $useLocal  = $true
    Log "Running from inside repo: $localRoot"
} else {
    # Cloud Shell standalone — build directly from GitHub URL (no clone)
    if (-not $GitHubPat) {
        Die @"
No local repo found and -GitHubPat was not provided.
Supply a GitHub Personal Access Token (repo read scope):
  ./deploy-phase3.ps1 -GitHubPat <your-pat>
Or set the GITHUB_PAT environment variable before running.
Create a PAT at: GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
"@
    }
    Log "No local repo — will build directly from GitHub via az acr build."
}

# Build service definitions: local path or GitHub sub-tree URL
$services = @(
    [ordered]@{ Name = "truepath-frontend"; LocalContext = "frontend"; GitSubdir = "frontend" },
    [ordered]@{ Name = "truepath-backend";  LocalContext = "backend";  GitSubdir = "backend"  },
    [ordered]@{ Name = "truepath-python";   LocalContext = "services"; GitSubdir = "services" }
)

# ── Verify Dockerfiles (local mode only) ─────────────────────────────────────
if ($useLocal) {
    foreach ($svc in $services) {
        $ctx = Join-Path $localRoot $svc.LocalContext
        if (-not (Test-Path (Join-Path $ctx "Dockerfile"))) {
            Die "Dockerfile not found at $ctx/Dockerfile"
        }
    }
    Log "All Dockerfiles verified."
}

# ── Build + push via ACR Tasks ────────────────────────────────────────────────
foreach ($svc in $services) {
    $image = "$($svc.Name):staging"
    Log "Building $image ..."
    if ($useLocal) {
        $context = Join-Path $localRoot $svc.LocalContext
        az acr build --registry $ACR_NAME --image $image $context
    } else {
        # az acr build fetches directly from GitHub — no local clone needed
        $gitContext = "$RepoUrl#main:$($svc.GitSubdir)"
        az acr build --registry $ACR_NAME --image $image --git-access-token $GitHubPat $gitContext
    }
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
