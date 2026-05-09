#!/usr/bin/env bash
# =============================================================================
# push-secrets-to-github.sh
#
# STEP 2 of 2: Reads secrets.local.env, auto-generates any blank crypto
#              secrets, then pushes everything to GitHub Secrets + Variables
#              using the gh CLI.
#
# Usage:
#   ./scripts/push-secrets-to-github.sh
#   ./scripts/push-secrets-to-github.sh --repo owner/repo-name
#   ./scripts/push-secrets-to-github.sh --keep-file   # don't delete secrets.local.env after push
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_FILE="$ROOT_DIR/secrets.local.env"
REPO=""
KEEP_FILE=false

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)   REPO="$2"; shift 2 ;;
    --keep-file) KEEP_FILE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
ok()   { printf '  \033[32m✓\033[0m  %s\n' "$*"; }
skip() { printf '  \033[90m–\033[0m  %s (skipped — empty)\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m  %s\n' "$*"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }
header() { printf '\n\033[36m━━━ %s ━━━\033[0m\n' "$*"; }

rand_secret() { openssl rand -base64 "${1:-48}" | tr -d '\n'; }

set_secret() {
  local name="$1" value="$2"
  [[ -z "$value" ]] && { skip "secret: $name"; return; }
  printf '%s' "$value" | gh secret set "$name" $repo_flag
  ok "secret: $name"
}

set_var() {
  local name="$1" value="$2"
  [[ -z "$value" ]] && { skip "variable: $name"; return; }
  gh variable set "$name" --body "$value" $repo_flag
  ok "variable: $name"
}

read_env() {
  local key="$1"
  grep -E "^${key}=" "$SECRETS_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true
}

# ── Preflight ─────────────────────────────────────────────────────────────────
command -v gh >/dev/null 2>&1 || fail "gh CLI not found. Install: https://cli.github.com/"
[[ -f "$SECRETS_FILE" ]] || fail "secrets.local.env not found. Run: pnpm secrets:edit"

# Load auth token: GHCR_TOKEN > GH_TOKEN > existing gh login
_GHCR_TOKEN="$(grep -E '^GHCR_TOKEN=' "$SECRETS_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)"
_GH_TOKEN="$(grep -E '^GH_TOKEN=' "$SECRETS_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)"
if [[ -n "$_GHCR_TOKEN" ]]; then
  export GH_TOKEN="$_GHCR_TOKEN"
elif [[ -n "$_GH_TOKEN" ]]; then
  export GH_TOKEN="$_GH_TOKEN"
else
  gh auth status >/dev/null 2>&1 || fail "No token found. Add GHCR_TOKEN= to secrets.local.env"
fi

# Auto-detect repo from git remote if not given
if [[ -z "$REPO" ]]; then
  remote="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)"
  if [[ "$remote" =~ github\.com[:/](.+?)(\.git)?$ ]]; then
    REPO="${BASH_REMATCH[1]}"
  fi
fi
[[ -n "$REPO" ]] || fail "Cannot detect repo. Pass --repo owner/repo-name"

repo_flag="--repo=$REPO"
echo ""
echo "Repo: $REPO"

