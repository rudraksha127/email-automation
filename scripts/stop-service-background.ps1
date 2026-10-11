# Stop 24/7 Background Service for Windows (PowerShell)

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "Stopping 24/7 background automation services..." -ForegroundColor Yellow

$pidFile = "$rootDir\data\service-pids.json"
if (Test-Path $pidFile) {
    try {
        $pids = Get-Content $pidFile | ConvertFrom-Json
        if ($pids.backend) {
            Stop-Process -Id $pids.backend -Force -ErrorAction SilentlyContinue
            Write-Host "✓ Stopped backend process ($($pids.backend))" -ForegroundColor Green
        }
        if ($pids.frontend) {
            Stop-Process -Id $pids.frontend -Force -ErrorAction SilentlyContinue
            Write-Host "✓ Stopped frontend process ($($pids.frontend))" -ForegroundColor Green
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Note: error reading pid file, continuing cleanup." -ForegroundColor Gray
    }
}

# Also ensure node processes on ports 3001 & 3002 are freed
$ports = @(3001, 3002)
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        if ($c.OwningProcess -gt 0) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "✓ Freed port $p (PID: $($c.OwningProcess))" -ForegroundColor Green
        }
    }
}

Write-Host "All background services stopped." -ForegroundColor Cyan
