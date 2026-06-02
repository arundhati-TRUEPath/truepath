<#
.SYNOPSIS
  Phase 3: Build and push Docker images to Azure Container Registry using ACR Tasks.

.DESCRIPTION
  Uses `az acr build` — no local Docker daemon required.
  Reads ACR name and Key Vault name from deploy-outputs.json (written by deploy-phase2.ps1).
  Fully idempotent — safe to re-run; each `az acr build` overwrites the :staging tag.

  Build source resolution order:
    1. $PSScriptRoot/.. if it contains frontend/ backend/ services/ (running from inside the repo)
    2. -RepoRoot param if provided
    3. Clone/pull into ~/truepath-src using PAT from Key Vault (GITHUB-PAT secret).
       PAT is used only for the git operation, immediately wiped from remote config and memory.
       az acr build then uses the local clone — PAT never appears in any az CLI argument.

  GitHub PAT setup (one-time):
    1. Create a PAT at GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
       Scopes required: repo (read)
    2. Add GITHUB_PAT=<token> to backend/.env
    3. Re-run deploy-phase2.ps1 — it stores the PAT in Key Vault as GITHUB-PAT

.PREREQUISITES
  - Azure CLI installed and logged in (auto in Cloud Shell)
  - deploy-phase2.ps1 must have run successfully (deploy-outputs.json next to this script)
  - GITHUB-PAT stored in Key Vault (via deploy-phase2.ps1) when running outside the repo

.USAGE
  # Cloud Shell — upload this script and deploy-outputs.json, then:
  ./deploy-phase3.ps1

  # From inside the repo (Key Vault lookup skipped — local paths used):
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
$KV_NAME    = $out.kv_name

if (-not $ACR_NAME)   { Die "acr_name missing in deploy-outputs.json — re-run deploy-phase2.ps1" }
if (-not $ACR_SERVER) { Die "acr_login_server missing in deploy-outputs.json — re-run deploy-phase2.ps1" }
if (-not $KV_NAME)    { Die "kv_name missing in deploy-outputs.json — re-run deploy-phase2.ps1" }

az account set --subscription $SUB_ID
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription $SUB_ID." }

# ── Resolve build source ──────────────────────────────────────────────────────
# Prefer local paths (no Key Vault lookup needed).
# Fall back to GitHub URL — PAT fetched from Key Vault, never passed on CLI.
$useLocal  = $false
$localRoot = ""
$GitHubPat = $null

if ($RepoRoot -ne "" -and (Test-RepoRoot $RepoRoot)) {
    $localRoot = $RepoRoot
    $useLocal  = $true
    Log "Using provided repo root: $localRoot"
} elseif (Test-RepoRoot (Join-Path $SCRIPT_DIR "..")) {
    $localRoot = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path
    $useLocal  = $true
    Log "Running from inside repo: $localRoot"
} else {
    # Cloud Shell standalone — clone/pull using PAT from Key Vault
    Log "No local repo found — fetching GITHUB-PAT from Key Vault ($KV_NAME)..."
    $GitHubPat = az keyvault secret show --vault-name $KV_NAME --name "GITHUB-PAT" --query "value" -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $GitHubPat) {
        Die @"
GITHUB-PAT secret not found in Key Vault '$KV_NAME'.
Store it once by adding GITHUB_PAT=<token> to backend/.env and re-running deploy-phase2.ps1.
Token requires 'repo' read scope — create at:
  GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
"@
    }
    Log "GitHub PAT retrieved from Key Vault."

    $cloneTarget = Join-Path $HOME "truepath-src"
    $authUrl  = "https://oauth2:$GitHubPat@github.com/arundhati-TRUEPath/truepath.git"
    $cleanUrl = $RepoUrl

    if (Test-Path $cloneTarget) {
        Log "Repo exists at $cloneTarget — pulling latest..."
        git -C $cloneTarget remote set-url origin $authUrl
        git -C $cloneTarget pull
        if ($LASTEXITCODE -ne 0) { Die "git pull failed." }
    } else {
        Log "Cloning into $cloneTarget..."
        git clone $authUrl $cloneTarget
        if ($LASTEXITCODE -ne 0) { Die "git clone failed." }
    }

    # Wipe PAT from remote config and memory immediately — not needed after this point
    git -C $cloneTarget remote set-url origin $cleanUrl
    $GitHubPat = $null
    $authUrl   = $null

    if (-not (Test-RepoRoot $cloneTarget)) {
        Die "Cloned repo at $cloneTarget is missing expected directories."
    }
    $localRoot = $cloneTarget
    $useLocal  = $true
    Log "Repo ready at $localRoot"
}

# Build service definitions: local path or GitHub sub-tree URL
$services = @(
    [ordered]@{ Name = "truepath-frontend"; LocalContext = "frontend"; GitSubdir = "frontend" },
    [ordered]@{ Name = "truepath-backend";  LocalContext = "backend";  GitSubdir = "backend"  },
    [ordered]@{ Name = "truepath-python";   LocalContext = "services"; GitSubdir = "services" }
)

# ── Verify Dockerfiles ────────────────────────────────────────────────────────
foreach ($svc in $services) {
    $ctx = Join-Path $localRoot $svc.LocalContext
    if (-not (Test-Path (Join-Path $ctx "Dockerfile"))) {
        Die "Dockerfile not found at $ctx/Dockerfile"
    }
}
Log "All Dockerfiles verified."

# ── Build + push via ACR Tasks ────────────────────────────────────────────────
foreach ($svc in $services) {
    $image   = "$($svc.Name):staging"
    $context = Join-Path $localRoot $svc.LocalContext
    Log "Building $image from $context ..."
    az acr build --registry $ACR_NAME --image $image $context
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