# ── Load values from file ─────────────────────────────────────────────────────
LSP_JWT_SECRET=$(read_env LSP_JWT_SECRET)
LSP_JWT_REFRESH_SECRET=$(read_env LSP_JWT_REFRESH_SECRET)
LSP_GATEWAY_INTERNAL_SECRET=$(read_env LSP_GATEWAY_INTERNAL_SECRET)
LSP_ENCRYPTION_KEY=$(read_env LSP_ENCRYPTION_KEY)
LSP_SESSION_SECRET=$(read_env LSP_SESSION_SECRET)
LSP_AUTH_SECRET=$(read_env LSP_AUTH_SECRET)
LSP_REDIS_PASSWORD=$(read_env LSP_REDIS_PASSWORD)
LSP_POSTGRES_PASSWORD=$(read_env LSP_POSTGRES_PASSWORD)
LSP_SUPER_ADMIN_EMAIL=$(read_env LSP_SUPER_ADMIN_EMAIL)
LSP_SUPER_ADMIN_PASSWORD=$(read_env LSP_SUPER_ADMIN_PASSWORD)
LSP_SUPER_ADMIN_NAME=$(read_env LSP_SUPER_ADMIN_NAME)
LSP_ADMIN_EMAIL=$(read_env LSP_ADMIN_EMAIL)
LSP_ADMIN_PASSWORD=$(read_env LSP_ADMIN_PASSWORD)
LSP_ADMIN_NAME=$(read_env LSP_ADMIN_NAME)
LSP_API_DOMAIN=$(read_env LSP_API_DOMAIN)
LSP_FRONTEND_DOMAIN=$(read_env LSP_FRONTEND_DOMAIN)
LSP_POSTGRES_USER=$(read_env LSP_POSTGRES_USER)
LSP_POSTGRES_DB=$(read_env LSP_POSTGRES_DB)
LSP_FILE_UPLOAD_SERVICE_URL=$(read_env LSP_FILE_UPLOAD_SERVICE_URL)
LSP_NOTIFICATION_SERVICE_URL=$(read_env LSP_NOTIFICATION_SERVICE_URL)
LSP_NOTIFICATION_FROM_EMAIL=$(read_env LSP_NOTIFICATION_FROM_EMAIL)
LSP_NOTIFICATION_API_KEY=$(read_env LSP_NOTIFICATION_API_KEY)
LSP_CORS_ORIGINS=$(read_env LSP_CORS_ORIGINS)
LSP_PAYMENT_GATEWAY=$(read_env LSP_PAYMENT_GATEWAY)
LSP_RAZORPAY_KEY_ID=$(read_env LSP_RAZORPAY_KEY_ID)
LSP_RAZORPAY_KEY_SECRET=$(read_env LSP_RAZORPAY_KEY_SECRET)
LSP_RAZORPAY_WEBHOOK_SECRET=$(read_env LSP_RAZORPAY_WEBHOOK_SECRET)
LSP_STRIPE_SECRET_KEY=$(read_env LSP_STRIPE_SECRET_KEY)
LSP_STRIPE_WEBHOOK_SECRET=$(read_env LSP_STRIPE_WEBHOOK_SECRET)
LSP_GOOGLE_CLIENT_ID=$(read_env LSP_GOOGLE_CLIENT_ID)
LSP_GOOGLE_CLIENT_SECRET=$(read_env LSP_GOOGLE_CLIENT_SECRET)
LSP_FACEBOOK_APP_ID=$(read_env LSP_FACEBOOK_APP_ID)
LSP_FACEBOOK_APP_SECRET=$(read_env LSP_FACEBOOK_APP_SECRET)
LSP_GOOGLE_MAPS_API_KEY=$(read_env LSP_GOOGLE_MAPS_API_KEY)

# ── Validate required fields ──────────────────────────────────────────────────
header "Validating required values"
errors=0
check_required() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    warn "REQUIRED but empty: $name"
    errors=$((errors + 1))
  else
    ok "$name"
  fi
}
check_required LSP_POSTGRES_PASSWORD     "$LSP_POSTGRES_PASSWORD"
check_required LSP_SUPER_ADMIN_EMAIL     "$LSP_SUPER_ADMIN_EMAIL"
check_required LSP_SUPER_ADMIN_PASSWORD  "$LSP_SUPER_ADMIN_PASSWORD"
check_required LSP_API_DOMAIN            "$LSP_API_DOMAIN"
check_required LSP_FRONTEND_DOMAIN       "$LSP_FRONTEND_DOMAIN"
check_required LSP_FILE_UPLOAD_SERVICE_URL "$LSP_FILE_UPLOAD_SERVICE_URL"

if [[ $errors -gt 0 ]]; then
  echo ""
  echo "Fix the $errors empty required value(s) in secrets.local.env then re-run."
  exit 1
fi

