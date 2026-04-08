param([string]$BaseUrl = "http://127.0.0.1:3800/api/v1")

$results = @()

function Test-Endpoint {
    param($Name, $Method, $Path, $Token = $null, $Body = $null, $ExpectedStatus = 200)
    $url = "$BaseUrl$Path"
    try {
        $params = @{ Uri = $url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 10 }
        if ($Token) { $params.Headers = @{Authorization = "Bearer $Token"} }
        if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
        $r = Invoke-WebRequest @params
        $status = $r.StatusCode
        $pass = $status -eq $ExpectedStatus -or ($ExpectedStatus -eq 200 -and $status -in @(200,201))
        [PSCustomObject]@{ Name=$Name; Status=$status; Pass=$pass; Error="" }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (!$code) { $code = "CONN_ERR" }
        [PSCustomObject]@{ Name=$Name; Status=$code; Pass=$false; Error=$_.Exception.Message.Substring(0,[Math]::Min(80,$_.Exception.Message.Length)) }
    }
}

Write-Host "=== STEP 1: Login ===" -ForegroundColor Cyan
try {
    $loginResp = Invoke-WebRequest "$BaseUrl/user/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@marketplace.com","password":"password123"}' -UseBasicParsing
    $loginData = ($loginResp.Content | ConvertFrom-Json).data
    $token = $loginData.accessToken
    $adminId = $loginData.user.id
    Write-Host "Login OK. Token length: $($token.Length), User: $($loginData.user.email)" -ForegroundColor Green
    $results += [PSCustomObject]@{Name="POST /user/auth/login"; Status=200; Pass=$true; Error=""}
} catch {
    Write-Host "Login FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $results += [PSCustomObject]@{Name="POST /user/auth/login"; Status="FAIL"; Pass=$false; Error=$_.Exception.Message}
    exit 1
}

Write-Host "`n=== STEP 2: Auth Endpoints ===" -ForegroundColor Cyan
$results += Test-Endpoint "POST /user/auth/signup" POST "/user/auth/signup" -Body '{"email":"newtest99xyz@test.com","password":"TestPass123!","name":"New User","phone":"+15559876543","userType":"customer"}' -ExpectedStatus 201
$results += Test-Endpoint "GET /user/users/me" GET "/user/users/me" -Token $token
$results += Test-Endpoint "PATCH /user/users/me (update)" PATCH "/user/users/me" -Token $token -Body '{"name":"Admin Updated"}'

Write-Host "`n=== STEP 3: Provider Endpoints ===" -ForegroundColor Cyan
$results += Test-Endpoint "GET /user/providers" GET "/user/providers"
$results += Test-Endpoint "GET /user/providers/:id (invalid)" GET "/user/providers/00000000-0000-0000-0000-000000000000" -ExpectedStatus 404

Write-Host "`n=== STEP 4: Marketplace ===" -ForegroundColor Cyan
$results += Test-Endpoint "GET /marketplace/categories" GET "/marketplace/categories"
$results += Test-Endpoint "GET /marketplace/requests" GET "/marketplace/requests" -Token $token
$results += Test-Endpoint "POST /marketplace/requests" POST "/marketplace/requests" -Token $token -Body '{"title":"Test Service Request","description":"I need a plumber for fixing sink","categoryId":"00000000-0000-0000-0000-000000000001","budget":{"min":50,"max":200},"location":{"city":"New York","state":"NY","country":"US"}}' -ExpectedStatus 201
$results += Test-Endpoint "GET /marketplace/jobs" GET "/marketplace/jobs" -Token $token
$results += Test-Endpoint "GET /marketplace/proposals" GET "/marketplace/proposals" -Token $token

Write-Host "`n=== STEP 5: Payments ===" -ForegroundColor Cyan
$results += Test-Endpoint "GET /payments/history" GET "/payments/history" -Token $token
$results += Test-Endpoint "GET /payments/methods" GET "/payments/methods" -Token $token

Write-Host "`n=== STEP 6: Comms ===" -ForegroundColor Cyan
$results += Test-Endpoint "GET /comms/notifications" GET "/comms/notifications" -Token $token
$results += Test-Endpoint "GET /comms/messages" GET "/comms/messages" -Token $token

Write-Host "`n=== STEP 7: Admin/Oversight ===" -ForegroundColor Cyan
$results += Test-Endpoint "GET /admin/users" GET "/admin/users" -Token $token
$results += Test-Endpoint "GET /admin/analytics/overview" GET "/admin/analytics/overview" -Token $token
$results += Test-Endpoint "GET /admin/disputes" GET "/admin/disputes" -Token $token

Write-Host "`n=== STEP 8: Infrastructure ===" -ForegroundColor Cyan
$results += Test-Endpoint "GET /infrastructure/feature-flags" GET "/infrastructure/feature-flags" -Token $token
$results += Test-Endpoint "GET /infrastructure/health" GET "/infrastructure/health" -Token $token

Write-Host "`n=== STEP 9: Health Checks ===" -ForegroundColor Cyan
$results += Test-Endpoint "GET /health (gateway)" GET "/health"
foreach($svc in @(
  @{name="identity";port=3001},@{name="marketplace";port=3003},@{name="payment";port=3006},
  @{name="comms";port=3007},@{name="oversight";port=3010},@{name="infrastructure";port=3012}
)){
  try{
    $r = Invoke-WebRequest "http://127.0.0.1:$($svc.port)/health" -UseBasicParsing -TimeoutSec 5
    $results += [PSCustomObject]@{Name="GET health ($($svc.name):$($svc.port))"; Status=$r.StatusCode; Pass=$true; Error=""}
  }catch{
    $results += [PSCustomObject]@{Name="GET health ($($svc.name):$($svc.port))"; Status="FAIL"; Pass=$false; Error="$($_.Exception.Message.Substring(0,60))"}
  }
}

Write-Host "`n=== RESULTS ===" -ForegroundColor Cyan
$pass = $results | Where-Object Pass; $fail = $results | Where-Object { -not $_.Pass }
Write-Host "PASSED: $($pass.Count)  FAILED: $($fail.Count)  TOTAL: $($results.Count)" -ForegroundColor $(if($fail.Count -eq 0){"Green"}else{"Yellow"})

Write-Host "`n--- FAILURES ---" -ForegroundColor Red
$fail | ForEach-Object { Write-Host "  [FAIL] $($_.Name) -> HTTP $($_.Status) $($_.Error)" -ForegroundColor Red }

Write-Host "`n--- PASSES ---" -ForegroundColor Green
$pass | ForEach-Object { Write-Host "  [PASS] $($_.Name) -> HTTP $($_.Status)" -ForegroundColor Green }

$results | Export-Csv -Path "test-reports/endpoint-test-results.csv" -NoTypeInformation
Write-Host "`nResults saved to test-reports/endpoint-test-results.csv"
