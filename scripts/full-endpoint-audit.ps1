param([string]$BaseUrl = "http://127.0.0.1:3800/api/v1")

$lr = Invoke-WebRequest "$BaseUrl/user/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@marketplace.com","password":"password123"}' -UseBasicParsing
$loginData = ($lr.Content | ConvertFrom-Json).data
$tk = $loginData.accessToken
$adminId = $loginData.user.id
$h = @{ Authorization = "Bearer $tk" }

Write-Host "=== DETAILED ENDPOINT AUDIT ===" -ForegroundColor Cyan

function Probe-Endpoint {
    param($Desc, $Method, $Url, $UseAuth = $true, $Body = $null)
    $pms = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 10 }
    if ($UseAuth) { $pms.Headers = $h }
    if ($Body) { $pms.Body = $Body; $pms.ContentType = "application/json" }
    try {
        $r = Invoke-WebRequest @pms
        $parsed = $r.Content | ConvertFrom-Json
        $preview = if ($parsed.data) { ($parsed.data | ConvertTo-Json -Depth 1 -Compress).Substring(0, [Math]::Min(100, ($parsed.data | ConvertTo-Json -Depth 1 -Compress).Length)) } else { "" }
        Write-Host "[$($r.StatusCode)] $Desc" -ForegroundColor Green
        if ($parsed.message) { Write-Host "  Message: $($parsed.message)" -ForegroundColor Gray }
        if ($preview) { Write-Host "  Data: $preview" -ForegroundColor Gray }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $errBody = $reader.ReadToEnd()
        $errParsed = try { $errBody | ConvertFrom-Json } catch { $null }
        $errMsg = if ($errParsed) { $errParsed.message } else { $errBody.Substring(0, [Math]::Min(150, $errBody.Length)) }
        Write-Host "[$code] $Desc" -ForegroundColor Red
        Write-Host "  Error: $errMsg" -ForegroundColor Yellow
    }
}

Write-Host "`n[IDENTITY SERVICE - Auth Routes]"
Probe-Endpoint "GET /user/auth/me (current user profile)" "GET" "$BaseUrl/user/auth/me"
Probe-Endpoint "GET /users/me (SHOULD WORK VIA USERS CTRL)" "GET" "$BaseUrl/users/me"
Probe-Endpoint "GET /users (admin list)" "GET" "$BaseUrl/users"
Probe-Endpoint "GET /users/$adminId" "GET" "$BaseUrl/users/$adminId"
Probe-Endpoint "GET /providers (public list)" "GET" "$BaseUrl/providers" $false
Probe-Endpoint "GET /providers (with auth)" "GET" "$BaseUrl/providers" $true
Probe-Endpoint "GET /favorites" "GET" "$BaseUrl/favorites"

Write-Host "`n[MARKETPLACE SERVICE]"
Probe-Endpoint "GET /categories" "GET" "$BaseUrl/categories" $false
Probe-Endpoint "GET /requests" "GET" "$BaseUrl/requests"
Probe-Endpoint "GET /requests/my" "GET" "$BaseUrl/requests/my"
Probe-Endpoint "GET /proposals" "GET" "$BaseUrl/proposals"
Probe-Endpoint "GET /proposals/my" "GET" "$BaseUrl/proposals/my"
Probe-Endpoint "GET /jobs" "GET" "$BaseUrl/jobs"
Probe-Endpoint "GET /jobs/my" "GET" "$BaseUrl/jobs/my"
Probe-Endpoint "GET /reviews/provider/00000000-0000-0000-0000-000000000001" "GET" "$BaseUrl/reviews/provider/00000000-0000-0000-0000-000000000001" $false

Write-Host "`n[PAYMENT SERVICE]"
Probe-Endpoint "GET /payments/my" "GET" "$BaseUrl/payments/my"
Probe-Endpoint "GET /payment-methods" "GET" "$BaseUrl/payment-methods"
Probe-Endpoint "GET /pricing-plans" "GET" "$BaseUrl/pricing-plans" $false
Probe-Endpoint "GET /pricing-plans (auth)" "GET" "$BaseUrl/pricing-plans"
Probe-Endpoint "GET /subscriptions (need provider)" "GET" "$BaseUrl/subscriptions/provider/$adminId"

Write-Host "`n[COMMS SERVICE]"
Probe-Endpoint "GET /notifications" "GET" "$BaseUrl/notifications"
Probe-Endpoint "GET /notifications/unread-count" "GET" "$BaseUrl/notifications/unread-count"
Probe-Endpoint "GET /messages/conversations" "GET" "$BaseUrl/messages/conversations"
Probe-Endpoint "GET /notification-preferences" "GET" "$BaseUrl/notification-preferences"

Write-Host "`n[OVERSIGHT SERVICE]"
Probe-Endpoint "GET /admin/disputes" "GET" "$BaseUrl/admin/disputes"
Probe-Endpoint "GET /admin/audit-logs" "GET" "$BaseUrl/admin/audit-logs"
Probe-Endpoint "GET /admin/settings" "GET" "$BaseUrl/admin/settings"
Probe-Endpoint "GET /analytics/metrics" "GET" "$BaseUrl/analytics/metrics"
Probe-Endpoint "GET /analytics/user-activity" "GET" "$BaseUrl/analytics/user-activity"

Write-Host "`n[INFRASTRUCTURE SERVICE]"
Probe-Endpoint "GET /feature-flags" "GET" "$BaseUrl/feature-flags"
Probe-Endpoint "GET /events" "GET" "$BaseUrl/events"
Probe-Endpoint "GET /background-jobs" "GET" "$BaseUrl/background-jobs"
Probe-Endpoint "POST /rate-limits/check (rate limit check)" "POST" "$BaseUrl/rate-limits/check" $true '{"key":"test-key","limit":100,"window":3600}'