if [[ ${#LSP_SUPER_ADMIN_PASSWORD} -lt 12 ]]; then
  fail "LSP_SUPER_ADMIN_PASSWORD must be at least 12 characters"
fi

# ── Auto-generate blank crypto secrets ────────────────────────────────────────
header "Auto-generating blank crypto secrets"
[[ -z "$LSP_JWT_SECRET" ]]              && { LSP_JWT_SECRET=$(rand_secret 48);              warn "LSP_JWT_SECRET auto-generated"; }
[[ -z "$LSP_JWT_REFRESH_SECRET" ]]      && { LSP_JWT_REFRESH_SECRET=$(rand_secret 48);      warn "LSP_JWT_REFRESH_SECRET auto-generated"; }
[[ -z "$LSP_GATEWAY_INTERNAL_SECRET" ]] && { LSP_GATEWAY_INTERNAL_SECRET=$(rand_secret 48); warn "LSP_GATEWAY_INTERNAL_SECRET auto-generated"; }
[[ -z "$LSP_ENCRYPTION_KEY" ]]          && { LSP_ENCRYPTION_KEY=$(rand_secret 64);          warn "LSP_ENCRYPTION_KEY auto-generated"; }
[[ -z "$LSP_SESSION_SECRET" ]]          && { LSP_SESSION_SECRET=$(rand_secret 32);          warn "LSP_SESSION_SECRET auto-generated"; }
[[ -z "$LSP_AUTH_SECRET" ]]             && { LSP_AUTH_SECRET=$(rand_secret 32);             warn "LSP_AUTH_SECRET auto-generated"; }
[[ -z "$LSP_REDIS_PASSWORD" ]]          && { LSP_REDIS_PASSWORD=$(rand_secret 32);          warn "LSP_REDIS_PASSWORD auto-generated"; }

# ── Push secrets ──────────────────────────────────────────────────────────────
header "Pushing secrets → $REPO"
set_secret LSP_JWT_SECRET              "$LSP_JWT_SECRET"
set_secret LSP_JWT_REFRESH_SECRET      "$LSP_JWT_REFRESH_SECRET"
set_secret LSP_GATEWAY_INTERNAL_SECRET "$LSP_GATEWAY_INTERNAL_SECRET"
set_secret LSP_ENCRYPTION_KEY          "$LSP_ENCRYPTION_KEY"
set_secret LSP_SESSION_SECRET          "$LSP_SESSION_SECRET"
set_secret LSP_AUTH_SECRET             "$LSP_AUTH_SECRET"
set_secret LSP_REDIS_PASSWORD          "$LSP_REDIS_PASSWORD"
set_secret LSP_POSTGRES_PASSWORD       "$LSP_POSTGRES_PASSWORD"
set_secret LSP_SUPER_ADMIN_EMAIL       "$LSP_SUPER_ADMIN_EMAIL"
set_secret LSP_SUPER_ADMIN_PASSWORD    "$LSP_SUPER_ADMIN_PASSWORD"
set_secret LSP_ADMIN_PASSWORD          "$LSP_ADMIN_PASSWORD"
set_secret LSP_NOTIFICATION_API_KEY    "$LSP_NOTIFICATION_API_KEY"
set_secret LSP_RAZORPAY_KEY_ID         "$LSP_RAZORPAY_KEY_ID"
set_secret LSP_RAZORPAY_KEY_SECRET     "$LSP_RAZORPAY_KEY_SECRET"
set_secret LSP_RAZORPAY_WEBHOOK_SECRET "$LSP_RAZORPAY_WEBHOOK_SECRET"
set_secret LSP_STRIPE_SECRET_KEY       "$LSP_STRIPE_SECRET_KEY"
set_secret LSP_STRIPE_WEBHOOK_SECRET   "$LSP_STRIPE_WEBHOOK_SECRET"
set_secret LSP_GOOGLE_CLIENT_SECRET    "$LSP_GOOGLE_CLIENT_SECRET"
set_secret LSP_FACEBOOK_APP_SECRET     "$LSP_FACEBOOK_APP_SECRET"
set_secret LSP_GOOGLE_MAPS_API_KEY     "$LSP_GOOGLE_MAPS_API_KEY"

# ── Push variables ────────────────────────────────────────────────────────────
header "Pushing variables → $REPO"
set_var LSP_API_DOMAIN                 "$LSP_API_DOMAIN"
set_var LSP_FRONTEND_DOMAIN            "$LSP_FRONTEND_DOMAIN"
set_var LSP_POSTGRES_USER              "${LSP_POSTGRES_USER:-postgres}"
set_var LSP_POSTGRES_DB                "${LSP_POSTGRES_DB:-marketplace}"
set_var LSP_SUPER_ADMIN_NAME           "${LSP_SUPER_ADMIN_NAME:-Super Admin}"
set_var LSP_ADMIN_EMAIL                "$LSP_ADMIN_EMAIL"
set_var LSP_ADMIN_NAME                 "${LSP_ADMIN_NAME:-Admin}"
set_var LSP_FILE_UPLOAD_SERVICE_URL    "$LSP_FILE_UPLOAD_SERVICE_URL"
set_var LSP_NOTIFICATION_SERVICE_URL   "$LSP_NOTIFICATION_SERVICE_URL"
set_var LSP_NOTIFICATION_FROM_EMAIL    "$LSP_NOTIFICATION_FROM_EMAIL"
set_var LSP_NOTIFICATION_FROM_NAME     "Local Service Marketplace"
set_var LSP_DEFAULT_TENANT_ID          "local-service-marketplace"
set_var LSP_CORS_ORIGINS               "$LSP_CORS_ORIGINS"
set_var LSP_PAYMENT_GATEWAY            "${LSP_PAYMENT_GATEWAY:-mock}"
set_var LSP_GOOGLE_CLIENT_ID           "$LSP_GOOGLE_CLIENT_ID"
set_var LSP_FACEBOOK_APP_ID            "$LSP_FACEBOOK_APP_ID"

# ── Cleanup ────────────────────────────────────────────────────────────────────
if [[ "$KEEP_FILE" == false ]]; then
  rm -f "$SECRETS_FILE"
  echo ""
  echo "secrets.local.env deleted (secrets are now only in GitHub)."
else
  echo ""
  warn "secrets.local.env kept on disk (--keep-file). Delete it when done:"
  warn "  rm secrets.local.env"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
printf '\n\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n'
printf '\033[32m  All done! Push to master to trigger deploy.\033[0m\n'
printf '\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n\n'
printf '  Repo     : %s\n' "$REPO"
printf '  API      : https://%s\n' "$LSP_API_DOMAIN"
printf '  Frontend : https://%s\n' "$LSP_FRONTEND_DOMAIN"
printf '  Admin    : %s\n\n' "$LSP_SUPER_ADMIN_EMAIL"
