# 24/7 Background Service Launcher for Windows (PowerShell)
# Starts backend and frontend silently in the background with zero terminal windows.

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

# Ensure logs and data directories exist
if (-not (Test-Path "$rootDir\logs")) { New-Item -ItemType Directory -Path "$rootDir\logs" | Out-Null }
if (-not (Test-Path "$rootDir\data")) { New-Item -ItemType Directory -Path "$rootDir\data" | Out-Null }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting Email Automation Platform in 24/7 Background Mode" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Backend (Express API on Port 3001)
$backendProcess = Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "Set-Location '$rootDir'; npm --prefix backend run dev *> '$rootDir\logs\backend.log'" -WindowStyle Hidden -PassThru

# 2. Start Frontend (Next.js PWA on Port 3002)
$frontendProcess = Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "Set-Location '$rootDir'; npm --prefix frontend run dev *> '$rootDir\logs\frontend.log'" -WindowStyle Hidden -PassThru

# Save PIDs
$pids = @{
    backend = $backendProcess.Id
    frontend = $frontendProcess.Id
    startedAt = (Get-Date).ToString("o")
} | ConvertTo-Json

Set-Content -Path "$rootDir\data\service-pids.json" -Value $pids

Write-Host "[OK] Backend running in background (PID: $($backendProcess.Id))" -ForegroundColor Green
Write-Host "[OK] Frontend running in background (PID: $($frontendProcess.Id))" -ForegroundColor Green
Write-Host "[OK] Logs written to $rootDir\logs\" -ForegroundColor Yellow
Write-Host "[OK] 24/7 autonomous background Gmail sync active." -ForegroundColor Green
Write-Host "You can safely close this terminal window - automation remains active." -ForegroundColor Cyan
