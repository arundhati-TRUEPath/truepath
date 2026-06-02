<#
.SYNOPSIS
  Phase 5: Upload RAG source files and deploy the scheduled indexer job.

.DESCRIPTION
  5.1 — Uploads files from the repo's rag-data/ directory to Azure Blob Storage.
  5.2 — Creates the Container Apps Job (truepath-rag-job) with a daily 06:00 UTC schedule.
  5.3 — Triggers a manual run and waits for it to complete successfully.

  Reads all resource IDs from deploy-outputs.json (written by deploy-phase2.ps1).
  Idempotent — safe to re-run: blob upload overwrites, job creation skipped if exists.

.USAGE
  Via conductor (recommended):
    ./run.ps1 -Phase 5

  Direct (from repo root):
    pwsh scripts/deploy-phase5.ps1
#>

param(
    [string]$OutputsFile = ""
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

# ── Resolve paths ─────────────────────────────────────────────────────────────
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

# Repo root for rag-data source
if (Test-RepoRoot (Join-Path $SCRIPT_DIR "..")) {
    $REPO_ROOT = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path
} elseif (Test-RepoRoot (Get-Location)) {
    $REPO_ROOT = (Get-Location).Path
} else {
    Die "Cannot locate repo root. Run from inside the repo or via ./run.ps1 -Phase 5."
}
$RAG_DATA_DIR = Join-Path $REPO_ROOT "rag-data"
if (-not (Test-Path $RAG_DATA_DIR)) {
    Die "rag-data/ directory not found at $RAG_DATA_DIR"
}

# ── Pre-flight ────────────────────────────────────────────────────────────────
if (-not (Get-Command az -ErrorAction SilentlyContinue)) { Die "Azure CLI not found." }
$accountRaw = az account show 2>$null
if (-not $accountRaw) { Die "Not logged in. Run: az login" }
$account = $accountRaw | ConvertFrom-Json
Log "Logged in as: $($account.user.name)"

# ── Read outputs ──────────────────────────────────────────────────────────────
$out = Get-Content $OUTPUTS_FILE | ConvertFrom-Json

$SUB_ID         = $out.subscription_id
$RG             = $out.resource_group
$ACR_SERVER     = $out.acr_login_server
$ENV_NAME       = $out.env_name
$MI_ID          = $out.identity_resource_id
$SA_NAME        = $out.storage_account_name
$BLOB_CTR       = $out.blob_container
$KV_OPENAI_URI  = $out.kv_secret_uris.'OPENAI-API-KEY'
$KV_SB_URL_URI  = $out.kv_secret_uris.'SUPABASE-URL'
$KV_SB_KEY_URI  = $out.kv_secret_uris.'SUPABASE-SERVICE-KEY'

foreach ($v in @($SUB_ID,$RG,$ACR_SERVER,$ENV_NAME,$MI_ID,$SA_NAME,$BLOB_CTR,$KV_OPENAI_URI,$KV_SB_URL_URI,$KV_SB_KEY_URI)) {
    if (-not $v -or $v -like "<pending*") { Die "deploy-outputs.json has unpopulated values — re-run Phase 2." }
}

az account set --subscription $SUB_ID
if ($LASTEXITCODE -ne 0) { Die "Failed to set subscription." }

$JOB_NAME = "truepath-rag-job"
$IMAGE    = "$ACR_SERVER/truepath-python:staging"

# ── 5.1 Upload RAG files to Blob Storage ─────────────────────────────────────
Log "Step 5.1 — Uploading RAG files from $RAG_DATA_DIR to $SA_NAME/$BLOB_CTR..."
az storage blob upload-batch `
    --destination $BLOB_CTR `
    --source $RAG_DATA_DIR `
    --account-name $SA_NAME `
    --auth-mode key `
    --overwrite
if ($LASTEXITCODE -ne 0) { Die "Blob upload failed." }

$blobCount = (az storage blob list --container-name $BLOB_CTR --account-name $SA_NAME --auth-mode key --query "length(@)" -o tsv 2>$null)
Log "Blob container now has $blobCount file(s)."

# ── 5.2 Create Container Apps Job ─────────────────────────────────────────────
Log "Step 5.2 — Container Apps Job: $JOB_NAME"
$jobExistingRaw = az containerapp job show --name $JOB_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0 -and $jobExistingRaw) {
    Log "$JOB_NAME already exists — skipping create."
} else {
    Log "Creating $JOB_NAME..."
    az containerapp job create `
        --name              $JOB_NAME `
        --resource-group    $RG `
        --environment       $ENV_NAME `
        --image             $IMAGE `
        --registry-server   $ACR_SERVER `
        --user-assigned     $MI_ID `
        --registry-identity $MI_ID `
        --trigger-type      Schedule `
        --cron-expression   "0 6 * * *" `
        --replica-timeout   1800 `
        --secrets `
            "openai-key=keyvaultref:$KV_OPENAI_URI,identityref:$MI_ID" `
            "supabase-url=keyvaultref:$KV_SB_URL_URI,identityref:$MI_ID" `
            "supabase-key=keyvaultref:$KV_SB_KEY_URI,identityref:$MI_ID" `
        --env-vars `
            "OPENAI_API_KEY=secretref:openai-key" `
            "SUPABASE_URL=secretref:supabase-url" `
            "SUPABASE_SERVICE_KEY=secretref:supabase-key" `
            "STORAGE_MODE=azure" `
            "AZURE_STORAGE_ACCOUNT_NAME=$SA_NAME" `
            "AZURE_STORAGE_CONTAINER=$BLOB_CTR"
    if ($LASTEXITCODE -ne 0) { Die "Failed to create $JOB_NAME." }
    Log "$JOB_NAME created."
}

# ── 5.3 Trigger manual run + wait for completion ──────────────────────────────
Log "Step 5.3 — Triggering manual run of $JOB_NAME..."
$execRaw = az containerapp job start --name $JOB_NAME --resource-group $RG
if ($LASTEXITCODE -ne 0) { Die "Failed to start job execution." }
$execName = ($execRaw | ConvertFrom-Json).name
Log "Execution started: $execName"

Log "Waiting for job to complete (timeout: 30 min)..."
$maxWait  = 180   # 180 × 10s = 30 min
$interval = 10
for ($i = 0; $i -lt $maxWait; $i++) {
    Start-Sleep -Seconds $interval
    $statusRaw = az containerapp job execution show `
        --name $JOB_NAME `
        --resource-group $RG `
        --job-execution-name $execName `
        --query "properties.status" -o tsv 2>$null
    $status = $statusRaw.Trim()
    if ($status -eq "Succeeded") {
        Log "Job execution completed: $status"
        break
    }
    if ($status -in @("Failed", "Stopped", "Degraded")) {
        Die "Job execution ended with status '$status'. Check logs in Azure Portal → Container Apps → $JOB_NAME → Execution history."
    }
    if ($i % 6 -eq 0) { Log "  Still running... (status: $status)" }
}
if ($status -ne "Succeeded") {
    Die "Job did not complete within 30 minutes (last status: $status). Check Azure Portal logs."
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================"
Write-Host " PHASE 5 COMPLETE"
Write-Host "============================================"
Write-Host " RAG files uploaded : $blobCount file(s) in $SA_NAME/$BLOB_CTR"
Write-Host " Job created        : $JOB_NAME (schedule: 0 6 * * * UTC)"
Write-Host " Manual run status  : Succeeded ($execName)"
Write-Host "============================================"
Write-Host " Next: Phase 6 — validate the staging deployment"
Write-Host " Frontend: https://truepath-frontend.ashybush-4cbf3768.eastus.azurecontainerapps.io"
