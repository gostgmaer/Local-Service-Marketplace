#!/usr/bin/env pwsh
# =============================================================================
# setup-github-secrets.ps1
#
# Sets all GitHub Actions Secrets and Variables for the LSP deployment.
# Uses the GitHub CLI (gh). Run once before first deploy, or anytime you
# want to rotate/update a value.
#
# Prerequisites:
#   1. Install gh CLI: https://cli.github.com/
#   2. Authenticate:   gh auth login
#   3. Run this script from the repo root:
#        .\scripts\setup-github-secrets.ps1
#
# To target a specific repo (if not inside the repo folder):
#        .\scripts\setup-github-secrets.ps1 -Repo "owner/repo-name"
# =============================================================================

param(
    [string]$Repo = ""    # e.g. "kisho/Local-Service-Marketplace" — auto-detected if empty
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Helpers ─────────────────────────────────────────────────────────────────

function Write-Header([string]$text) {
    Write-Host "`n━━━ $text ━━━" -ForegroundColor Cyan
}

function Write-Ok([string]$text) {
    Write-Host "  ✓  $text" -ForegroundColor Green
}

function Write-Skip([string]$text) {
    Write-Host "  –  $text (skipped — empty)" -ForegroundColor DarkGray
}

function Write-Warn([string]$text) {
    Write-Host "  ⚠  $text" -ForegroundColor Yellow
}

function Prompt-Required([string]$label, [bool]$isSecret = $false) {
    while ($true) {
        if ($isSecret) {
            $val = Read-Host "  $label" -AsSecureString
            $val = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($val))
        } else {
            $val = (Read-Host "  $label").Trim()
        }
        if ($val) { return $val }
        Write-Host "    Value is required — try again." -ForegroundColor Red
    }
}

function Prompt-Optional([string]$label, [string]$default = "", [bool]$isSecret = $false) {
    $hint = if ($default) { " [$default]" } else { " (press Enter to skip)" }
    if ($isSecret) {
        $val = Read-Host "  $label$hint" -AsSecureString
        $val = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($val))
    } else {
        $val = (Read-Host "  $label$hint").Trim()
    }
    if (-not $val -and $default) { return $default }
    return $val
}

function New-RandomSecret([int]$bytes = 48) {
    $rng  = [Security.Cryptography.RandomNumberGenerator]::Create()
    $buf  = New-Object byte[] $bytes
    $rng.GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

function Set-GhSecret([string]$name, [string]$value, [string]$repoFlag) {
    if (-not $value) { Write-Skip $name; return }
    $value | gh secret set $name $repoFlag 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh secret set failed for $name" }
    Write-Ok "secret: $name"
}

function Set-GhVariable([string]$name, [string]$value, [string]$repoFlag) {
    if (-not $value) { Write-Skip $name; return }
    gh variable set $name --body $value $repoFlag 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh variable set failed for $name" }
    Write-Ok "variable: $name"
}

# ─── Preflight ────────────────────────────────────────────────────────────────

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host @"
ERROR: GitHub CLI (gh) not found.

Install it from https://cli.github.com/ then run:
  gh auth login

"@ -ForegroundColor Red
    exit 1
}

$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Not logged in to gh. Run: gh auth login" -ForegroundColor Red
    exit 1
}

# Auto-detect repo from git remote if not provided
if (-not $Repo) {
    $remote = git remote get-url origin 2>$null
    if ($remote -match "github\.com[:/](.+?)(?:\.git)?$") {
        $Repo = $matches[1]
    }
}
if (-not $Repo) {
    $Repo = Prompt-Required "GitHub repo (owner/repo-name)"
}

$repoFlag = "--repo=$Repo"
Write-Host "`nConfiguring secrets and variables for: $Repo" -ForegroundColor White

# ─── 1. Auto-generate cryptographic secrets ───────────────────────────────────

Write-Header "Auto-generating cryptographic secrets"

Write-Host "  Generating 6 random secrets (48-64 byte base64)..." -ForegroundColor DarkGray

$JWT_SECRET              = New-RandomSecret 48
$JWT_REFRESH_SECRET      = New-RandomSecret 48
$GATEWAY_INTERNAL_SECRET = New-RandomSecret 48
$ENCRYPTION_KEY          = New-RandomSecret 64
$SESSION_SECRET          = New-RandomSecret 32
$AUTH_SECRET             = New-RandomSecret 32

Write-Host "  Done — 6 secrets generated locally (never written to disk)." -ForegroundColor Green

# ─── 2. Collect required values from user ─────────────────────────────────────

Write-Header "Domain configuration (GitHub Variables)"
$LSP_API_DOMAIN      = Prompt-Optional "API domain"      "lsp-api.easydev.in"
$LSP_FRONTEND_DOMAIN = Prompt-Optional "Frontend domain" "lsp.easydev.in"

