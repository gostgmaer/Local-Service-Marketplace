# Local Service Marketplace - Quick Start Script
# Run this script to start the entire platform

Write-Host "
╔══════════════════════════════════════════════════════════╗
║   Local Service Marketplace - Platform Startup          ║
║   🚀 Starting all services...                           ║
╚══════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

# Check if Docker is running
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

try {
    $composeVersion = docker-compose --version
    Write-Host "✅ Docker Compose found: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed!" -ForegroundColor Red
    exit 1
}

# Check if .env exists
Write-Host "`n🔧 Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Write-Host "⚠️  .env file not found, creating from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ Created .env file" -ForegroundColor Green
    Write-Host "⚠️  Please update JWT_SECRET in .env for production use!" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
}

Write-Host "`n🐳 Starting Docker containers..." -ForegroundColor Yellow
Write-Host "This may take 3-5 minutes on first run (building images)...`n" -ForegroundColor Gray

# Start services
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ All services started successfully!" -ForegroundColor Green
    
    Write-Host "`n📊 Services Status:" -ForegroundColor Cyan
    docker-compose ps
    
    Write-Host "`n🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "  🖥️  Frontend:        http://localhost:3001" -ForegroundColor White
    Write-Host "  🔌 API Gateway:     http://localhost:3000" -ForegroundColor White
    Write-Host "  💾 PostgreSQL:      localhost:5432" -ForegroundColor White
    Write-Host "  🔴 Redis:           localhost:6379" -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    Write-Host "`n📝 Useful Commands:" -ForegroundColor Cyan
    Write-Host "  View logs:          docker-compose logs -f" -ForegroundColor Gray
    Write-Host "  Stop services:      docker-compose stop" -ForegroundColor Gray
    Write-Host "  Restart:            docker-compose restart" -ForegroundColor Gray
    Write-Host "  Remove everything:  docker-compose down" -ForegroundColor Gray
    
    Write-Host "`n⏳ Services are starting up (health checks running)..." -ForegroundColor Yellow
    Write-Host "Wait 30-60 seconds for all services to be healthy." -ForegroundColor Gray
    
    Write-Host "`n🎉 Ready! Open http://localhost:3001 in your browser" -ForegroundColor Green
    
    # Ask if user wants to open browser
    $openBrowser = Read-Host "`nOpen browser now? (Y/N)"
    if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
        Start-Process "http://localhost:3001"
    }
    
    # Ask if user wants to view logs
    Write-Host ""
    $viewLogs = Read-Host "View live logs? (Y/N)"
    if ($viewLogs -eq "Y" -or $viewLogs -eq "y") {
        Write-Host "`n📜 Streaming logs (Press Ctrl+C to stop)..." -ForegroundColor Cyan
        docker-compose logs -f
    }
    
} else {
    Write-Host "`n❌ Failed to start services!" -ForegroundColor Red
    Write-Host "Check the error messages above." -ForegroundColor Red
    Write-Host "`nTry running: docker-compose logs" -ForegroundColor Yellow
    exit 1
}
