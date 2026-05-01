# 🔧 Troubleshooting Guide

Common issues and solutions for the Local Service Marketplace platform.

---

## Table of Contents

1. [Docker & Service Issues](#docker--service-issues)
2. [Frontend Issues](#frontend-issues)
3. [Backend API Issues](#backend-api-issues)
4. [Database Issues](#database-issues)
5. [Authentication Issues](#authentication-issues)
6. [Google Maps Issues](#google-maps-issues)
7. [Notification Issues](#notification-issues)
8. [Performance Issues](#performance-issues)
9. [Known Migration Issues (Next.js 15 / React 19)](#known-migration-issues-nextjs-15--react-19)
10. [pnpm Lockfile Issues](#pnpm-lockfile-issues)
11. [Socket.IO / Real-time Issues](#socketio--real-time-issues)

---

## Known Migration Issues (Next.js 15 / React 19)

### ❌ `params` or `searchParams` is not awaitable

**Error:** `Type error: Property 'id' does not exist on type 'Promise<...>'`

**Cause:** Next.js 15 App Router made `params` and `searchParams` async.

**Solution:**
```typescript
// ❌ Old (Next.js 14)
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>
}

// ✅ New (Next.js 15)
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>{id}</div>
}
```

---

### ❌ React 19 `act()` warnings in tests

**Error:** `Warning: An update to Component inside a test was not wrapped in act(...)`

**Solution:** Upgrade `@testing-library/react` to `^16.x` (already included in this project's `frontend/package.json`). Ensure `jest.setup.js` uses the correct import.

---

### ❌ `@hookform/resolvers` type errors after upgrade

**Cause:** `zod@4.x` introduced breaking schema changes. Use `@hookform/resolvers@5.x` which supports both zod 3 and 4.

**Solution:** Already resolved — `package.json` uses `@hookform/resolvers@5.2.2` and `zod@4.4.1`.

---

## pnpm Lockfile Issues

### ❌ `pnpm install` overwrites all service lockfiles

**Cause:** Running `pnpm install` from the workspace root regenerates a single workspace lockfile that collapses all service dependencies.

**Solution:** Generate per-service lockfiles independently:
```powershell
# Run inside each service directory
cd services/identity-service
pnpm install --lockfile-only --ignore-workspace

# Repeat for each service:
# api-gateway, frontend, database, comms-service, marketplace-service,
# oversight-service, payment-service, infrastructure-service
```

---

### ❌ `ERR_PNPM_OUTDATED_LOCKFILE` on Docker build

**Cause:** The lockfile was generated with a different pnpm version than the one in the Docker image.

**Solution:**
1. Check the pnpm version in `package.json` `engines` or `packageManager` field
2. Run `pnpm install --lockfile-only --ignore-workspace` locally with the same pnpm version
3. Commit the regenerated lockfile

---

## Socket.IO / Real-time Issues

### ❌ Socket.IO connection refused / 404

**Check:**
1. `comms-service` is running: `docker ps | grep comms-service`
2. The API gateway is forwarding WebSocket upgrade headers — check nginx/reverse proxy config
3. `NEXT_PUBLIC_SOCKET_URL` in `frontend/.env` points to the right host

**Fix for reverse proxy (nginx):**
```nginx
location /socket.io/ {
    proxy_pass http://comms-service:3007;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

---

### ❌ Socket.IO events not received after login

**Cause:** JWT token passed to Socket.IO auth is expired.

**Solution:** Reconnect the socket after token refresh:
```typescript
socket.auth = { token: newAccessToken };
socket.disconnect().connect();
```

---

## Docker & Service Issues

### ❌ Services Won't Start

**Error:** `Cannot connect to Docker daemon`

**Solution:**
```powershell
# 1. Check Docker Desktop is running
docker --version

# 2. Start Docker Desktop
# (Open Docker Desktop app)

# 3. Wait for Docker to be ready, then:
.\scripts\start.ps1
```

---

### ❌ Container Exits Immediately

**Error:** `Container identity-service exited with code 1`

**Solution:**
```powershell
# 1. Check logs for error details
docker logs identity-service --tail 50

# 2. Common causes:
# - Missing environment variables
# - Database not ready
# - Port already in use

# 3. Restart with fresh build
docker-compose stop identity-service
docker-compose build --no-cache identity-service
docker-compose up -d identity-service

# 4. Check if it's running
docker ps | grep identity-service
```

---

### ❌ Port Already in Use

**Error:** `Bind for 0.0.0.0:3700 failed: port is already allocated`

**Solution:**
```powershell
# 1. Find what's using the port
netstat -ano | findstr :3700

# 2. Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# 3. Or change the port in docker-compose.yml
# Change: "3700:3000" to "3701:3000"

# 4. Restart services
.\scripts\start.ps1
```

---

### ❌ Database Connection Failed

**Error:** `ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```powershell
# 1. Check if postgres is running
docker ps | grep postgres

# 2. Check postgres health
docker exec marketplace-postgres pg_isready

# 3. If not running, start it
docker-compose up -d marketplace-postgres

# 4. Wait 10 seconds for postgres to be ready

# 5. Restart the service that failed
docker-compose restart marketplace-service
```

---

##Frontend Issues

###❌ CORS Error

**Error:** `Access to XMLHttpRequest has been blocked by CORS policy`

**Solution:**
```powershell
# 1. Check API Gateway is running
docker ps | grep api-gateway

# 2. Restart API Gateway
docker-compose restart api-gateway

# 3. Clear browser cache
# Press Ctrl+Shift+Delete → Clear cache

# 4. Hard refresh browser
# Press Ctrl+Shift+R

# 5. Verify CORS headers in Network tab:
# Access-Control-Allow-Origin should be http://localhost:3000
# NOT *
```

**Root Cause:** Backend services had `app.enableCors()` enabled. Only the API Gateway should handle CORS.

**Permanent Fix:** Already applied - all backend services have CORS disabled.

---

### ❌ White Screen / Blank Page

**Error:** Page loads but shows nothing

**Solution:**
```powershell
# 1. Check browser console (F12) for errors

# 2. Common causes:
# - JavaScript error (check console)
# - API endpoint not responding
# - Missing environment variables

# 3. Check .env.local exists
ls frontend\nextjs-app\.env.local

# 4. If missing, create it
cp frontend\nextjs-app\.env.example .env.local

# 5. Restart dev server
cd frontend\nextjs-app
npm run dev
```

---

### ❌ Module Not Found Error

**Error:** `Cannot find module '@/components/...'`

**Solution:**
```powershell
# 1. Install dependencies
cd frontend\nextjs-app
npm install

# 2. Clear Next.js cache
rm -r .next

# 3. Restart dev server
npm run dev

# 4. If still failing, check tsconfig.json paths are correct
```

---

## Backend API Issues

### ❌ 401 Unauthorized

**Error:** All API requests return 401

**Solution:**
```powershell
# Option 1: Clear storage and re-login
# 1. Open DevTools (F12) → Application → Local Storage
# 2. Delete 'access_token' and 'refresh_token'
# 3. Go to /login and log in again

# Option 2: Check token is being sent
# 1. Open DevTools (F12) → Network tab
# 2. Click any API request
# 3. Check Headers → Request Headers
# 4. Should see: Authorization: Bearer eyJhbG...

# If missing, clear localStorage and re-login
```

**Root Cause:** Token not stored or not sent in Authorization header.

**Recent Fix:** Updated `api-client.ts` to send `Authorization: Bearer <token>` header.

---

### ❌ 404 Not Found

**Error:** `Cannot GET /api/users`

**Solution:**
```
# Endpoints now use /api/v1 prefix

# Wrong: http://localhost:3700/api/auth/login
# Correct: http://localhost:3700/api/v1/user/auth/login

# Update your requests to include /api/v1
```

**Root Cause:** API versioning was added. All endpoints now require `/api/v1` prefix.

**Fix Applied:** All frontend services updated to use `/api/v1`.

---

### ❌ 500 Internal Server Error

**Error:** API returns 500

**Solution:**
```powershell
# 1. Check backend logs
docker logs [service-name] --tail 100

# 2. Common causes:
# - Database query error
# - Missing environment variable
# - Null reference error

# 3. Check database connection
docker exec marketplace-postgres psql -U postgres -d marketplace -c "SELECT 1"

# 4. Restart the failing service
docker-compose restart [service-name]
```

---

## Database Issues

### ❌ Database Schema Out of Sync

**Error:** `column "xyz" does not exist`

**Solution:**
```powershell
# 1. Connect to database
docker exec -it marketplace-postgres psql -U postgres -d marketplace

# 2. Check table schema
\d users

# 3. If column missing, run migrations
# (Migrations are in database/schema.sql)

# 4. Drop and recreate database (CAUTION: loses data)
DROP DATABASE marketplace;
CREATE DATABASE marketplace;
\c marketplace
\i /docker-entrypoint-initdb.d/schema.sql

# 5. Exit
\q

# 6. Restart all services
.\scripts\stop.ps1
.\scripts\start.ps1
```

---

### ❌ Too Many Connections

**Error:** `sorry, too many clients already`

**Solution:**
```powershell
# 1. Restart postgres
docker-compose restart marketplace-postgres

# 2. Check connection count
docker exec marketplace-postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity"

# 3. If high, kill idle connections
docker exec marketplace-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle'"

# 4. Increase max_connections in postgres config (if needed)
```

---

## Authentication Issues

###❌ Cannot Log In

**Error:** "Invalid credentials" but password is correct

**Solution:**
```powershell
# 1. Check user exists in database
docker exec marketplace-postgres psql -U postgres -d marketplace -c "SELECT email, email_verified FROM users WHERE email='test@example.com'"

# 2. If user doesn't exist, sign up first
# Go to /signup

# 3. If email_verified is false
# Check email in console logs (development mode):
docker logs identity-service | grep "verification"

# 4. Or update database directly (dev only):
docker exec marketplace-postgres psql -U postgres -d marketplace -c "UPDATE users SET email_verified=true WHERE email='test@example.com'"
```

---

### ❌ JWT Token Invalid

**Error:** "Invalid token" or "Token expired"

**Solution:**
```powershell
# 1. Clear localStorage
# DevTools (F12) → Application → Local Storage → Clear

# 2. Log in again to get new token

# 3. Check JWT_SECRET matches across services
docker exec identity-service printenv JWT_SECRET
docker exec api-gateway printenv JWT_SECRET
# Should be identical

# 4. If different, update docker-compose.yml and restart
```

---

### ❌ Infinite Redirect Loop

**Error:** Page keeps redirecting between /login and /dashboard

**Solution:**
```tsx
// Check middleware.ts and auth guards

// 1. Clear localStorage
localStorage.clear()

// 2. Refresh page (Ctrl+Shift+R)

// 3. Check auth state in DevTools:
console.log(useAuthStore.getState())

// 4. Should show: { isAuthenticated: false, user: null }
```

---

## Google Maps Issues

### ❌ Map Not Loading

**Error:** `Google Maps JavaScript API error: InvalidKeyMapError`

**Solution:**
```powershell
# 1. Check API key is set in .env.local
cat frontend\nextjs-app\.env.local | Select-String "GOOGLE_MAPS"

# 2. If missing, add it:
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here

# 3. Restart dev server
npm run dev

# 4. Verify APIs are enabled in Google Cloud Console:
# - Maps JavaScript API ✅
# - Places API ✅
# - Geocoding API ✅

# 5. Check API key restrictions
# - Should allow localhost:3000 or no restrictions (dev)
```

---

### ❌ Geocoding Not Working

**Error:** Address search doesn't return results

**Solution:**
```
1. Check Places API is enabled
2. Check Geocoding API is enabled
3. Verify API key has no IP restrictions (dev mode)
4. Check daily quota hasn't been exceeded
5. Try with a well-known address (e.g., "1600 Amphitheatre Parkway")
```

---

### ❌ Map Shows Gray Box

**Error:** Map container is gray/blank

**Solution:**
```tsx
// 1. Check height is set on map container
<div style={{ height: '400px', width: '100%' }}>
  <LocationPicker />
</div>

// 2. Verify Google Maps script loaded
console.log(window.google)
// Should show object, not undefined

// 3. Wait for script to load before rendering
useEffect(() => {
  const interval = setInterval(() => {
    if (window.google?.maps) {
      initMap()
      clearInterval(interval)
    }
  }, 100)
}, [])
```

---

## Notification Issues

### ❌ NotificationBadge Not Updating

**Error:** Badge shows 0 but there are unread notifications

**Solution:**
```tsx
// 1. Check useNotifications hook is polling
// Should fetch every 30 seconds

// 2. Manually trigger update
const { refetch } = useNotifications()
refetch()

// 3. Check API endpoint
fetch('http://localhost:3700/api/v1/notifications/unread-count', {
  headers: { Authorization: `Bearer ${token}` }
})

// 4. Verify comms service is running
docker ps | grep comms-service
```

---

### ❌ Emails Not Sending

**Error:** User signed up but no email received

**Solution:**
```powershell
# 1. Check email-service logs
docker logs email-service --tail 50

# 2. Email provider NOT configured in MVP
# Emails will show in logs but not actually send

# 3. To configure (production):
# Add to docker-compose.yml:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password

# 4. Restart email-service
docker-compose restart email-service
```

---

## Performance Issues

### ❌ Slow API Responses

**Error:** Requests take 5+ seconds

**Solution:**
```powershell
# 1. Check database query performance
docker exec marketplace-postgres psql -U postgres -d marketplace

# Enable query logging
SET log_statement = 'all';
SET log_duration = on;

# Run slow query and check execution time
EXPLAIN ANALYZE SELECT * FROM service_requests;

# 2. Add indexes if needed
CREATE INDEX idx_requests_user_id ON service_requests(user_id);

# 3. Check for N+1 queries in backend logs
docker logs marketplace-service | grep "query"

# 4. Enable caching (Redis) for frequently accessed data
```

---

### ❌ Frontend Slow to Load

**Error:** Page takes 10+ seconds to load

**Solution:**
```tsx
// 1. Check bundle size
npm run build
// Look for large bundles in output

// 2. Add loading skeletons (already implemented)
{isLoading ? <SkeletonCard /> : <RealContent />}

// 3. Enable React Query caching
queryClient.setDefaultOptions({
  queries: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  }
})

// 4. Lazy load heavy components
const HeavyComponent = dynamic(() => import('./Heavy'), { ssr: false })
```

---

### ❌ High Memory Usage

**Error:** Docker uses 8GB+ RAM

**Solution:**
```powershell
# 1. Check container memory usage
docker stats

# 2. Limit memory per service in docker-compose.yml
services:
  identity-service:
    mem_limit: 512m
    memswap_limit: 512m

# 3. Restart containers
docker-compose down
docker-compose up -d

# 4. Clean up unused images/volumes
docker system prune -a
```

---

## Still Having Issues?

### Check These Resources:

1. **Service Logs:**
   ```powershell
   docker logs [service-name] --tail 100 --follow
   ```

2. **Health Checks:**
   ```powershell
   curl http://localhost:3700/api/v1/health
   ```

3. **Database Status:**
   ```powershell
   docker exec marketplace-postgres pg_isready
   ```

4. **Network Issues:**
   ```powershell
   docker network inspect localservicemarketplace_marketplace-network
   ```

### Get More Help:

- 📖 [00_DOCUMENTATION_INDEX.md](00_DOCUMENTATION_INDEX.md) - All docs
- 📖 [QUICK_START.md](QUICK_START.md) - Setup guide
- 📖 [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- 📖 [API_SPECIFICATION.md](API_SPECIFICATION.md) - API reference

---

**Last Updated:** March 14, 2026  
**Platform Version:** 1.0  
**Status:** Production Ready


## Authentication Issues (JWT & Token Problems)

### ❌ 401 Unauthorized on all requests after login

**Error:** Login returns tokens but every subsequent request returns 401.

**Cause:** `JWT_SECRET` mismatch between api-gateway and identity-service.

**Solution:**
```powershell
# 1. Open docker.env and ensure JWT_SECRET is set to a real value
# 2. Open api-gateway/.env and services/identity-service/.env
# 3. All three files must have IDENTICAL JWT_SECRET values

# 4. Restart both services
docker-compose restart api-gateway identity-service

# 5. Generate a fresh secret if needed
openssl rand -base64 48
```

---

### ❌ 403 Forbidden calling /auth/verify (gateway → identity-service)

**Cause:** `GATEWAY_INTERNAL_SECRET` mismatch.

**Solution:** Ensure `GATEWAY_INTERNAL_SECRET` is the same value in:
- `docker.env`
- `api-gateway/.env`
- `services/identity-service/.env`
- `services/oversight-service/.env`

```powershell
docker-compose restart api-gateway identity-service oversight-service
```

---

### ❌ Refresh token not working / "Token expired"

The default refresh token lifetime is **90 days** (set via `JWT_REFRESH_EXPIRATION=90d` in identity-service).

If tokens expire sooner, check `JWT_EXPIRES_IN` (access token, default 15m) vs `JWT_REFRESH_EXPIRATION` (refresh token, default 90d) are not swapped.

---

### ❌ OAuth (Google/Facebook) redirect fails

**Cause:** Callback URLs don't match what's registered in the OAuth provider.

**Solution:**
1. In Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs, add:
   `http://localhost:3700/api/v1/user/auth/google/callback`
2. Set the same URL in `services/identity-service/.env`:
   ```env
   GOOGLE_CALLBACK_URL=http://localhost:3700/api/v1/user/auth/google/callback
   ```
3. Same pattern applies to Facebook.

---

## Redis & Workers Issues

### ❌ Redis not starting / workers not processing jobs

**Cause:** COMPOSE_PROFILES does not include `workers` or `cache`.

**Solution:**
```powershell
# Check docker.env
Get-Content docker.env | Select-String "COMPOSE_PROFILES"
# Should show: COMPOSE_PROFILES=workers (or include workers)

# If empty or wrong, edit docker.env:
# COMPOSE_PROFILES=workers

# Restart
docker-compose down
docker-compose up -d

# Verify Redis is running
docker-compose ps redis
docker exec marketplace-redis redis-cli ping   # should return PONG
```

---

### ❌ BullMQ jobs stuck in queue / not being processed

**Cause:** `WORKERS_ENABLED=false` in docker.env.

**Solution:**
```powershell
# In docker.env, set:
WORKERS_ENABLED=true
COMPOSE_PROFILES=workers

# Restart affected service
docker-compose restart identity-service
```

---

## PgBouncer Connection Pooling Issues

### ❌ Services fail to connect when PgBouncer is enabled

**Cause:** Services are using `DATABASE_HOST=postgres` instead of `pgbouncer`, or the `pooling` profile is not active.

**Solution:**
```powershell
# Enable PgBouncer profile in docker.env:
COMPOSE_PROFILES=workers,pooling

# Then verify services use the pooler:
# In docker-compose.yml each service should have DATABASE_HOST=pgbouncer
# This is set via the docker.env DATABASE_HOST variable

docker-compose up -d
docker-compose logs pgbouncer
```

---

### ❌ "prepared statement does not exist" error

**Cause:** PgBouncer in transaction mode does not support prepared statements.

**Solution:** Add `?prepared_statement_limit=0` to the `DATABASE_URL` in affected service `.env` files, or set `PGBOUNCER_POOL_MODE=session` (higher memory use but compatible).

---

## Push Notifications (Firebase FCM) Issues

### ❌ Push notifications not being sent

**Solution:**
1. Ensure `FCM_ENABLED=true` in `services/comms-service/.env`
2. Ensure `PUSH_NOTIFICATIONS_ENABLED=true`
3. Provide valid Firebase credentials:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=<base64-encoded private key>
```

To get Firebase credentials:
1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Encode the private key: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("path/to/key.json"))`
4. Set `FIREBASE_PRIVATE_KEY` to the base64 string

---

### ❌ FIREBASE_PRIVATE_KEY format errors

The private key can be provided in two formats:
- **Base64 string**: Encode the entire JSON key file as base64
- **Raw JSON string**: Paste the `private_key` field value with `\n` for newlines

If you see `PEM routines:get_name:no start line` errors, the key is incorrectly formatted. Use the base64 approach.

---

## Email & SMS Issues

### ❌ Emails not being sent

1. Check `EMAIL_ENABLED=true` in `services/comms-service/.env`
2. Check `EMAIL_SERVICE_URL` points to the running email-service
3. Check email-service logs: `docker-compose logs email-service`
4. For local dev, the email-service uses Brevo (Sendinblue) SMTP by default — check `EMAIL_USER` and `EMAIL_PASS`

### ❌ SMS OTP not working

1. Check `SMS_ENABLED=true` in `services/comms-service/.env` and `services/identity-service/.env`
2. Verify Twilio credentials:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```
3. Check sms-service logs: `docker-compose logs sms-service`

---

## Payment Issues

### ❌ Payments failing in development

By default `PAYMENT_GATEWAY=mock` — no real credentials needed. If payments fail:

```powershell
# Check payment-service logs
docker-compose logs payment-service

# Verify PAYMENT_GATEWAY is set to a supported value
Get-Content services/payment-service/.env | Select-String "PAYMENT_GATEWAY"
# Should be: mock, stripe, razorpay, paypal, payubiz, or instamojo
```

### ❌ Stripe webhook not received

1. For local development use Stripe CLI to forward webhooks:
   ```bash
   stripe listen --forward-to http://localhost:3006/webhooks/stripe
   ```
2. Copy the webhook signing secret from the CLI output to `STRIPE_WEBHOOK_SECRET`

---

## infrastructure-service Not Starting

The infrastructure-service only starts when `COMPOSE_PROFILES` includes `infrastructure` or `full`.

```powershell
# In docker.env, add infrastructure to the profile:
COMPOSE_PROFILES=workers,infrastructure

docker-compose up -d infrastructure-service
```

---

## General Debugging Tips

```powershell
# See all container statuses
docker-compose ps

# Full logs for a failing service (last 100 lines)
docker-compose logs --tail=100 identity-service

# Get a shell inside a running container
docker exec -it marketplace-identity-service sh

# Check environment inside a container
docker exec marketplace-identity-service env | Select-String "JWT"

# Check Node.js process inside container
docker exec marketplace-identity-service node --version
```