Write-Header "PostgreSQL"
$LSP_POSTGRES_USER = Prompt-Optional "DB user"     "postgres"
$LSP_POSTGRES_DB   = Prompt-Optional "DB name"     "marketplace"
$LSP_POSTGRES_PASSWORD = Prompt-Required "DB password (min 16 chars)" -isSecret $true
if ($LSP_POSTGRES_PASSWORD.Length -lt 16) {
    Write-Warn "Password is shorter than 16 characters — consider using a stronger one."
}

Write-Header "Redis"
Write-Host "  Generating random Redis password..." -ForegroundColor DarkGray
$LSP_REDIS_PASSWORD = New-RandomSecret 32

Write-Header "Super admin account"
$LSP_SUPER_ADMIN_EMAIL    = Prompt-Required "Super admin email"
$LSP_SUPER_ADMIN_PASSWORD = Prompt-Required "Super admin password (min 12 chars)" -isSecret $true
$LSP_SUPER_ADMIN_NAME     = Prompt-Optional "Super admin display name" "Super Admin"

Write-Header "Second admin (optional)"
$LSP_ADMIN_EMAIL    = Prompt-Optional "Second admin email    (Enter to skip)"
$LSP_ADMIN_PASSWORD = ""
$LSP_ADMIN_NAME     = ""
if ($LSP_ADMIN_EMAIL) {
    $LSP_ADMIN_PASSWORD = Prompt-Required "Second admin password (min 12 chars)" -isSecret $true
    $LSP_ADMIN_NAME     = Prompt-Optional "Second admin display name" "Admin"
}

Write-Header "External services"
$LSP_FILE_UPLOAD_SERVICE_URL   = Prompt-Optional "File upload service URL" "https://your-upload-service.onrender.com"
$LSP_NOTIFICATION_SERVICE_URL  = Prompt-Optional "Notification service URL" ""
$LSP_NOTIFICATION_FROM_EMAIL   = Prompt-Optional "From email for notifications" "noreply@$LSP_FRONTEND_DOMAIN"
$LSP_NOTIFICATION_API_KEY      = Prompt-Optional "Notification API key" "" -isSecret $true

Write-Header "Payment gateway"
$LSP_PAYMENT_GATEWAY = Prompt-Optional "Gateway (mock | razorpay | stripe)" "mock"
$LSP_RAZORPAY_KEY_ID          = ""
$LSP_RAZORPAY_KEY_SECRET      = ""
$LSP_RAZORPAY_WEBHOOK_SECRET  = ""
$LSP_STRIPE_SECRET_KEY        = ""
$LSP_STRIPE_WEBHOOK_SECRET    = ""
if ($LSP_PAYMENT_GATEWAY -eq "razorpay") {
    $LSP_RAZORPAY_KEY_ID         = Prompt-Required "Razorpay Key ID"
    $LSP_RAZORPAY_KEY_SECRET     = Prompt-Required "Razorpay Key Secret" -isSecret $true
    $LSP_RAZORPAY_WEBHOOK_SECRET = Prompt-Required "Razorpay Webhook Secret" -isSecret $true
} elseif ($LSP_PAYMENT_GATEWAY -eq "stripe") {
    $LSP_STRIPE_SECRET_KEY     = Prompt-Required "Stripe Secret Key" -isSecret $true
    $LSP_STRIPE_WEBHOOK_SECRET = Prompt-Required "Stripe Webhook Secret" -isSecret $true
}

Write-Header "OAuth (optional — press Enter to skip each)"
$LSP_GOOGLE_CLIENT_ID     = Prompt-Optional "Google Client ID"
$LSP_GOOGLE_CLIENT_SECRET = Prompt-Optional "Google Client Secret" "" -isSecret $true
$LSP_FACEBOOK_APP_ID      = Prompt-Optional "Facebook App ID"
$LSP_FACEBOOK_APP_SECRET  = Prompt-Optional "Facebook App Secret" "" -isSecret $true
$LSP_GOOGLE_MAPS_API_KEY  = Prompt-Optional "Google Maps API Key" "" -isSecret $true

# ─── 3. Push everything to GitHub ─────────────────────────────────────────────

Write-Header "Pushing secrets to GitHub → $Repo"

# Cryptographic secrets (auto-generated)
Set-GhSecret "LSP_JWT_SECRET"              $JWT_SECRET              $repoFlag
Set-GhSecret "LSP_JWT_REFRESH_SECRET"      $JWT_REFRESH_SECRET      $repoFlag
Set-GhSecret "LSP_GATEWAY_INTERNAL_SECRET" $GATEWAY_INTERNAL_SECRET $repoFlag
Set-GhSecret "LSP_ENCRYPTION_KEY"          $ENCRYPTION_KEY          $repoFlag
Set-GhSecret "LSP_SESSION_SECRET"          $SESSION_SECRET          $repoFlag
Set-GhSecret "LSP_AUTH_SECRET"             $AUTH_SECRET             $repoFlag

