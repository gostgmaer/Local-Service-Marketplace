#!/usr/bin/env pwsh
# push-secrets-to-github.ps1 — reads secrets.local.env, auto-generates blank
# crypto secrets, then pushes everything to GitHub Secrets + Variables via gh CLI.
#
# Usage (from repo root):
#   pnpm secrets:push
#   .\scripts\push-secrets-to-github.ps1
#   .\scripts\push-secrets-to-github.ps1 -Repo owner/repo-name
#   .\scripts\push-secrets-to-github.ps1 -KeepFile

param(
  [string]$Repo     = "",
  [switch]$KeepFile = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT         = Split-Path $PSScriptRoot -Parent
$SECRETS_FILE = Join-Path $ROOT "secrets.local.env"

# ── Helpers ───────────────────────────────────────────────────────────────────
function ok($t)   { Write-Host "  v  $t" -ForegroundColor Green }
function skip($t) { Write-Host "  -  $t (skipped - empty)" -ForegroundColor DarkGray }
function warn($t) { Write-Host "  !  $t" -ForegroundColor Yellow }
function fail($t) { Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }
function hdr($t)  { Write-Host "`n--- $t ---" -ForegroundColor Cyan }

function New-RandSecret([int]$bytes = 48) {
  $buf = [byte[]]::new($bytes)
  [Security.Cryptography.RandomNumberGenerator]::Fill($buf)
  return [Convert]::ToBase64String($buf)
}

function Read-EnvValue([string]$key) {
  $line = Get-Content $SECRETS_FILE -ErrorAction SilentlyContinue |
          Where-Object { $_ -match "^${key}=(.*)$" } |
          Select-Object -Last 1
  if ($line -match "^${key}=(.*)$") { return $Matches[1].Trim() }
  return ""
}

function Set-Secret([string]$name, [string]$value) {
  if (-not $value) { skip "secret: $name"; return }
  $value | gh secret set $name $repoFlag 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { fail "gh secret set failed for $name" }
  ok "secret: $name"
}

function Set-Variable([string]$name, [string]$value) {
  if (-not $value) { skip "variable: $name"; return }
  gh variable set $name --body $value $repoFlag 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { fail "gh variable set failed for $name" }
  ok "variable: $name"
}

# ── Preflight ─────────────────────────────────────────────────────────────────
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  fail "gh CLI not found. Install: winget install GitHub.cli"
}
if (-not (Test-Path $SECRETS_FILE)) {
  fail "secrets.local.env not found. Run: pnpm secrets:edit"
}

# Load auth token: GHCR_TOKEN > GH_TOKEN > existing gh login
$_ghToken = Read-EnvValue 'GHCR_TOKEN'
if (-not $_ghToken) { $_ghToken = Read-EnvValue 'GH_TOKEN' }
if ($_ghToken) {
  $env:GH_TOKEN = $_ghToken
} else {
  gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { fail "No token found. Add GHCR_TOKEN= to secrets.local.env" }
}

# Auto-detect repo
if (-not $Repo) {
  $remote = git -C $ROOT remote get-url origin 2>$null
  if ($remote -match "github\.com[:/](.+?)(\.git)?$") { $Repo = $Matches[1] }
}
if (-not $Repo) { fail "Cannot detect repo. Pass -Repo owner/repo-name" }

$repoFlag = "--repo=$Repo"
Write-Host "`nRepo: $Repo" -ForegroundColor White

# ── Load values ───────────────────────────────────────────────────────────────
$v = @{}
foreach ($key in @(
  "LSP_JWT_SECRET","LSP_JWT_REFRESH_SECRET","LSP_GATEWAY_INTERNAL_SECRET",
  "LSP_ENCRYPTION_KEY","LSP_SESSION_SECRET","LSP_AUTH_SECRET","LSP_REDIS_PASSWORD",
  "LSP_POSTGRES_PASSWORD","LSP_POSTGRES_USER","LSP_POSTGRES_DB",
  "LSP_SUPER_ADMIN_EMAIL","LSP_SUPER_ADMIN_PASSWORD","LSP_SUPER_ADMIN_NAME",
  "LSP_ADMIN_EMAIL","LSP_ADMIN_PASSWORD","LSP_ADMIN_NAME",
  "LSP_API_DOMAIN","LSP_FRONTEND_DOMAIN","LSP_CORS_ORIGINS",
  "LSP_FILE_UPLOAD_SERVICE_URL","LSP_NOTIFICATION_SERVICE_URL",
  "LSP_NOTIFICATION_FROM_EMAIL","LSP_NOTIFICATION_FROM_NAME","LSP_NOTIFICATION_API_KEY",
  "LSP_PAYMENT_GATEWAY","LSP_DEFAULT_TENANT_ID",
  "LSP_RAZORPAY_KEY_ID","LSP_RAZORPAY_KEY_SECRET","LSP_RAZORPAY_WEBHOOK_SECRET",
  "LSP_STRIPE_SECRET_KEY","LSP_STRIPE_WEBHOOK_SECRET",
  "LSP_GOOGLE_CLIENT_ID","LSP_GOOGLE_CLIENT_SECRET",
  "LSP_FACEBOOK_APP_ID","LSP_FACEBOOK_APP_SECRET","LSP_GOOGLE_MAPS_API_KEY"
)) {
  $v[$key] = Read-EnvValue $key
}

