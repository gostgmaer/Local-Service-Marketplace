#!/usr/bin/env pwsh
# =============================================================================
# OWASP ZAP Security Scan Runner
# =============================================================================
# Prerequisites:
#   - Docker installed and running
#   - Staging environment accessible
#
# Usage:
#   .\scripts\security-scan.ps1                          # Baseline scan
#   .\scripts\security-scan.ps1 -ScanType full           # Full scan
#   .\scripts\security-scan.ps1 -TargetUrl http://host   # Custom target
# =============================================================================

param(
    [ValidateSet('baseline', 'full')]
    [string]$ScanType = 'baseline',
    
    [string]$TargetUrl = 'http://localhost:3700',
    
    [string]$ReportDir = 'test-reports'
)

$ErrorActionPreference = 'Stop'

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " OWASP ZAP Security Scan ($ScanType)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Ensure report directory exists
if (-not (Test-Path $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportJson = "zap-report-$timestamp.json"
$reportHtml = "zap-report-$timestamp.html"

# Pick scan type
$scanScript = if ($ScanType -eq 'full') { 'zap-full-scan.py' } else { 'zap-baseline.py' }

Write-Host "Target:      $TargetUrl" -ForegroundColor Yellow
Write-Host "Scan type:   $ScanType" -ForegroundColor Yellow
Write-Host "Report:      $ReportDir/$reportHtml" -ForegroundColor Yellow
Write-Host ""

# Check if target is reachable
try {
    $response = Invoke-WebRequest -Uri "$TargetUrl/health" -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "Target is reachable (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Target may not be reachable at $TargetUrl" -ForegroundColor Yellow
    Write-Host "Proceeding anyway..." -ForegroundColor Yellow
}

# Run ZAP scan via Docker
Write-Host "`nStarting ZAP scan..." -ForegroundColor Cyan

$configPath = (Resolve-Path "config/security/zap-config.conf").Path
$reportPath = (Resolve-Path $ReportDir).Path

docker run --rm `
    --network host `
    -v "${configPath}:/zap/wrk/zap-config.conf:ro" `
    -v "${reportPath}:/zap/wrk/reports:rw" `
    -t ghcr.io/zaproxy/zaproxy:stable `
    $scanScript `
    -t $TargetUrl `
    -c zap-config.conf `
    -J "reports/$reportJson" `
    -r "reports/$reportHtml" `
    -I

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "SCAN PASSED - No failures detected" -ForegroundColor Green
} elseif ($exitCode -eq 1) {
    Write-Host "SCAN COMPLETED WITH WARNINGS" -ForegroundColor Yellow
} else {
    Write-Host "SCAN FOUND FAILURES (exit code: $exitCode)" -ForegroundColor Red
}

Write-Host "`nReports saved to:" -ForegroundColor Cyan
Write-Host "  HTML: $ReportDir/$reportHtml"
Write-Host "  JSON: $ReportDir/$reportJson"
Write-Host ""

exit $exitCode
