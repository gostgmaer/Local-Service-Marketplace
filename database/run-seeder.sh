#!/bin/bash
# Database Seeder Runner Script for Linux/Mac
# Usage: ./run-seeder.sh [options]

set -e

# Color codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
success() { echo -e "${GREEN}$1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
warning() { echo -e "${YELLOW}$1${NC}"; }
error() { echo -e "${RED}$1${NC}"; }

# Parse arguments
SKIP_VERIFY=false
FORCE=false
TYPESCRIPT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-verify) SKIP_VERIFY=true; shift ;;
        --force) FORCE=true; shift ;;
        --typescript) TYPESCRIPT=true; shift ;;
        --help)
            info "Database Seeder Runner"
            echo ""
            echo "Usage: ./run-seeder.sh [options]"
            echo ""
            echo "Options:"
            echo "  --force         Skip confirmation prompt"
            echo "  --skip-verify   Skip verification after seeding"
            echo "  --typescript    Run TypeScript version"
            echo "  --help          Show this help"
            echo ""
            exit 0
            ;;
        *) error "Unknown option: $1"; exit 1 ;;
    esac
done

info "╔════════════════════════════════════════════════════╗"
info "║    Database Seeder - JavaScript Version 2.0.0     ║"
info "╚════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the correct directory
if [ ! -f "seed.js" ]; then
    if [ -f "../database/seed.js" ]; then
        info "📁 Changing to database directory..."
        cd ../database
    elif [ -f "database/seed.js" ]; then
        info "📁 Changing to database directory..."
        cd database
    else
        error "❌ Error: seed.js not found"
        exit 1
    fi
fi

# Load environment variables
info "🔧 Loading environment variables..."
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
    success "   ✓ Environment variables loaded"
elif [ -f "../docker.env" ]; then
    export $(cat ../docker.env | grep -v '^#' | xargs)
    success "   ✓ Environment variables loaded from docker.env"
else
    warning "   ⚠ No .env file found"
fi

# Set defaults
export POSTGRES_HOST=${POSTGRES_HOST:-localhost}
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export POSTGRES_USER=${POSTGRES_USER:-postgres}
export POSTGRES_DB=${POSTGRES_DB:-marketplace}

# Display configuration
echo ""
info "📊 Configuration:"
echo "   Host:     $POSTGRES_HOST"
echo "   Port:     $POSTGRES_PORT"
echo "   User:     $POSTGRES_USER"
echo "   Database: $POSTGRES_DB"
echo ""

# Test database connection
info "🔍 Testing database connection..."
if command -v psql &> /dev/null; then
    if PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1;" &> /dev/null; then
        success "   ✓ Database connection successful"
    else
        error "   ❌ Cannot connect to database"
        echo ""
        warning "Troubleshooting tips:"
        echo "  1. Ensure PostgreSQL is running"
        echo "  2. Check .env file credentials"
        echo "  3. Run: docker-compose up -d postgres"
        echo ""
        exit 1
    fi
else
    warning "   ⚠ psql not found, skipping connection test"
fi

echo ""

# Confirmation
if [ "$FORCE" = false ]; then
    warning "⚠️  This will seed the database with sample data."
    echo ""
    read -p "Continue? (y/N): " response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        info "Cancelled."
        exit 0
    fi
    echo ""
fi

# Check dependencies
info "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    info "   Installing dependencies..."
    npm install
else
    success "   ✓ Dependencies installed"
fi

echo ""
info "═══════════════════════════════════════════════════"
info "                  STARTING SEEDER                  "
info "═══════════════════════════════════════════════════"
echo ""

# Run seeder
START_TIME=$(date +%s)

if [ "$TYPESCRIPT" = true ]; then
    info "Running TypeScript seeder..."
    npm run seed:ts
else
    info "Running JavaScript seeder..."
    npm run seed
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
info "═══════════════════════════════════════════════════"
success "✅ Seeding completed successfully!"
info "   Duration: ${DURATION} seconds"

# Verification
if [ "$SKIP_VERIFY" = false ]; then
    echo ""
    info "═══════════════════════════════════════════════════"
    info "              RUNNING VERIFICATION                "
    info "═══════════════════════════════════════════════════"
    echo ""
    
    npm run verify
    
    echo ""
    success "✅ Verification completed!"
fi

# Summary
echo ""
info "═══════════════════════════════════════════════════"
success "                  ALL DONE! 🎉                    "
info "═══════════════════════════════════════════════════"
echo ""
info "Next steps:"
echo "  • View admin: SELECT * FROM users WHERE role='admin';"
echo "  • Password: password123"
echo "  • Verify: npm run verify"
echo "  • Re-seed: ./run-seeder.sh --force"
echo ""
success "Happy coding! 🚀"
echo ""