# ── Validate required fields ──────────────────────────────────────────────────
hdr "Validating required values"
$errors = 0
foreach ($req in @(
  "LSP_POSTGRES_PASSWORD","LSP_SUPER_ADMIN_EMAIL","LSP_SUPER_ADMIN_PASSWORD",
  "LSP_API_DOMAIN","LSP_FRONTEND_DOMAIN","LSP_FILE_UPLOAD_SERVICE_URL"
)) {
  if (-not $v[$req]) { warn "REQUIRED but empty: $req"; $errors++ }
  else               { ok $req }
}
if ($errors -gt 0) {
  Write-Host "`nFix the $errors empty required value(s) in secrets.local.env then re-run." -ForegroundColor Red
  exit 1
}
if ($v["LSP_SUPER_ADMIN_PASSWORD"].Length -lt 12) {
  fail "LSP_SUPER_ADMIN_PASSWORD must be at least 12 characters"
}

# ── Auto-generate blank crypto secrets ────────────────────────────────────────
hdr "Auto-generating blank crypto secrets"
$autoKeys = @{
  LSP_JWT_SECRET              = 48
  LSP_JWT_REFRESH_SECRET      = 48
  LSP_GATEWAY_INTERNAL_SECRET = 48
  LSP_ENCRYPTION_KEY          = 64
  LSP_SESSION_SECRET          = 32
  LSP_AUTH_SECRET             = 32
  LSP_REDIS_PASSWORD          = 32
}
foreach ($key in $autoKeys.Keys) {
  if (-not $v[$key]) {
    $v[$key] = New-RandSecret $autoKeys[$key]
    warn "$key auto-generated"
  }
}

# ── Push secrets ──────────────────────────────────────────────────────────────
hdr "Pushing secrets -> $Repo"
Set-Secret "LSP_JWT_SECRET"              $v["LSP_JWT_SECRET"]
Set-Secret "LSP_JWT_REFRESH_SECRET"      $v["LSP_JWT_REFRESH_SECRET"]
Set-Secret "LSP_GATEWAY_INTERNAL_SECRET" $v["LSP_GATEWAY_INTERNAL_SECRET"]
Set-Secret "LSP_ENCRYPTION_KEY"          $v["LSP_ENCRYPTION_KEY"]
Set-Secret "LSP_SESSION_SECRET"          $v["LSP_SESSION_SECRET"]
Set-Secret "LSP_AUTH_SECRET"             $v["LSP_AUTH_SECRET"]
Set-Secret "LSP_REDIS_PASSWORD"          $v["LSP_REDIS_PASSWORD"]
Set-Secret "LSP_POSTGRES_PASSWORD"       $v["LSP_POSTGRES_PASSWORD"]
Set-Secret "LSP_SUPER_ADMIN_EMAIL"       $v["LSP_SUPER_ADMIN_EMAIL"]
Set-Secret "LSP_SUPER_ADMIN_PASSWORD"    $v["LSP_SUPER_ADMIN_PASSWORD"]
Set-Secret "LSP_ADMIN_PASSWORD"          $v["LSP_ADMIN_PASSWORD"]
Set-Secret "LSP_NOTIFICATION_API_KEY"    $v["LSP_NOTIFICATION_API_KEY"]
Set-Secret "LSP_RAZORPAY_KEY_ID"         $v["LSP_RAZORPAY_KEY_ID"]
Set-Secret "LSP_RAZORPAY_KEY_SECRET"     $v["LSP_RAZORPAY_KEY_SECRET"]
Set-Secret "LSP_RAZORPAY_WEBHOOK_SECRET" $v["LSP_RAZORPAY_WEBHOOK_SECRET"]
Set-Secret "LSP_STRIPE_SECRET_KEY"       $v["LSP_STRIPE_SECRET_KEY"]
Set-Secret "LSP_STRIPE_WEBHOOK_SECRET"   $v["LSP_STRIPE_WEBHOOK_SECRET"]
Set-Secret "LSP_GOOGLE_CLIENT_SECRET"    $v["LSP_GOOGLE_CLIENT_SECRET"]
Set-Secret "LSP_FACEBOOK_APP_SECRET"     $v["LSP_FACEBOOK_APP_SECRET"]
Set-Secret "LSP_GOOGLE_MAPS_API_KEY"     $v["LSP_GOOGLE_MAPS_API_KEY"]

