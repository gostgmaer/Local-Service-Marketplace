$base = "http://127.0.0.1:3800/api/v1"

# Login
$login = Invoke-RestMethod "$base/user/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@marketplace.com","password":"password123"}'
$tk = $login.data.accessToken
Write-Host "Logged in. Token: $($tk.Substring(0,20))..."
$h = @{Authorization="Bearer $tk"}

# Get a real provider ID for review tests
$providers = (Invoke-WebRequest "$base/providers" -UseBasicParsing).Content | ConvertFrom-Json
$providerId = $providers.data.data[0].id
Write-Host "Provider ID: $providerId"

# Test all fixes
$tests = @(
  @{Name="pricing-plans (public GET)"; Url="$base/pricing-plans"; Auth=$false},
  @{Name="pricing-plans/active (public GET)"; Url="$base/pricing-plans/active"; Auth=$false},
  @{Name="providers (public GET)"; Url="$base/providers"; Auth=$false},
  @{Name="favorites (uses req.user)"; Url="$base/favorites"; Auth=$true},
  @{Name="notifications (ParseIntPipe fix)"; Url="$base/notifications"; Auth=$true},
  @{Name="requests/my (route order fix)"; Url="$base/requests/my"; Auth=$true},
  @{Name="users/me (new route)"; Url="$base/users/me"; Auth=$true},
  @{Name="reviews/provider/:id (public GET)"; Url="$base/reviews/provider/$providerId"; Auth=$false}
)

$passed = 0
$failed = 0
foreach ($test in $tests) {
  try {
    $headers = if ($test.Auth) { $h } else { @{} }
    $r = Invoke-WebRequest -Uri $test.Url -Headers $headers -UseBasicParsing
    Write-Host "  PASS $($test.Name): $($r.StatusCode)" -ForegroundColor Green
    $passed++
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "  FAIL $($test.Name): $status" -ForegroundColor Red
    $failed++
  }
}

Write-Host ""
Write-Host "Results: $passed PASSED, $failed FAILED" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
