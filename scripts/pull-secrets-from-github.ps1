#!/usr/bin/env pwsh
# pull-secrets-from-github.ps1
#
# Pulls ALL variables (with values) and secret names from GitHub,
# merges with local secret values, writes secrets.local.env, opens editor.
# After editing, run: pnpm secrets:push
#
# [SECRET]   = GitHub Secret (write-only; value preserved from local file)
# [VARIABLE] = GitHub Variable (readable; pulled live from GitHub)
#
# Usage:
#   pnpm secrets:pull
#   .\scripts\pull-secrets-from-github.ps1 [-Repo owner/repo-name]

param([string]$Repo = "")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT         = Split-Path $PSScriptRoot -Parent
$SECRETS_FILE = Join-Path $ROOT "secrets.local.env"

function ok($t)   { Write-Host "  v  $t" -ForegroundColor Green }
function info($t) { Write-Host "  i  $t" -ForegroundColor Cyan }
function warn($t) { Write-Host "  !  $t" -ForegroundColor Yellow }
function fail($t) { Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }
function hdr($t)  { Write-Host "`n--- $t ---" -ForegroundColor White }

# Preflight
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  fail "gh CLI not found. Install: winget install GitHub.cli"
}

# Load auth token from local file if present: GH_TOKEN > GHCR_TOKEN > existing gh login
if (Test-Path $SECRETS_FILE) {
  $lines = Get-Content $SECRETS_FILE
  $_ghcrToken= ($lines | Where-Object { $_ -match '^GHCR_TOKEN=(.+)$' } | Select-Object -Last 1) -replace '^GHCR_TOKEN=',''
  $_ghToken  = ($lines | Where-Object { $_ -match '^GH_TOKEN=(.+)$'    } | Select-Object -Last 1) -replace '^GH_TOKEN=',''
  if ($_ghcrToken) { $env:GH_TOKEN = $_ghcrToken }
  elseif ($_ghToken) { $env:GH_TOKEN = $_ghToken }
}
if (-not $env:GH_TOKEN) {
  gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { fail "No token found. Add GH_TOKEN= or GHCR_TOKEN= to secrets.local.env" }
}

if (-not $Repo) {
  $remote = git -C $ROOT remote get-url origin 2>$null
  if ($remote -match "github\.com[:/](.+?)(\.git)?$") { $Repo = $Matches[1] }
}
if (-not $Repo) { fail "Cannot detect repo. Pass -Repo owner/repo-name" }

$repoFlag = "--repo=$Repo"
Write-Host "`nRepo: $Repo" -ForegroundColor Cyan

# Load existing local file (to preserve unreadable secret values)
$local = @{}
if (Test-Path $SECRETS_FILE) {
  info "Found existing secrets.local.env - local secret values will be preserved"
  foreach ($line in (Get-Content $SECRETS_FILE)) {
    if ($line -match "^([A-Z0-9_]+)=(.*)$") { $local[$Matches[1]] = $Matches[2] }
  }
}

# Fetch ALL Variables from GitHub (values ARE readable)
hdr "Fetching GitHub Variables"
$ghVars = @{}
try {
  $varJson = gh variable list $repoFlag --json name,value 2>&1
  if ($LASTEXITCODE -eq 0) {
    foreach ($v in ($varJson | ConvertFrom-Json)) {
      $ghVars[$v.name] = $v.value
      ok "var  $($v.name) = $($v.value)"
    }
    if ($ghVars.Count -eq 0) { warn "No variables found in GitHub" }
  } else { warn "Could not fetch variables: $varJson" }
} catch { warn "Variable fetch failed: $_" }

