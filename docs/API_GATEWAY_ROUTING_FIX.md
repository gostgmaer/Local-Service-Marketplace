# API Gateway Routing Fix - March 14, 2026

## Problem

The API Gateway was returning 500/404 errors for all endpoints because of incorrect routing configuration with the `/api/v1` prefix.

## Root Cause

1. **Route Matching Issue**: The global prefix approach caused NestJS to not properly match catch-all routes
2. **Path Forwarding Issue**: The gateway was forwarding requests with the `/api/v1` prefix to microservices that don't have this prefix in their routes

Example error flow:
```
Client → GET /api/v1/auth/signup
  ↓
API Gateway (trying to forward to)
  ↓
auth-service: http://auth-service:3001/api/v1/auth/signup ❌ (404 - route doesn't exist)
```

Expected flow:
```
Client → GET /api/v1/auth/signup
  ↓
API Gateway (strip prefix and forward to)
  ↓
auth-service: http://auth-service:3001/auth/signup ✅
```

## Solution

### 1. Moved API Prefix to Controller Level

**File**: `api-gateway/src/gateway/controllers/gateway.controller.ts`

Changed from global prefix to controller-level prefix:
```typescript
@Controller('api/v1')  // ← Added prefix here
export class GatewayController {
  @All('*')  // Matches /api/v1/*
  async handleRequest(@Req() req: Request, @Res() res: Response) {
    // ...
  }
}
```

**File**: `api-gateway/src/main.ts`

Removed the global prefix configuration:
```typescript
// REMOVED:
// app.setGlobalPrefix('api/v1', {
//   exclude: [{ path: 'health', method: RequestMethod.GET }]
// });

// Health endpoints remain at root level (/health, /health/services)
```

### 2. Strip Prefix Before Forwarding

**File**: `api-gateway/src/gateway/services/gateway.service.ts`

Updated `getServiceName()` method:
```typescript
private getServiceName(path: string): string {
  // Strip /api/v1 prefix before route matching
  const cleanPath = path.startsWith('/api/v1') 
    ? path.replace('/api/v1', '') 
    : path;

  for (const [route, service] of Object.entries(routingConfig)) {
    if (cleanPath.startsWith(route)) {
      return service;
    }
  }
  // ...
}
```

Updated `forwardRequest()` method:
```typescript
async forwardRequest(path: string, method: string, body?: any, headers?: any, queryParams?: any) {
  const serviceName = this.getServiceName(path);
  const serviceConfig = servicesConfig[serviceName];

  // Strip /api/v1 prefix before forwarding to microservices
  const cleanPath = path.startsWith('/api/v1') 
    ? path.replace('/api/v1', '') 
    : path;

  const targetUrl = `${serviceConfig.url}${cleanPath}`;
  // Now forwards to: http://auth-service:3001/auth/signup ✅
  // ...
}
```

### 3. Updated Public Routes Configuration

**File**: `api-gateway/src/gateway/config/services.config.ts`

Added health endpoints without prefix (since they're excluded):
```typescript
export const publicRoutes = [
  "/api/v1/auth/signup",
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/password-reset/request",
  "/api/v1/auth/password-reset/confirm",
  "/api/v1/health",
  "/api/v1/health/services",
  // Health endpoints are excluded from global prefix
  "/health",
  "/health/services",
];
```

## Testing

### Public Endpoints (No Auth Required)

✅  **Health Check**:
```bash
curl http://localhost:3500/health
# Response: {"status":"healthy"...}
```

✅ **Signup**:
```bash
curl -X POST http://localhost:3500/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!","role":"customer"}'
# Response: {"accessToken":"...","refreshToken":"...","user":{...}}
```

✅ **Login**:
```bash
curl -X POST http://localhost:3500/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
# Response: {"accessToken":"...","refreshToken":"...","user":{...}}
```

### Protected Endpoints (Require JWT)

```bash
curl http://localhost:3500/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## API Versioning Strategy

All user-facing API endpoints are now prefixed with `/api/v1`:
- ✅ `/api/v1/auth/*` - Authentication
- ✅ `/api/v1/users/*` - User management
- ✅ `/api/v1/requests/*` - Service requests
- ✅ `/api/v1/proposals/*` - Proposals
- ✅ `/api/v1/jobs/*` - Jobs
- ✅ `/api/v1/payments/*` - Payments
- ✅ `/api/v1/messages/*` - Messaging
- ✅ `/api/v1/notifications/*` - Notifications
- ✅ `/api/v1/reviews/*` - Reviews
- ✅ `/api/v1/admin/*` - Admin

Health/monitoring endpoints remain at root level:
- ✅ `/health` - Gateway health check
- ✅ `/health/services` - All services health check

## Files Modified

1. `api-gateway/src/main.ts` - Removed global prefix
2. `api-gateway/src/gateway/controllers/gateway.controller.ts` - Added controller-level prefix
3. `api-gateway/src/gateway/services/gateway.service.ts` - Added prefix stripping logic
4. `api-gateway/src/gateway/config/services.config.ts` - Updated public routes

## Deployment

```bash
# Rebuild API Gateway
docker compose build api-gateway

# Restart API Gateway
docker compose up -d api-gateway

# Verify all services are running
docker compose ps
```

## Success Metrics

- ✅ All 14 services running
- ✅ API Gateway routing working correctly
- ✅ Health endpoints accessible
- ✅ Authentication endpoints working (signup, login)
- ✅ JWT tokens being generated correctly
- ✅ Request forwarding to correct microservices

## Future Considerations

For API v2, simply:
1. Create `@Controller('api/v2')` in a new module
2. Keep existing v1 controller for backward compatibility
3. Update routing config to handle both versions
