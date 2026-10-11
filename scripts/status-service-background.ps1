# Check 24/7 Background Service Health & Poller Status

Write-Host "Checking 24/7 Email Automation Health..." -ForegroundColor Cyan

try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 5
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " STATUS: $($res.status.ToUpper()) (Uptime: $($res.uptimeSeconds) seconds)" -ForegroundColor Green
    Write-Host " Database: $($res.checks.database)" -ForegroundColor Green
    Write-Host " Gmail Configured: $($res.gmailConfigured)" -ForegroundColor Green
    if ($res.poller) {
        Write-Host " 24/7 Poller Active: $($res.poller.active)" -ForegroundColor Green
        Write-Host " Poller Status: $($res.poller.status)" -ForegroundColor Green
        Write-Host " Poller Interval: $($res.poller.intervalSeconds)s" -ForegroundColor Green
        Write-Host " Total Cycles Executed: $($res.poller.totalRuns)" -ForegroundColor Green
        Write-Host " Total Mails Ingested: $($res.poller.totalIngested)" -ForegroundColor Green
        Write-Host " Total Mails Forwarded: $($res.poller.totalForwarded)" -ForegroundColor Green
        Write-Host " Last Run Completed: $($res.poller.lastTickCompletedAt)" -ForegroundColor Green
    }
    Write-Host "==========================================================" -ForegroundColor Green
} catch {
    Write-Host "Service is currently not responding on http://localhost:3001" -ForegroundColor Red
}