# Fetch ALL Secret names (values NOT readable)
hdr "Fetching GitHub Secret names"
try {
  $secJson = gh secret list $repoFlag --json name 2>&1
  if ($LASTEXITCODE -eq 0) {
    foreach ($s in ($secJson | ConvertFrom-Json)) {
      $hasLocal = [bool]$local[$s.name]
      $note  = if ($hasLocal) { "(local value preserved)" } else { "(no local value - fill in)" }
      $color = if ($hasLocal) { "Green" } else { "Yellow" }
      Write-Host "  *  secret $($s.name) $note" -ForegroundColor $color
    }
  } else { warn "Could not fetch secrets: $secJson" }
} catch { warn "Secret fetch failed: $_" }

# Resolve priority: GitHub Variable > local file > default
function Resolve([string]$key, [string]$default = "") {
  if ($ghVars.ContainsKey($key) -and $ghVars[$key]) { return $ghVars[$key] }
  if ($local.ContainsKey($key)  -and $local[$key])  { return $local[$key] }
  return $default
}

hdr "Writing secrets.local.env"

$lines = @(
  "# secrets.local.env",
  "# Edit any value, save, close Notepad, then run: pnpm secrets:push",
  "# This file is in .gitignore and will NEVER be committed.",
  "#",
  "# [SECRET]   = GitHub Secret  (write-only; local value preserved here)",
  "# [VARIABLE] = GitHub Variable (readable; synced live from GitHub)",
  "",
  "# -- [SECRET] Crypto keys --------------------------------------------------",
  "LSP_JWT_SECRET=$(Resolve 'LSP_JWT_SECRET')",
  "LSP_JWT_REFRESH_SECRET=$(Resolve 'LSP_JWT_REFRESH_SECRET')",
  "LSP_GATEWAY_INTERNAL_SECRET=$(Resolve 'LSP_GATEWAY_INTERNAL_SECRET')",
  "LSP_ENCRYPTION_KEY=$(Resolve 'LSP_ENCRYPTION_KEY')",
  "LSP_SESSION_SECRET=$(Resolve 'LSP_SESSION_SECRET')",
  "LSP_AUTH_SECRET=$(Resolve 'LSP_AUTH_SECRET')",
  "",
  "# -- [SECRET] Database -----------------------------------------------------",
  "LSP_POSTGRES_PASSWORD=$(Resolve 'LSP_POSTGRES_PASSWORD')",
  "LSP_REDIS_PASSWORD=$(Resolve 'LSP_REDIS_PASSWORD')",
  "",
  "# -- [VARIABLE] Database config --------------------------------------------",
  "LSP_POSTGRES_USER=$(Resolve 'LSP_POSTGRES_USER' 'postgres')",
  "LSP_POSTGRES_DB=$(Resolve 'LSP_POSTGRES_DB' 'marketplace')",
  "",
  "# -- [SECRET] Super admin --------------------------------------------------",
  "LSP_SUPER_ADMIN_EMAIL=$(Resolve 'LSP_SUPER_ADMIN_EMAIL')",
  "LSP_SUPER_ADMIN_PASSWORD=$(Resolve 'LSP_SUPER_ADMIN_PASSWORD')",
  "",
  "# -- [VARIABLE] Super admin display name -----------------------------------",
  "LSP_SUPER_ADMIN_NAME=$(Resolve 'LSP_SUPER_ADMIN_NAME' 'Super Admin')",
  "",
  "# -- [SECRET] Second admin password / [VARIABLE] email and name -----------",
  "LSP_ADMIN_EMAIL=$(Resolve 'LSP_ADMIN_EMAIL')",
  "LSP_ADMIN_PASSWORD=$(Resolve 'LSP_ADMIN_PASSWORD')",
  "LSP_ADMIN_NAME=$(Resolve 'LSP_ADMIN_NAME' 'Admin')",
  "",
  "# -- [VARIABLE] Domains ----------------------------------------------------",
  "LSP_API_DOMAIN=$(Resolve 'LSP_API_DOMAIN' 'lsp-api.easydev.in')",
  "LSP_FRONTEND_DOMAIN=$(Resolve 'LSP_FRONTEND_DOMAIN' 'lsp.easydev.in')",
  "",
  "# -- [VARIABLE] CORS (blank = auto from LSP_FRONTEND_DOMAIN) ---------------",
  "# Example: https://lsp.easydev.in,https://www.lsp.easydev.in",
  "LSP_CORS_ORIGINS=$(Resolve 'LSP_CORS_ORIGINS')",
  "",
  "# -- [VARIABLE] App metadata -----------------------------------------------",
  "LSP_NOTIFICATION_FROM_NAME=$(Resolve 'LSP_NOTIFICATION_FROM_NAME' 'Local Service Marketplace')",
  "LSP_DEFAULT_TENANT_ID=$(Resolve 'LSP_DEFAULT_TENANT_ID' 'local-service-marketplace')",
  "",
  "# -- [VARIABLE] External services ------------------------------------------",
  "LSP_FILE_UPLOAD_SERVICE_URL=$(Resolve 'LSP_FILE_UPLOAD_SERVICE_URL' 'https://your-upload-service.onrender.com')",
  "LSP_NOTIFICATION_SERVICE_URL=$(Resolve 'LSP_NOTIFICATION_SERVICE_URL')",
  "LSP_NOTIFICATION_FROM_EMAIL=$(Resolve 'LSP_NOTIFICATION_FROM_EMAIL' 'noreply@easydev.in')",
  "",
  "# -- [SECRET] Notification API key -----------------------------------------",
  "LSP_NOTIFICATION_API_KEY=$(Resolve 'LSP_NOTIFICATION_API_KEY')",
  "",
  "# -- [VARIABLE] Payment gateway (mock | razorpay | stripe) -----------------",
  "LSP_PAYMENT_GATEWAY=$(Resolve 'LSP_PAYMENT_GATEWAY' 'mock')",
  "",
  "# -- [SECRET] Razorpay ------------------------------------------------------",
  "LSP_RAZORPAY_KEY_ID=$(Resolve 'LSP_RAZORPAY_KEY_ID')",
  "LSP_RAZORPAY_KEY_SECRET=$(Resolve 'LSP_RAZORPAY_KEY_SECRET')",
  "LSP_RAZORPAY_WEBHOOK_SECRET=$(Resolve 'LSP_RAZORPAY_WEBHOOK_SECRET')",
  "",
  "# -- [SECRET] Stripe --------------------------------------------------------",
  "LSP_STRIPE_SECRET_KEY=$(Resolve 'LSP_STRIPE_SECRET_KEY')",
  "LSP_STRIPE_WEBHOOK_SECRET=$(Resolve 'LSP_STRIPE_WEBHOOK_SECRET')",
  "",
  "# -- [VARIABLE] OAuth client IDs (public) ----------------------------------",
  "LSP_GOOGLE_CLIENT_ID=$(Resolve 'LSP_GOOGLE_CLIENT_ID')",
  "LSP_FACEBOOK_APP_ID=$(Resolve 'LSP_FACEBOOK_APP_ID')",
  "",
  "# -- [SECRET] OAuth client secrets -----------------------------------------",
  "LSP_GOOGLE_CLIENT_SECRET=$(Resolve 'LSP_GOOGLE_CLIENT_SECRET')",
  "LSP_FACEBOOK_APP_SECRET=$(Resolve 'LSP_FACEBOOK_APP_SECRET')",
  "",
  "# -- [SECRET] Maps ----------------------------------------------------------",
  "LSP_GOOGLE_MAPS_API_KEY=$(Resolve 'LSP_GOOGLE_MAPS_API_KEY')"
)

[IO.File]::WriteAllText($SECRETS_FILE, ($lines -join "`n"), [Text.Encoding]::UTF8)
ok "Written: $SECRETS_FILE"

Write-Host "`nOpening Notepad - edit any value, save, close, then run: pnpm secrets:push`n" -ForegroundColor Cyan
Start-Process notepad.exe -ArgumentList $SECRETS_FILE -Wait

Write-Host "`nDone. Push all changes to GitHub:" -ForegroundColor Green
Write-Host "  pnpm secrets:push" -ForegroundColor White
