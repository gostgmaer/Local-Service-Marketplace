#!/usr/bin/env bash
# =============================================================================
# open-secrets-editor.sh
#
# STEP 1 of 2: Creates secrets.local.env (if not already there) then opens
#              it in your editor so you can fill in the required values.
#
# Usage:
#   chmod +x scripts/open-secrets-editor.sh scripts/push-secrets-to-github.sh
#   ./scripts/open-secrets-editor.sh
#   # → fill in the file, save, close editor
#   ./scripts/push-secrets-to-github.sh
#
# secrets.local.env is in .gitignore — it will never be committed.
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$ROOT_DIR/secrets.local.env"

# ── Only create template if file doesn't already exist ──────────────────────
if [ ! -f "$TARGET" ]; then
  cat > "$TARGET" << 'TEMPLATE'
# =============================================================================
# secrets.local.env — fill in all REQUIRED values, leave AUTO lines blank
#
# STEP 1: Fill in everything below and save the file.
# STEP 2: Run  ./scripts/push-secrets-to-github.sh
#
# Lines starting with # are comments — ignored by the push script.
# This file is in .gitignore and will never be committed.
# =============================================================================

# ── AUTO-GENERATED (leave blank — push script generates these for you) ────────
LSP_JWT_SECRET=
LSP_JWT_REFRESH_SECRET=
LSP_GATEWAY_INTERNAL_SECRET=
LSP_ENCRYPTION_KEY=
LSP_SESSION_SECRET=
LSP_AUTH_SECRET=
LSP_REDIS_PASSWORD=

# ── REQUIRED: Database password ───────────────────────────────────────────────
LSP_POSTGRES_PASSWORD=

# ── REQUIRED: Super admin account ────────────────────────────────────────────
LSP_SUPER_ADMIN_EMAIL=
LSP_SUPER_ADMIN_PASSWORD=
LSP_SUPER_ADMIN_NAME=Super Admin

# ── OPTIONAL: Second admin (leave blank to skip) ──────────────────────────────
LSP_ADMIN_EMAIL=
LSP_ADMIN_PASSWORD=
LSP_ADMIN_NAME=Admin

# ── REQUIRED: Domains ─────────────────────────────────────────────────────────
LSP_API_DOMAIN=lsp-api.easydev.in
LSP_FRONTEND_DOMAIN=lsp.easydev.in

# CORS_ORIGINS: comma-separated list of allowed frontend origins.
# Leave blank to auto-set to https://<LSP_FRONTEND_DOMAIN> only.
# Add more if you have www. redirect, multiple frontends, or local dev:
#   LSP_CORS_ORIGINS=https://lsp.easydev.in,https://www.lsp.easydev.in
LSP_CORS_ORIGINS=

# ── REQUIRED: Database config (non-sensitive) ─────────────────────────────────
LSP_POSTGRES_USER=postgres
LSP_POSTGRES_DB=marketplace

# ── REQUIRED: External services ───────────────────────────────────────────────
LSP_FILE_UPLOAD_SERVICE_URL=https://your-upload-service.onrender.com
LSP_NOTIFICATION_SERVICE_URL=https://your-notification-service.vercel.app
LSP_NOTIFICATION_FROM_EMAIL=noreply@easydev.in
LSP_NOTIFICATION_API_KEY=

# ── OPTIONAL: Payment gateway (mock | razorpay | stripe) ─────────────────────
LSP_PAYMENT_GATEWAY=mock
LSP_RAZORPAY_KEY_ID=
LSP_RAZORPAY_KEY_SECRET=
LSP_RAZORPAY_WEBHOOK_SECRET=
LSP_STRIPE_SECRET_KEY=
LSP_STRIPE_WEBHOOK_SECRET=

# ── OPTIONAL: OAuth ────────────────────────────────────────────────────────────
LSP_GOOGLE_CLIENT_ID=
LSP_GOOGLE_CLIENT_SECRET=
LSP_FACEBOOK_APP_ID=
LSP_FACEBOOK_APP_SECRET=
LSP_GOOGLE_MAPS_API_KEY=
TEMPLATE

  chmod 600 "$TARGET"
  echo "Created: secrets.local.env"
else
  echo "Found existing: secrets.local.env"
fi

# ── Open in editor ────────────────────────────────────────────────────────────
EDITOR_CMD="${EDITOR:-}"

if [ -z "$EDITOR_CMD" ]; then
  for candidate in nano vim vi code; do
    if command -v "$candidate" >/dev/null 2>&1; then
      EDITOR_CMD="$candidate"
      break
    fi
  done
fi

if [ -z "$EDITOR_CMD" ]; then
  echo ""
  echo "No editor found. Open this file manually:"
  echo "  $TARGET"
  echo ""
  echo "Then run:  ./scripts/push-secrets-to-github.sh"
  exit 0
fi

echo "Opening in $EDITOR_CMD ..."
"$EDITOR_CMD" "$TARGET"

echo ""
echo "Saved. Now run:"
echo "  ./scripts/push-secrets-to-github.sh"
