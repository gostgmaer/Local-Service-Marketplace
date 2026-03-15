#!/usr/bin/env pwsh
# Database Seeder Runner Script
# Runs the JavaScript database seeder with verification

param(
    [switch]$SkipVerify,
    [switch]$Force,
    [switch]$TypeScript,
    [switch]$Help
)

# Color functions
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Help text
if ($Help) {
    Write-Info "Database Seeder Runner"
    Write-Host ""
    Write-Host "Usage: .\run-seeder.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Force          Skip confirmation prompt"
    Write-Host "  -SkipVerify     Skip verification after seeding"
    Write-Host "  -TypeScript     Run TypeScript version instead of JavaScript"
    Write-Host "  -Help           Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\run-seeder.ps1                    # Run with confirmation"
    Write-Host "  .\run-seeder.ps1 -Force             # Run without confirmation"
    Write-Host "  .\run-seeder.ps1 -SkipVerify        # Skip verification step"
    Write-Host "  .\run-seeder.ps1 -TypeScript        # Use TypeScript version"
    exit 0
}

Write-Info "=================================================="
Write-Info "    Database Seeder - JavaScript Version 2.0.0   "
Write-Info "=================================================="
Write-Host ""

# Check if we're in the correct directory
$currentDir = Get-Location
if (-not (Test-Path "seed.js")) {
    if (Test-Path "../database/seed.js") {
        Write-Info "Changing to database directory..."
        Set-Location "../database"
    }
    elseif (Test-Path "database/seed.js") {
        Write-Info "Changing to database directory..."
        Set-Location "database"
    }
    else {
        Write-Error "Error: seed.js not found. Please run this script from the database directory or project root."
        exit 1
    }
}

# Load environment variables
Write-Info "Loading environment variables..."
if (Test-Path "../.env") {
    Get-Content "../.env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
    Write-Success "   Environment variables loaded"
}
elseif (Test-Path "../docker.env") {
    Get-Content "../docker.env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
    Write-Success "   Environment variables loaded from docker.env"
}
else {
    Write-Warning "   No .env file found. Using default values."
}

# Set defaults
$env:POSTGRES_HOST = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$env:POSTGRES_PORT = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
$env:POSTGRES_USER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$env:POSTGRES_DB = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "marketplace" }

# Display configuration
Write-Host ""
Write-Info "Configuration:"
Write-Host "   Host:     $env:POSTGRES_HOST"
Write-Host "   Port:     $env:POSTGRES_PORT"
Write-Host "   User:     $env:POSTGRES_USER"
Write-Host "   Database: $env:POSTGRES_DB"
Write-Host ""

# Test database connection
Write-Info "Testing database connection..."
try {
    $env:PGPASSWORD = $env:POSTGRES_PASSWORD
    $result = & psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -c "SELECT 1;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "   Database connection successful"
    }
    else {
        Write-Error "   Cannot connect to database"
        Write-Host ""
        Write-Warning "Troubleshooting tips:"
        Write-Host "  1. Ensure PostgreSQL is running"
        Write-Host "  2. Check .env file has correct credentials"
        Write-Host "  3. Run: docker-compose up -d postgres"
        Write-Host ""
        exit 1
    }
}
catch {
    Write-Warning "   Could not test database connection (psql not found)"
    Write-Info "   Continuing anyway..."
}

Write-Host ""

# Confirmation prompt
if (-not $Force) {
    Write-Warning "WARNING: This will seed the database with sample data."
    Write-Host ""
    $response = Read-Host "Continue? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Info "Cancelled."
        exit 0
    }
    Write-Host ""
}

# Check for package.json and node_modules
Write-Info "Checking dependencies..."
if (-not (Test-Path "package.json")) {
    Write-Error "package.json not found in database directory"
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Info "   Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        exit 1
    }
}
else {
    Write-Success "   Dependencies already installed"
}

Write-Host ""
Write-Info "==================================================="
Write-Info "                  STARTING SEEDER                  "
Write-Info "==================================================="
Write-Host ""

# Run the seeder
$startTime = Get-Date

if ($TypeScript) {
    Write-Info "Running TypeScript seeder..."
    npm run seed:ts
    $exitCode = $LASTEXITCODE
} else {
    Write-Info "Running JavaScript seeder..."
    npm run seed
    $exitCode = $LASTEXITCODE
}

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Info "==================================================="

if ($exitCode -eq 0) {
    Write-Success "Seeding completed successfully!"
    Write-Info "   Duration: $([math]::Round($duration, 2)) seconds"
}
else {
    Write-Error "Seeding failed with exit code: $exitCode"
    exit $exitCode
}

# Verification step
if (-not $SkipVerify) {
    Write-Host ""
    Write-Info "==================================================="
    Write-Info "              RUNNING VERIFICATION                "
    Write-Info "==================================================="
    Write-Host ""
    
    npm run verify
    $verifyCode = $LASTEXITCODE
    
    if ($verifyCode -eq 0) {
        Write-Host ""
        Write-Success "Verification completed!"
    }
    else {
        Write-Host ""
        Write-Warning "Verification encountered issues (Exit code: $verifyCode)"
    }
}
else {
    Write-Info ""
    Write-Info "Skipping verification. Run 'npm run verify' to verify data."
}

# Summary
Write-Host ""
Write-Info "==================================================="
Write-Success "                  ALL DONE!                      "
Write-Info "==================================================="
Write-Host ""
Write-Info "Next steps:"
Write-Host "  - View admin user: SELECT * FROM users WHERE role='admin';"
Write-Host "  - Default password: password123"
Write-Host "  - Run verification: npm run verify"
Write-Host "  - Re-seed anytime: .\run-seeder.ps1 -Force"
Write-Host ""
Write-Success "Happy coding!"
Write-Host ""
