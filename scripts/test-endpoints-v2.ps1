param([string]$BaseUrl = "http://127.0.0.1:3800/api/v1")

# Login
$loginResp = Invoke-WebRequest "$BaseUrl/user/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@marketplace.com","password":"password123"}' -UseBasicParsing
$loginData = ($loginResp.Content | ConvertFrom-Json).data
$token = $loginData.accessToken
$adminId = $loginData.user.id
Write-Host "[AUTH] Login OK - Admin: $($loginData.user.email) (token $($token.Length) chars)"

$h = @{Authorization = "Bearer $token"}
$results = [System.Collections.Generic.List[hashtable]]::new()

function Test-EP($name, $method, $path, $auth=$true, $body=$null, $expectedCodes=@(200,201)) {
    $url = "$BaseUrl$path"
    $params = @{Uri=$url; Method=$method; UseBasicParsing=$true; TimeoutSec=10}
    if ($auth) { $params.Headers = $h }
    if ($body) { $params.Body = $body; $params.ContentType = "application/json" }
    try {
        $r = Invoke-WebRequest @params
        $pass = $expectedCodes -contains $r.StatusCode
        $results.Add(@{name=$name; status=$r.StatusCode; pass=$pass; note=""})
        $icon = if($pass){"PASS"}else{"WARN"}
        Write-Host "  [$icon] $name -> $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (!$code) { $code = "CONN" }
        $pass = $expectedCodes -contains [int]$code
        $results.Add(@{name=$name; status=$code; pass=$pass; note="$($_.Exception.Message.Substring(0,[Math]::Min(60,$_.Exception.Message.Length)))"})
        $icon = if($pass){"PASS"}else{"FAIL"}
        Write-Host "  [$icon] $name -> $code"
    }
}

Write-Host "`n[IDENTITY SERVICE]"
Test-EP "POST /user/auth/signup"         POST  "/user/auth/signup"  $false '{"email":"audit_test999@e.com","password":"TestPass123!","name":"Audit User","phone":"+15551110001","userType":"customer"}' @(201,409)
Test-EP "POST /user/auth/login"          POST  "/user/auth/login"   $false '{"email":"admin@marketplace.com","password":"password123"}' @(200)
Test-EP "POST /user/auth/refresh"        POST  "/user/auth/refresh" $false "{`"refreshToken`":`"$($loginData.refreshToken)`"}" @(200)
Test-EP "GET /users/me"                  GET   "/users/me"
Test-EP "PATCH /users/me"               PATCH  "/users/me"          $true  '{"name":"Admin Updated by Test"}' @(200)
Test-EP "GET /users/$adminId"            GET   "/users/$adminId"
Test-EP "GET /providers"                 GET   "/providers"         $false  $null @(200)
Test-EP "GET /favorites"                 GET   "/favorites"

Write-Host "`n[MARKETPLACE SERVICE]"
Test-EP "GET /categories"                GET   "/categories"    $false $null @(200)
Test-EP "GET /requests"                  GET   "/requests"
Test-EP "POST /requests"                 POST  "/requests"      $true  '{"title":"Need a plumber","description":"Fix leaking pipes in bathroom","categoryId":"00000000-0000-0000-0000-000000000001","budget":{"min":50,"max":200},"location":{"city":"New York","state":"NY","country":"US"}}' @(201,400,422)
Test-EP "GET /proposals"                 GET   "/proposals"
Test-EP "GET /jobs"                      GET   "/jobs"
Test-EP "GET /reviews"                   GET   "/reviews"         $false $null @(200)

Write-Host "`n[PAYMENT SERVICE]"
Test-EP "GET /payments"                  GET   "/payments"
Test-EP "GET /payment-methods"           GET   "/payment-methods"
Test-EP "GET /subscriptions"             GET   "/subscriptions"
Test-EP "GET /pricing-plans"             GET   "/pricing-plans"  $false $null @(200)

Write-Host "`n[COMMS SERVICE]"
Test-EP "GET /notifications"             GET   "/notifications"
Test-EP "GET /messages"                  GET   "/messages"
Test-EP "GET /notification-preferences"  GET   "/notification-preferences"

Write-Host "`n[OVERSIGHT SERVICE]"
Test-EP "GET /admin"                     GET   "/admin"          $true $null @(200,404)
Test-EP "GET /admin/users"               GET   "/admin/users"
Test-EP "GET /admin/analytics"            GET   "/admin/analytics" $true $null @(200,404)
Test-EP "GET /analytics"                 GET   "/analytics"       $true $null @(200,404)
Test-EP "GET /admin/disputes"            GET   "/admin/disputes"

Write-Host "`n[INFRASTRUCTURE SERVICE]"
Test-EP "GET /feature-flags"             GET   "/feature-flags"
Test-EP "GET /events"                    GET   "/events"
Test-EP "GET /background-jobs"           GET   "/background-jobs"
Test-EP "GET /rate-limits"               GET   "/rate-limits"

Write-Host "`n[HEALTH CHECKS]"
Test-EP "GET /health (gateway)"          GET   "/health"             $false $null @(200)
foreach($svc in @(@{n="identity";p=3001},@{n="marketplace";p=3003},@{n="payment";p=3006},@{n="comms";p=3007},@{n="oversight";p=3010},@{n="infra";p=3012})){
  try{
    $r = Invoke-WebRequest "http://127.0.0.1:$($svc.p)/health" -UseBasicParsing -TimeoutSec 5
    $results.Add(@{name="Health $($svc.n):$($svc.p)"; status=$r.StatusCode; pass=$true; note=""})
    Write-Host "  [PASS] Health $($svc.n):$($svc.p) -> $($r.StatusCode)"
  }catch{
    $results.Add(@{name="Health $($svc.n):$($svc.p)"; status="FAIL"; pass=$false; note=""})
    Write-Host "  [FAIL] Health $($svc.n):$($svc.p) -> FAIL"
  }
}

# Summary
$pass = $results | Where-Object {$_["pass"]}
$fail = $results | Where-Object {-not $_["pass"]}
Write-Host "`n========================================"
Write-Host "TOTAL: $($results.Count)  PASSED: $($pass.Count)  FAILED: $($fail.Count)" -ForegroundColor $(if($fail.Count -eq 0){"Green"}else{"Yellow"})
Write-Host "========================================`n"

Write-Host "--- FAILURES ---" -ForegroundColor Red
$fail | ForEach-Object { Write-Host "  [FAIL] $($_['name']) -> HTTP $($_['status'])" -ForegroundColor Red }

Write-Host "`n--- PASSES ---" -ForegroundColor Green
$pass | ForEach-Object { Write-Host "  [PASS] $($_['name']) -> HTTP $($_['status'])" -ForegroundColor Green }
