# Token Validation Strategy Guide

The API Gateway supports **two token validation strategies** that can be switched via environment variable.

## Configuration

Set the strategy in `api-gateway/.env`:

```env
TOKEN_VALIDATION_STRATEGY=local   # or 'api'
```

---

## Strategy 1: Local JWT Validation

**Environment Setting:**
```env
TOKEN_VALIDATION_STRATEGY=local
```

### How It Works
```
Client → Gateway → JWT.verify(token, secret) → Extract user info → Forward with headers
```

### Characteristics

✅ **Fast** - No network call, ~1-5ms  
✅ **Low latency** - Direct JWT verification  
✅ **Simple** - No auth service dependency  
✅ **Scalable** - No bottleneck  

⚠️ **Requires** - Gateway needs `JWT_SECRET`  
⚠️ **No validation** - Can't check if user is blocked/deleted  
⚠️ **No revocation** - Can't check token blacklist  

### Required Environment Variables
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
TOKEN_VALIDATION_STRATEGY=local
```

### Best For
- High-traffic applications
- Low latency requirements
- Stateless authentication
- When user account changes are infrequent

---

## Strategy 2: API-Based Validation

**Environment Setting:**
```env
TOKEN_VALIDATION_STRATEGY=api
```

### How It Works
```
Client → Gateway → POST /auth/verify → Auth Service validates → 
Checks user status → Returns user info → Gateway forwards with headers
```

### Characteristics

✅ **Centralized** - Single source of truth  
✅ **Real-time validation** - Can check user status (active/blocked)  
✅ **Revocation support** - Can implement token blacklist  
✅ **Security** - Gateway doesn't need JWT_SECRET  

⚠️ **Slower** - Network call adds ~5-50ms  
⚠️ **Dependency** - Auth service must be available  
⚠️ **Load** - Auth service handles more traffic  

### Required Environment Variables
```env
AUTH_SERVICE_URL=http://localhost:3001
GATEWAY_INTERNAL_SECRET=gateway-internal-secret-change-in-production
TOKEN_VALIDATION_STRATEGY=api
```

Auth service also needs:
```env
GATEWAY_INTERNAL_SECRET=gateway-internal-secret-change-in-production
```

### Best For
- Security-critical applications
- When you need to revoke tokens immediately
- When checking user account status is important
- Admin systems with real-time user blocking

---

## User Data Structure

**Both strategies return identical user information:**

```typescript
{
  userId: string;    // User's unique ID
  email: string;     // User's email
  role: string;      // User's role (admin, user, provider)
  name?: string;     // User's name (optional)
  phone?: string;    // User's phone (optional)
}
```

This data is:
1. Attached to `req.user` in the gateway
2. Forwarded as headers to backend services:
   - `x-user-id`
   - `x-user-email`
   - `x-user-role`
   - `x-user-name`
   - `x-user-phone`

---

## Switching Strategies

### Step 1: Update Environment Variable

Change in `api-gateway/.env`:
```env
# Switch from local to API
TOKEN_VALIDATION_STRATEGY=api

# Or switch from API to local
TOKEN_VALIDATION_STRATEGY=local
```

### Step 2: Restart Gateway
```bash
# If running locally
npm run start:dev

# If using Docker
docker-compose restart api-gateway
```

### Step 3: Verify
Check logs on startup:
```
[JwtAuthMiddleware] JWT validation strategy: local
# or
[JwtAuthMiddleware] JWT validation strategy: api
```

---

## Performance Comparison

| Metric | Local | API |
|--------|-------|-----|
| Latency | ~1-5ms | ~10-50ms |
| Throughput | Very High | Moderate |
| CPU Usage | Low | Low (gateway) |
| Network | None | Required |
| Auth Service Load | None | High |

---

## Security Comparison

| Feature | Local | API |
|---------|-------|-----|
| Token signature validation | ✅ | ✅ |
| Token expiration check | ✅ | ✅ |
| User status validation | ❌ | ✅ |
| Token revocation | ❌ | ✅ (with implementation) |
| Account blocking | ❌ | ✅ |
| Real-time updates | ❌ | ✅ |

---

## Recommendations

### Use Local Strategy When:
- You have high traffic (>1000 req/s)
- Latency is critical (< 10ms)
- You trust token expiration times
- User account changes are rare
- You don't need immediate token revocation

### Use API Strategy When:
- Security is paramount
- You need to block users immediately
- You implement token blacklisting
- You want centralized auth logic
- Your traffic is moderate (< 500 req/s)
- You can tolerate extra latency

---

## Hybrid Approach (Future Enhancement)

Consider caching verified tokens in Redis:
1. Try local cache first (fast)
2. If miss, verify via API
3. Cache result for 1-5 minutes
4. Invalidate on user status change

This combines speed of local with security of API.

---

## Troubleshooting

### "Token verification failed" with local strategy
- Check `JWT_SECRET` matches auth service
- Verify token is not expired
- Check token format

### "Token verification service unavailable" with API strategy
- Check `AUTH_SERVICE_URL` is correct
- Verify auth service is running
- Check `GATEWAY_INTERNAL_SECRET` matches both services
- Check network connectivity

### Logs show wrong strategy
- Check `.env` file is loaded
- Restart gateway after changing config
- Verify no environment variable overrides