# ── Push variables ────────────────────────────────────────────────────────────
hdr "Pushing variables -> $Repo"
Set-Variable "LSP_API_DOMAIN"              $v["LSP_API_DOMAIN"]
Set-Variable "LSP_FRONTEND_DOMAIN"         $v["LSP_FRONTEND_DOMAIN"]
Set-Variable "LSP_POSTGRES_USER"           $(if ($v["LSP_POSTGRES_USER"]) { $v["LSP_POSTGRES_USER"] } else { "postgres" })
Set-Variable "LSP_POSTGRES_DB"             $(if ($v["LSP_POSTGRES_DB"]) { $v["LSP_POSTGRES_DB"] } else { "marketplace" })
Set-Variable "LSP_SUPER_ADMIN_NAME"        $(if ($v["LSP_SUPER_ADMIN_NAME"]) { $v["LSP_SUPER_ADMIN_NAME"] } else { "Super Admin" })
Set-Variable "LSP_ADMIN_EMAIL"             $v["LSP_ADMIN_EMAIL"]
Set-Variable "LSP_ADMIN_NAME"              $(if ($v["LSP_ADMIN_NAME"]) { $v["LSP_ADMIN_NAME"] } else { "Admin" })
Set-Variable "LSP_CORS_ORIGINS"            $v["LSP_CORS_ORIGINS"]
Set-Variable "LSP_FILE_UPLOAD_SERVICE_URL" $v["LSP_FILE_UPLOAD_SERVICE_URL"]
Set-Variable "LSP_NOTIFICATION_SERVICE_URL"  $v["LSP_NOTIFICATION_SERVICE_URL"]
Set-Variable "LSP_NOTIFICATION_FROM_EMAIL"   $v["LSP_NOTIFICATION_FROM_EMAIL"]
Set-Variable "LSP_NOTIFICATION_FROM_NAME"    $(if ($v["LSP_NOTIFICATION_FROM_NAME"]) { $v["LSP_NOTIFICATION_FROM_NAME"] } else { "Local Service Marketplace" })
Set-Variable "LSP_DEFAULT_TENANT_ID"         $(if ($v["LSP_DEFAULT_TENANT_ID"]) { $v["LSP_DEFAULT_TENANT_ID"] } else { "local-service-marketplace" })
Set-Variable "LSP_PAYMENT_GATEWAY"           $(if ($v["LSP_PAYMENT_GATEWAY"]) { $v["LSP_PAYMENT_GATEWAY"] } else { "mock" })
Set-Variable "LSP_GOOGLE_CLIENT_ID"          $v["LSP_GOOGLE_CLIENT_ID"]
Set-Variable "LSP_FACEBOOK_APP_ID"           $v["LSP_FACEBOOK_APP_ID"]

# ── Cleanup ────────────────────────────────────────────────────────────────────
if (-not $KeepFile) {
  Remove-Item $SECRETS_FILE -Force
  Write-Host "`nsecrets.local.env deleted (secrets are now only in GitHub)." -ForegroundColor DarkGray
} else {
  warn "secrets.local.env kept on disk (-KeepFile). Delete it when done: del secrets.local.env"
}

# ── Done ───────────────────────────────────────────────────────────────────────
Write-Host @"

-------------------------------------------
  All done! Push to master to deploy.
-------------------------------------------
  Repo     : $Repo
  API      : https://$($v['LSP_API_DOMAIN'])
  Frontend : https://$($v['LSP_FRONTEND_DOMAIN'])
  Admin    : $($v['LSP_SUPER_ADMIN_EMAIL'])

"@ -ForegroundColor Green