# Database
Set-GhSecret "LSP_POSTGRES_PASSWORD" $LSP_POSTGRES_PASSWORD $repoFlag
Set-GhSecret "LSP_REDIS_PASSWORD"    $LSP_REDIS_PASSWORD    $repoFlag

# Admin
Set-GhSecret "LSP_SUPER_ADMIN_EMAIL"    $LSP_SUPER_ADMIN_EMAIL    $repoFlag
Set-GhSecret "LSP_SUPER_ADMIN_PASSWORD" $LSP_SUPER_ADMIN_PASSWORD $repoFlag
Set-GhSecret "LSP_ADMIN_PASSWORD"       $LSP_ADMIN_PASSWORD       $repoFlag

# External services
Set-GhSecret "LSP_NOTIFICATION_API_KEY" $LSP_NOTIFICATION_API_KEY $repoFlag

# Payment
Set-GhSecret "LSP_RAZORPAY_KEY_ID"         $LSP_RAZORPAY_KEY_ID         $repoFlag
Set-GhSecret "LSP_RAZORPAY_KEY_SECRET"      $LSP_RAZORPAY_KEY_SECRET      $repoFlag
Set-GhSecret "LSP_RAZORPAY_WEBHOOK_SECRET"  $LSP_RAZORPAY_WEBHOOK_SECRET  $repoFlag
Set-GhSecret "LSP_STRIPE_SECRET_KEY"        $LSP_STRIPE_SECRET_KEY        $repoFlag
Set-GhSecret "LSP_STRIPE_WEBHOOK_SECRET"    $LSP_STRIPE_WEBHOOK_SECRET    $repoFlag

# OAuth
Set-GhSecret "LSP_GOOGLE_CLIENT_SECRET" $LSP_GOOGLE_CLIENT_SECRET $repoFlag
Set-GhSecret "LSP_FACEBOOK_APP_SECRET"  $LSP_FACEBOOK_APP_SECRET  $repoFlag
Set-GhSecret "LSP_GOOGLE_MAPS_API_KEY"  $LSP_GOOGLE_MAPS_API_KEY  $repoFlag

Write-Header "Pushing variables to GitHub → $Repo"

Set-GhVariable "LSP_API_DOMAIN"              $LSP_API_DOMAIN              $repoFlag
Set-GhVariable "LSP_FRONTEND_DOMAIN"         $LSP_FRONTEND_DOMAIN         $repoFlag
Set-GhVariable "LSP_POSTGRES_USER"           $LSP_POSTGRES_USER           $repoFlag
Set-GhVariable "LSP_POSTGRES_DB"             $LSP_POSTGRES_DB             $repoFlag
Set-GhVariable "LSP_SUPER_ADMIN_NAME"        $LSP_SUPER_ADMIN_NAME        $repoFlag
Set-GhVariable "LSP_ADMIN_EMAIL"             $LSP_ADMIN_EMAIL             $repoFlag
Set-GhVariable "LSP_ADMIN_NAME"              $LSP_ADMIN_NAME              $repoFlag
Set-GhVariable "LSP_FILE_UPLOAD_SERVICE_URL" $LSP_FILE_UPLOAD_SERVICE_URL $repoFlag
Set-GhVariable "LSP_NOTIFICATION_SERVICE_URL"  $LSP_NOTIFICATION_SERVICE_URL  $repoFlag
Set-GhVariable "LSP_NOTIFICATION_FROM_EMAIL"   $LSP_NOTIFICATION_FROM_EMAIL   $repoFlag
Set-GhVariable "LSP_NOTIFICATION_FROM_NAME"    "Local Service Marketplace"    $repoFlag
Set-GhVariable "LSP_DEFAULT_TENANT_ID"         "local-service-marketplace"    $repoFlag
Set-GhVariable "LSP_PAYMENT_GATEWAY"           $LSP_PAYMENT_GATEWAY           $repoFlag
Set-GhVariable "LSP_GOOGLE_CLIENT_ID"          $LSP_GOOGLE_CLIENT_ID          $repoFlag
Set-GhVariable "LSP_FACEBOOK_APP_ID"           $LSP_FACEBOOK_APP_ID           $repoFlag

# ─── 4. Summary ──────────────────────────────────────────────────────────────

Write-Host @"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  All done!  GitHub Secrets and Variables set.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Repo       : $Repo
  API domain : $LSP_API_DOMAIN
  Frontend   : $LSP_FRONTEND_DOMAIN
  Admin      : $LSP_SUPER_ADMIN_EMAIL

  Next step  : Push to master — the workflow will
               build docker.env from these secrets
               automatically on every deploy.

  To rotate a secret later, just re-run this script
  or update it individually:
    gh secret set LSP_JWT_SECRET --repo=$Repo
"@ -ForegroundColor Green
