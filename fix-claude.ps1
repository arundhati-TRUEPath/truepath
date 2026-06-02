param(
    [string[]] $StartPaths = @("$env:USERPROFILE\code", "$env:USERPROFILE\AppData\Roaming\npm\node_modules", "$env:ProgramFiles\nodejs"),
    [switch] $Force,
    [switch] $Recurse
)

Write-Output "Searching for 'claude.exe.old*' under these paths:`n$($StartPaths -join "`n")"

$found = @()
foreach ($p in $StartPaths) {
    if (-not (Test-Path $p)) { continue }
    try {
        # Always search recursively to find nested node_modules
        $items = Get-ChildItem -Path $p -Filter 'claude.exe.old*' -File -Recurse -ErrorAction Stop
        $found += $items
    } catch {
        Write-Output ("Warning: could not enumerate {0}: {1}" -f $p, $_.Exception.Message)
    }
}

if (-not $found) {
    Write-Output "No 'claude.exe.old*' files found."
    exit 0
}

foreach ($f in $found) {
    $dir = $f.DirectoryName
    $new = Join-Path $dir 'claude.exe'
    if (Test-Path $new) {
        if ($Force.IsPresent) {
            try {
                Rename-Item -Path $f.FullName -NewName 'claude.exe' -Force -ErrorAction Stop
                Write-Output "Renamed $($f.FullName) -> $new (overwrote existing)"
            } catch {
                Write-Output "Failed to rename $($f.FullName): $($_.Exception.Message)"
            }
        } else {
            Write-Output "Skipping $($f.FullName): $new already exists (use -Force to overwrite)"
        }
    } else {
        try {
            Rename-Item -Path $f.FullName -NewName 'claude.exe' -ErrorAction Stop
            Write-Output "Renamed $($f.FullName) -> $new"
        } catch {
            Write-Output "Failed to rename $($f.FullName): $($_.Exception.Message)"
        }
    }
}

Write-Output "Done. If you saw permission errors, re-run in an elevated PowerShell session (Run as Administrator)."
