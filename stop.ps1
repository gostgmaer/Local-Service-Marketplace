# Local Service Marketplace - Stop Script
# Run this script to stop all services

Write-Host "
╔══════════════════════════════════════════════════════════╗
║   Local Service Marketplace - Stop Services             ║
╚══════════════════════════════════════════════════════════╝
" -ForegroundColor Yellow

Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow
Write-Host ""

docker-compose stop

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ All services stopped successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 To remove containers completely, run:" -ForegroundColor Cyan
    Write-Host "   docker-compose down" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 To start again, run:" -ForegroundColor Cyan
    Write-Host "   .\start.ps1" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "`n❌ Failed to stop services!" -ForegroundColor Red
    exit 1
}
