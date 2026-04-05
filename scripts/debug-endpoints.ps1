param([string]$Token)

if (!$Token) {
    $lr = Invoke-WebRequest "http://127.0.0.1:3800/api/v1/user/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@marketplace.com","password":"password123"}' -UseBasicParsing
    $Token = ($lr.Content | ConvertFrom-Json).data.accessToken
}

$h = @{ Authorization = "Bearer $Token" }

$tests = @(
    @{ url = "http://127.0.0.1:3800/api/v1/users/me"; desc = "GET /users/me (auth user profile)" },
    @{ url = "http://127.0.0.1:3800/api/v1/user/auth/me"; desc = "GET /user/auth/me (auth alt)" },
    @{ url = "http://127.0.0.1:3800/api/v1/providers"; desc = "GET /providers (no auth)" },
    @{ url = "http://127.0.0.1:3800/api/v1/payments"; desc = "GET /payments" },
    @{ url = "http://127.0.0.1:3800/api/v1/reviews"; desc = "GET /reviews" },
    @{ url = "http://127.0.0.1:3800/api/v1/notifications"; desc = "GET /notifications" },
    @{ url = "http://127.0.0.1:3800/api/v1/messages"; desc = "GET /messages" },
    @{ url = "http://127.0.0.1:3800/api/v1/admin/users"; desc = "GET /admin/users" },
    @{ url = "http://127.0.0.1:3800/api/v1/subscriptions"; desc = "GET /subscriptions" },
    @{ url = "http://127.0.0.1:3800/api/v1/pricing-plans"; desc = "GET /pricing-plans (no auth)" },
    @{ url = "http://127.0.0.1:3800/api/v1/rate-limits"; desc = "GET /rate-limits" }
)

foreach ($test in $tests) {
    $params = @{ Uri = $test.url; Method = "GET"; Headers = $h; UseBasicParsing = $true; TimeoutSec = 8 }
    if ($test.url -like "*/providers" -or $test.url -like "*/pricing-plans") {
        $params.Remove("Headers")
    }
    try {
        $r = Invoke-WebRequest @params
        $body = $r.Content | ConvertFrom-Json
        Write-Host "[$($r.StatusCode)] $($test.desc)"
        if ($body.message) { Write-Host "  -> $($body.message)" }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $body = $reader.ReadToEnd()
        $parsed = try { $body | ConvertFrom-Json } catch { $null }
        $msg = if ($parsed) { $parsed.message } else { $body }
        Write-Host "[$code] $($test.desc)"
        Write-Host "  -> Error: $msg"
    }
}
