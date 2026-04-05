param([string]$BaseUrl = "http://127.0.0.1:3800/api/v1")

$lr = Invoke-WebRequest "$BaseUrl/user/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@marketplace.com","password":"password123"}' -UseBasicParsing
$ld = ($lr.Content | ConvertFrom-Json).data
$tk = $ld.accessToken
$adminId = $ld.user.id
Write-Host "Admin ID: $adminId"

function Probe($desc, $url, $headers = @{}, $method = "GET", $body = $null) {
    $p = @{ Uri = $url; Method = $method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 8 }
    if ($body) { $p.Body = $body; $p.ContentType = "application/json" }
    try {
        $r = Invoke-WebRequest @p
        $parsed = $r.Content | ConvertFrom-Json
        Write-Host "[$($r.StatusCode)] $desc"
        if ($parsed.message) { Write-Host "  MSG: $($parsed.message)" }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $errBody = $reader.ReadToEnd()
        $ep = try { $errBody | ConvertFrom-Json } catch { $null }
        $msg = if ($ep -and $ep.message) { $ep.message } elseif ($errBody) { $errBody.Substring(0, [Math]::Min(200, $errBody.Length)) } else { "unknown" }
        Write-Host "[$code] $desc"
        Write-Host "  ERR: $msg"
    }
}

# Test providers directly on identity-service with user headers
Write-Host "`n=== PROVIDERS DIRECT (bypass gateway) ==="
Probe "GET /providers (direct, no auth)" "http://127.0.0.1:3001/providers"
Probe "GET /providers (direct, with x-user-id)" "http://127.0.0.1:3001/providers" @{"x-user-id"=$adminId; "x-user-role"="admin"; "x-user-email"="admin@marketplace.com"}

# Test favorites directly
Write-Host "`n=== FAVORITES DIRECT ==="
Probe "GET /favorites (direct, no headers)" "http://127.0.0.1:3001/favorites"
Probe "GET /favorites (direct, with x-user-id)" "http://127.0.0.1:3001/favorites" @{"x-user-id"=$adminId; "x-user-role"="admin"}

# Test requests/my directly and compare
Write-Host "`n=== REQUESTS/MY DIRECT ==="
Probe "GET /requests/my (via gateway with token)" "http://127.0.0.1:3800/api/v1/requests/my" @{Authorization="Bearer $tk"}
Probe "GET /requests/my (direct, with x-user-id)" "http://127.0.0.1:3003/requests/my" @{"x-user-id"=$adminId; "x-user-role"="admin"}

# Test notifications directly
Write-Host "`n=== NOTIFICATIONS DIRECT ==="
Probe "GET /notifications (via gateway with token)" "http://127.0.0.1:3800/api/v1/notifications" @{Authorization="Bearer $tk"}
Probe "GET /notifications (direct, with x-user-id)" "http://127.0.0.1:3007/notifications" @{"x-user-id"=$adminId; "x-user-role"="admin"}

# Test reviews
Write-Host "`n=== REVIEWS ==="
Probe "GET /reviews/provider/{id} (via gateway, no auth)" "http://127.0.0.1:3800/api/v1/reviews/provider/$adminId"
Probe "GET /reviews/provider/{id} (direct)" "http://127.0.0.1:3003/reviews/provider/$adminId"

# Test pricing plans
Write-Host "`n=== PRICING PLANS ==="
Probe "GET /pricing-plans (via gateway, no auth)" "http://127.0.0.1:3800/api/v1/pricing-plans"
Probe "GET /pricing-plans (via gateway, with auth)" "http://127.0.0.1:3800/api/v1/pricing-plans" @{Authorization="Bearer $tk"}
Probe "GET /pricing-plans (direct)" "http://127.0.0.1:3006/pricing-plans"
