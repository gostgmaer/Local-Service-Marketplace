#!/usr/bin/env bash
# =============================================================================
# generate-env.sh — Production docker.env generator
# =============================================================================
# Run this ONCE on your server before the first deployment.
# It prompts for required values, generates all secrets, and writes docker.env.
#
# Usage:
#   chmod +x scripts/generate-env.sh
#   ./scripts/generate-env.sh
#   # or to write to a custom path:
#   ./scripts/generate-env.sh /path/to/docker.env
# =============================================================================
set -Eeuo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${GREEN}[INFO]${NC}  %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$*" >&2; }
header(){ printf "\n${CYAN}══ %s ══${NC}\n" "$*"; }

ask() {
  # ask <VAR> <prompt> [default]
  local var="$1" prompt="$2" default="${3:-}"
  local input
  if [[ -n "$default" ]]; then
    printf "%s [%s]: " "$prompt" "$default"
  else
    printf "%s: " "$prompt"
  fi
  read -r input
  input="${input:-$default}"
  printf -v "$var" '%s' "$input"
}

ask_secret() {
  # ask_secret <VAR> <prompt>  — hidden input, confirms match
  local var="$1" prompt="$2"
  local a b
  while true; do
    printf "%s: " "$prompt"
    read -rs a; echo
    printf "Confirm %s: " "$prompt"
    read -rs b; echo
    if [[ "$a" == "$b" ]]; then
      printf -v "$var" '%s' "$a"
      break
    fi
    warn "Passwords do not match. Try again."
  done
}

gen() { openssl rand -base64 "$1" | tr -d '\n/+=' | head -c "$2"; }

OUT="${1:-$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")/docker.env}"

# ── Guard ─────────────────────────────────────────────────────────────────────
if [[ -f "$OUT" ]]; then
  warn "File already exists: $OUT"
  printf "Overwrite? [y/N]: "
  read -r confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted. Existing file kept."; exit 0; }
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Local Service Marketplace — Production Env Generator   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "This script will generate all secrets and write: $OUT"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
header "1 / 6  DOMAINS"
# ═════════════════════════════════════════════════════════════════════════════
ask API_DOMAIN  "API domain (e.g. lsp-api.easydev.in)"       "lsp-api.easydev.in"
ask FE_DOMAIN   "Frontend domain (e.g. lsp.easydev.in)"      "lsp.easydev.in"
ask ACME_EMAIL  "Let's Encrypt email"                         "admin@easydev.in"

