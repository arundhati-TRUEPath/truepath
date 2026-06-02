<#
.SYNOPSIS
  Single entry point for all TruePath staging deployment phases.

.DESCRIPTION
  Upload this script and deploy-phase2.ps1 to Cloud Shell once.
  After that, run ./run.ps1 -Phase N for every phase — no further uploads needed.

  Phase 2 : runs deploy-phase2.ps1 from the same directory (KV doesn't exist yet)
  Phase 3+ : pulls latest scripts from GitHub repo via KV-stored PAT, then runs the phase

  This means bug fixes pushed to the repo are picked up automatically on the next run.

.USAGE
  # One-time upload to Cloud Shell: run.ps1 + deploy-phase2.ps1 + .env
  # Then:
  ./run.ps1 -Phase 2 -EnvFile /home/arundhati/.env
  ./run.ps1 -Phase 3
  ./run.ps1 -Phase 4
  ./run.ps1 -Phase 5
#>

param(
    [Parameter(Mandatory)][ValidateRange(2,5)][int]$Phase,
    [string]$EnvFile   = "/home/arundhati/.env",
    [string]$RepoUrl   = "https://github.com/arundhati-TRUEPath/truepath.git",
    [string]$RepoDir   = "$HOME/truepath-src"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" }
function Die($msg) { Write-Error "[FAIL] $msg"; exit 1 }

$HERE = $PSScriptRoot
if (-not $HERE) { $HERE = Split-Path -Parent $MyInvocation.MyCommand.Path }

# ── Phase 2 — run directly (Key Vault doesn't exist yet) ─────────────────────
if ($Phase -eq 2) {
    $phase2 = Join-Path $HERE "deploy-phase2.ps1"
    if (-not (Test-Path $phase2)) {
        Die "deploy-phase2.ps1 not found next to run.ps1. Upload both files together."
    }
    Log "Running Phase 2..."
    & pwsh $phase2 -EnvFile $EnvFile
    exit $LASTEXITCODE
}

# ── Phase 3+ — pull latest scripts from repo, then run ───────────────────────

# Locate deploy-outputs.json (written by Phase 2 to the same dir as run.ps1)
$outputsFile = Join-Path $HERE "deploy-outputs.json"
if (-not (Test-Path $outputsFile)) {
    Die "deploy-outputs.json not found at $outputsFile. Run Phase 2 first."
}
$out    = Get-Content $outputsFile | ConvertFrom-Json
$KV     = $out.kv_name
$SUB_ID = $out.subscription_id

if (-not $KV)    { Die "kv_name missing in deploy-outputs.json — re-run Phase 2." }
if (-not $SUB_ID) { Die "subscription_id missing in deploy-outputs.json — re-run Phase 2." }

# Set subscription
az account set --subscription $SUB_ID 2>$null
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription. Are you logged in? (az login)" }

# Fetch PAT from Key Vault
Log "Fetching GITHUB-PAT from Key Vault ($KV)..."
$pat = az keyvault secret show --vault-name $KV --name "GITHUB-PAT" --query "value" -o tsv 2>$null
if ($LASTEXITCODE -ne 0 -or -not $pat) {
    Die "GITHUB-PAT not found in Key Vault '$KV'. Add GITHUB_PAT to .env and re-run Phase 2."
}
Log "PAT retrieved."

# Clone or pull repo
$authUrl  = "https://oauth2:$pat@github.com/arundhati-TRUEPath/truepath.git"
$cleanUrl = $RepoUrl
if (Test-Path $RepoDir) {
    Log "Updating repo at $RepoDir..."
    git -C $RepoDir remote set-url origin $authUrl
    git -C $RepoDir pull --quiet
    if ($LASTEXITCODE -ne 0) { Die "git pull failed." }
} else {
    Log "Cloning repo into $RepoDir..."
    git clone --quiet $authUrl $RepoDir
    if ($LASTEXITCODE -ne 0) { Die "git clone failed." }
}
git -C $RepoDir remote set-url origin $cleanUrl
$pat     = $null
$authUrl = $null
Log "Repo up to date."

# Run phase script from repo, with working dir set to HERE so deploy-outputs.json is found
$phaseScript = Join-Path $RepoDir "scripts/deploy-phase$Phase.ps1"
if (-not (Test-Path $phaseScript)) {
    Die "deploy-phase$Phase.ps1 not found in repo at $phaseScript"
}

Log "Running Phase $Phase from repo..."
& pwsh $phaseScript -OutputsFile $outputsFile
exit $LASTEXITCODE
