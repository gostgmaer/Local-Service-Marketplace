param(
  [string]$Migration = 'database\migrations\016_add_display_ids.sql'
)
if (-not (Test-Path $Migration)) {
  Write-Error "Migration file not found: $Migration"
  exit 1
}
# Read file as raw text and pipe into docker exec which reads stdin
Get-Content $Migration -Raw | docker exec -i marketplace-postgres psql -U postgres -d marketplace
if ($LASTEXITCODE -ne 0) {
  Write-Error "Migration failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}
Write-Host "Migration applied successfully." -ForegroundColor Green
