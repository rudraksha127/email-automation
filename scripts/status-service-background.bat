@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status-service-background.ps1"
pause
