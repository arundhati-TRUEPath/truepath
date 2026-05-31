# start.ps1 — stop everything, clear ports, then start all TruePath dev services
# Services: Python RAG (8000) → Backend (4000) → Frontend (3000)

$root = $PSScriptRoot

function Stop-Port {
    param([int]$port)
    $pids = (netstat -ano | Select-String ":$port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique)
    foreach ($p in $pids) {
        if ($p -match '^\d+$' -and $p -ne '0') {
            try { Stop-Process -Id $p -Force -ErrorAction Stop; Write-Host "  killed PID $p (port $port)" } catch {}
        }
    }
}

function Wait-Port {
    param([int]$port, [int]$timeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        if ($conn.TcpTestSucceeded) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# Log filenames: <service>-yyyy-MM-dd-HH-mm-ss.log per restart; append within session.
# Day rollover produces a new file automatically because the date is in the name.
$ts = Get-Date -Format 'yyyy-MM-dd-HH-mm-ss'
New-Item -ItemType Directory -Path "$root\logs" -Force | Out-Null

# --- Stop all services ---
Write-Host "`nStopping existing services..."
Stop-Port 3000
Stop-Port 4000
Stop-Port 8000
Start-Sleep -Seconds 1

# --- Start Python RAG service (port 8000) ---
Write-Host "`nStarting Python RAG service..."
$ragLog = "$root\logs\rag-$ts.log"
Start-Process powershell -ArgumentList "-NoProfile -Command `"cd '$root\services'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 2>&1 | Tee-Object -FilePath '$ragLog' -Append`"" -WindowStyle Hidden
if (Wait-Port 8000 30) {
    Write-Host "  RAG service ready on :8000"
} else {
    Write-Host "  ERROR: RAG service did not come up within 30s. Check logs\rag-$ts.log"
    exit 1
}

# --- Start Backend (port 4000) ---
Write-Host "`nStarting backend..."
$backendLog = "$root\logs\backend-$ts.log"
Start-Process powershell -ArgumentList "-NoProfile -Command `"cd '$root\backend'; npm run dev 2>&1 | Tee-Object -FilePath '$backendLog' -Append`"" -WindowStyle Hidden
if (Wait-Port 4000 30) {
    Write-Host "  Backend ready on :4000"
} else {
    Write-Host "  ERROR: Backend did not come up within 30s. Check logs\backend-$ts.log"
    exit 1
}

# --- Start Frontend (port 3000) ---
Write-Host "`nStarting frontend..."
$frontendLog = "$root\logs\frontend-$ts.log"
Start-Process powershell -ArgumentList "-NoProfile -Command `"cd '$root\frontend'; npm run dev 2>&1 | Tee-Object -FilePath '$frontendLog' -Append`"" -WindowStyle Hidden
if (Wait-Port 3000 60) {
    Write-Host "  Frontend ready on :3000"
} else {
    Write-Host "  ERROR: Frontend did not come up within 60s. Check logs\frontend-$ts.log"
    exit 1
}

Write-Host "`nAll services running:"
Write-Host "  Frontend  -> http://localhost:3000"
Write-Host "  Backend   -> http://localhost:4000"
Write-Host "  RAG svc   -> http://localhost:8000"
Write-Host "`nLogs: $root\logs\ (suffix: $ts)"
