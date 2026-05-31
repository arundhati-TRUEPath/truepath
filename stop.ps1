# stop.ps1 — kill all TruePath dev services
# Ports: 3000 (frontend), 4000 (backend), 8000 (python rag)

$ports = @(3000, 4000, 8000)

foreach ($port in $ports) {
    $pids = (netstat -ano | Select-String ":$port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique)

    foreach ($pid in $pids) {
        if ($pid -match '^\d+$' -and $pid -ne '0') {
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "  killed PID $pid (port $port)"
            } catch {
                # already gone
            }
        }
    }
}

Write-Host "All services stopped."