# ═════════════════════════════════════════════════════════════════════════════
header "2 / 6  DATABASE"
# ═════════════════════════════════════════════════════════════════════════════
ask    DB_NAME "PostgreSQL database name" "marketplace"
ask    DB_USER "PostgreSQL user"          "postgres"
ask_secret DB_PASS "PostgreSQL password (min 16 chars)"
while [[ ${#DB_PASS} -lt 16 ]]; do
  warn "Password must be at least 16 characters."
  ask_secret DB_PASS "PostgreSQL password (min 16 chars)"
done

# ═════════════════════════════════════════════════════════════════════════════
header "3 / 6  REDIS"
# ═════════════════════════════════════════════════════════════════════════════
REDIS_PASS="$(gen 48 48)"
info "Redis password auto-generated."

# ═════════════════════════════════════════════════════════════════════════════
header "4 / 6  ADMIN USERS"
# ═════════════════════════════════════════════════════════════════════════════
ask SUPER_EMAIL "Super admin email"  "admin@${API_DOMAIN#*-api.}"
ask_secret SUPER_PASS "Super admin password (min 12 chars)"
while [[ ${#SUPER_PASS} -lt 12 ]]; do
  warn "Password must be at least 12 characters."
  ask_secret SUPER_PASS "Super admin password (min 12 chars)"
done
ask SUPER_NAME "Super admin display name" "Super Admin"

echo ""
printf "Add a second admin? [y/N]: "
read -r add_admin
ADMIN_EMAIL_VAL="" ADMIN_PASS_VAL="" ADMIN_NAME_VAL="Admin"
if [[ "$add_admin" =~ ^[Yy]$ ]]; then
  ask ADMIN_EMAIL_VAL "Second admin email" ""
  if [[ -n "$ADMIN_EMAIL_VAL" ]]; then
    ask_secret ADMIN_PASS_VAL "Second admin password (min 12 chars)"
    while [[ ${#ADMIN_PASS_VAL} -lt 12 ]]; do
      warn "Password must be at least 12 characters."
      ask_secret ADMIN_PASS_VAL "Second admin password (min 12 chars)"
    done
    ask ADMIN_NAME_VAL "Second admin display name" "Admin"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
header "5 / 6  EXTERNAL SERVICES"
# ═════════════════════════════════════════════════════════════════════════════
ask FILE_URL   "File upload service URL (https://...)" "https://file-upload-service-zjtv.onrender.com"
ask NOTIF_URL  "Notification service URL (https://...)" ""
ask NOTIF_KEY  "Notification API key"                   ""
ask NOTIF_FROM_EMAIL "Notification from email"          "lsp@${API_DOMAIN#*-api.}"
ask NOTIF_FROM_NAME  "Notification from name"           "Local Service Marketplace"

# ═════════════════════════════════════════════════════════════════════════════
header "6 / 6  OAUTH (press Enter to skip)"
# ═════════════════════════════════════════════════════════════════════════════
ask GOOGLE_ID     "Google Client ID"     ""
ask GOOGLE_SECRET "Google Client Secret" ""
ask FB_ID         "Facebook App ID"      ""
ask FB_SECRET     "Facebook App Secret"  ""

# ═════════════════════════════════════════════════════════════════════════════
# Generate all cryptographic secrets
# ═════════════════════════════════════════════════════════════════════════════
header "Generating secrets..."
JWT_SECRET="$(gen 64 64)"
JWT_REFRESH_SECRET="$(gen 64 64)"
GATEWAY_INTERNAL_SECRET="$(gen 48 48)"
ENCRYPTION_KEY="$(gen 64 64)"
SESSION_SECRET="$(gen 48 48)"
AUTH_SECRET="$(gen 48 48)"
info "All secrets generated."

# ═════════════════════════════════════════════════════════════════════════════
# Write docker.env
# ═════════════════════════════════════════════════════════════════════════════
header "Writing $OUT"

cat > "$OUT" <<EOF
# =============================================================================
# Local Service Marketplace — Production Environment
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Generator: scripts/generate-env.sh
# KEEP THIS FILE SECRET — never commit to version control
# =============================================================================

# -----------------------------------------------
# RUNTIME
# -----------------------------------------------
NODE_ENV=production
COMPOSE_PROFILES=workers
TOKEN_VALIDATION_STRATEGY=local

# -----------------------------------------------
# SECURITY — auto-generated
# -----------------------------------------------
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
GATEWAY_INTERNAL_SECRET=${GATEWAY_INTERNAL_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}
AUTH_SECRET=${AUTH_SECRET}

# -----------------------------------------------
# BOOTSTRAP ADMIN USERS
# -----------------------------------------------
SUPER_ADMIN_EMAIL=${SUPER_EMAIL}
SUPER_ADMIN_PASSWORD=${SUPER_PASS}
SUPER_ADMIN_NAME=${SUPER_NAME}
ADMIN_EMAIL=${ADMIN_EMAIL_VAL}
ADMIN_PASSWORD=${ADMIN_PASS_VAL}
ADMIN_NAME=${ADMIN_NAME_VAL}

# -----------------------------------------------
# POSTGRESQL
# -----------------------------------------------
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=${DB_NAME}

DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=${DB_USER}
DATABASE_PASSWORD=${DB_PASS}
DATABASE_NAME=${DB_NAME}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}
DATABASE_SSL=false

DB_POOL_MAX=20
DB_POOL_MIN=5

# -----------------------------------------------
# REDIS
# -----------------------------------------------
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}
REDIS_RATE_LIMIT_ENABLED=true

# -----------------------------------------------
# DOMAINS & CORS
# -----------------------------------------------
LSP_API_DOMAIN=${API_DOMAIN}
LSP_FRONTEND_DOMAIN=${FE_DOMAIN}
DOMAIN_NAME=${FE_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

FRONTEND_URL=https://${FE_DOMAIN}
CORS_ORIGIN=https://${FE_DOMAIN}
CORS_ORIGINS=https://${FE_DOMAIN}

NEXT_PUBLIC_API_URL=https://${API_DOMAIN}
INTERNAL_API_URL=http://api-gateway:3000
NEXTAUTH_URL=https://${FE_DOMAIN}

# -----------------------------------------------
# INTERNAL SERVICE URLS (Docker network)
# -----------------------------------------------
IDENTITY_SERVICE_URL=http://identity-service:3001
MARKETPLACE_SERVICE_URL=http://marketplace-service:3003
PAYMENT_SERVICE_URL=http://payment-service:3006
COMMS_SERVICE_URL=http://comms-service:3007
OVERSIGHT_SERVICE_URL=http://oversight-service:3010

# -----------------------------------------------
# API GATEWAY
# -----------------------------------------------
API_GATEWAY_PORT=3700
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
REQUEST_TIMEOUT_MS=72000

# -----------------------------------------------
# EXTERNAL SERVICES
# -----------------------------------------------
FILE_UPLOAD_SERVICE_URL=${FILE_URL}
FILE_DEFAULT_TENANT_ID=default

NOTIFICATION_SERVICE_URL=${NOTIF_URL}
NOTIFICATION_API_KEY=${NOTIF_KEY}
NOTIFICATION_FROM_EMAIL=${NOTIF_FROM_EMAIL}
NOTIFICATION_FROM_NAME=${NOTIF_FROM_NAME}
DEFAULT_TENANT_ID=local-service-marketplace

# -----------------------------------------------
# FEATURE FLAGS
# -----------------------------------------------
CACHE_ENABLED=true
WORKERS_ENABLED=true
WORKER_CONCURRENCY=10
EVENT_BUS_ENABLED=false
BACKGROUND_JOBS_ENABLED=false
RATE_LIMITING_ENABLED=true
FEATURE_FLAGS_ENABLED=true
ANALYTICS_ENABLED=false
INFRASTRUCTURE_ENABLED=false
MESSAGING_ENABLED=false
API_GATEWAY_ENABLED=true

EMAIL_ENABLED=true
SMS_ENABLED=false
IN_APP_NOTIFICATIONS_ENABLED=false
PUSH_NOTIFICATIONS_ENABLED=false
NOTIFICATION_PREFERENCES_ENABLED=false
DEVICE_TRACKING_ENABLED=false

# -----------------------------------------------
# PAYMENT
# -----------------------------------------------
PAYMENT_GATEWAY=mock
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# -----------------------------------------------
# OAUTH
# -----------------------------------------------
GOOGLE_CLIENT_ID=${GOOGLE_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_SECRET}
GOOGLE_CALLBACK_URL=https://${API_DOMAIN}/api/v1/user/auth/google/callback
FACEBOOK_APP_ID=${FB_ID}
FACEBOOK_APP_SECRET=${FB_SECRET}
FACEBOOK_CALLBACK_URL=https://${API_DOMAIN}/api/v1/user/auth/facebook/callback

# -----------------------------------------------
# KAFKA (Level 4 — disabled by default)
# -----------------------------------------------
KAFKA_BROKERS=kafka:29092
KAFKA_CLIENT_ID=marketplace-service
ZOOKEEPER_HOST=zookeeper
ZOOKEEPER_PORT=2181

# -----------------------------------------------
# APPLICATION
# -----------------------------------------------
APPLICATION_NAME=Local Service Marketplace
LOG_LEVEL=info
ENABLE_LOGGING=true
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
EOF

chmod 600 "$OUT"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    ✅  DONE                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "Written to: $OUT  (mode 600 — owner read/write only)"
echo ""
echo "  Admin login"
echo "    Email   : ${SUPER_EMAIL}"
echo "    Password: ${SUPER_PASS}"
echo ""
echo "  API       : https://${API_DOMAIN}"
echo "  Frontend  : https://${FE_DOMAIN}"
echo ""
warn "KEEP docker.env SECRET — it contains all secrets and passwords."
warn "The deploy script preserves it across re-deployments automatically."
echo ""
info "Next step: push your code and let GitHub Actions deploy, or run:"
info "  ./scripts/deploy-production-worker.sh --env-file docker.env --no-build"
echo ""
