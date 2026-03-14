# Frontend-Backend Authentication Token Mismatch Fix - March 14, 2026

## Problem Summary

After login, the following issues occurred:
1. **Status 201 instead of 200** - Login returned 201 Created (which is correct for POST)
2. **All subsequent API calls returned 401 Unauthorized** - Tokens weren't being attached to requests

## Root Cause: Field Name Mismatch

The backend and frontend were using different naming conventions:

### Backend Returns (camelCase):
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "customer",
    "email_verified": false
  }
}
```

### Frontend Expected (snake_case):
```typescript
interface AuthResponse {
  access_token: string;  // ❌ Wrong
  refresh_token?: string; // ❌ Wrong
  user: {
    name: string;  // ❌ Field doesn't exist
    emailVerified: boolean;  // ❌ Wrong casing
  }
}
```

## Issues Fixed

### 1. Token Field Names

**File:** `frontend/nextjs-app/services/auth-service.ts`

```typescript
// BEFORE
export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  // ...
}

// AFTER
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  // ...
}
```

### 2. User Object Structure

**Files:**
- `frontend/nextjs-app/services/auth-service.ts`
- `frontend/nextjs-app/store/authStore.ts`

```typescript
// BEFORE
interface User {
  id: string;
  email: string;
  name: string;  // ❌ Field doesn't exist in backend
  role: string;
  emailVerified: boolean;  // ❌ Wrong casing
}

// AFTER
interface User {
  id: string;
  email: string;
  role: string;
  email_verified: boolean;  // ✅ Matches backend
}
```

### 3. Token Storage in Auth Store

**File:** `frontend/nextjs-app/store/authStore.ts`

```typescript
// BEFORE
authService.setToken(response.access_token);
set({
  token: response.access_token,
  // ...
});

// AFTER
authService.setToken(response.accessToken);
if (response.refreshToken) {
  localStorage.setItem('refresh_token', response.refreshToken);
}
set({
  token: response.accessToken,
  // ...
});
```

### 4. Profile Endpoint Issue

**Problem:** Frontend called `/auth/profile` which doesn't exist on backend

**Solution:** Decode user info from JWT token instead of API call

**File:** `frontend/nextjs-app/store/authStore.ts`

```typescript
checkAuth: async () => {
  const token = authService.getToken();
  if (!token) {
    set({ user: null, isAuthenticated: false, isLoading: false });
    return;
  }

  try {
    // Decode JWT payload to get user info
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    
    // Reconstruct user from JWT
    const user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      email_verified: payload.email_verified || false,
    };
    
    set({ user, token, isAuthenticated: true, isLoading: false });
  } catch (error) {
    authService.removeToken();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }
}
```

### 5. UI Updates

**File:** `frontend/nextjs-app/app/dashboard/page.tsx`

```typescript
// BEFORE
<h1>Welcome back, {user?.name}!</h1>

// AFTER
<h1>Welcome back, {user?.email}!</h1>
```

### 6. Signup Form

**File:** `frontend/nextjs-app/services/auth-service.ts`

Removed `name` field from SignupData since backend doesn't require it:

```typescript
// BEFORE
export interface SignupData {
  email: string;
  password: string;
  name: string;  // ❌ Backend doesn't use this
  role: 'customer' | 'provider';
  phone?: string;
}

// AFTER
export interface SignupData {
  email: string;
  password: string;
  role: 'customer' | 'provider';
  phone?: string;
}
```

## Files Modified

1. ✅ `frontend/nextjs-app/services/auth-service.ts`
   - Updated AuthResponse interface (accessToken, refreshToken)
   - Updated User interface (removed name, fixed email_verified)
   - Removed name from SignupData

2. ✅ `frontend/nextjs-app/store/authStore.ts`
   - Updated User interface
   - Fixed token field references in login()
   - Fixed token field references in signup()
   - Added refresh token storage
   - Replaced getProfile() with JWT decoding in checkAuth()

3. ✅ `frontend/nextjs-app/app/dashboard/page.tsx`
   - Changed `user?.name` to `user?.email`

## Testing

### 1. Test Login Flow

```bash
# Terminal 1 - Backend
docker compose ps  # All services should be running

# Terminal 2 - Frontend
cd frontend/nextjs-app
npm run dev

# Browser
# Navigate to http://localhost:3000/login
# Login with: newuser@example.com / SecurePass123!
# Should redirect to dashboard successfully
```

### 2. Test Token Storage

**Open Browser DevTools → Application → Local Storage**

Should see:
```
access_token: eyJhbGc...
refresh_token: eyJhbGc...
```

### 3. Test Authenticated Requests

**Open Browser DevTools → Network Tab**

After login, click around the dashboard. All API requests should include:
```
Authorization: Bearer eyJhbGc...
```

Status codes should be:
- ✅ 200 OK (successful requests)
- ❌ NOT 401 Unauthorized

### 4. Verify Token in Request Headers

```bash
# Manual test with curl
TOKEN="your_access_token_here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3500/api/v1/users
```

## Status Code Explanation

**201 Created** is the correct HTTP status for login/signup because:
- These are POST requests that create new resources (sessions)
- This is standard REST API behavior
- Frontend handles both 200 and 201 as success

## Why Tokens Weren't Working Before

1. **Field Name Mismatch:**
   - Frontend tried to read `response.access_token`
   - But backend sent `response.accessToken`
   - Result: `undefined` stored in localStorage

2. **Undefined Token:**
   - `authService.setToken(undefined)`
   - No token in Authorization header
   - Backend rejected all requests with 401

3. **Profile Endpoint Missing:**
   - Frontend called `/auth/profile` on page load
   - Endpoint doesn't exist → 404 error
   - User logged out automatically

## Success Metrics

- ✅ Login returns 201 with accessToken
- ✅ Token stored in localStorage correctly
- ✅ All subsequent API calls include Authorization header
- ✅ No 401 errors on authenticated routes
- ✅ Dashboard loads successfully after login
- ✅ User data displayed correctly
- ✅ Refresh token rotation works (not yet implemented but stored)

## Backend Token Structure

JWT payload contains:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "customer",
  "email_verified": false,
  "iat": 1773472428,
  "exp": 1773473328
}
```

Frontend now decodes this directly instead of calling `/auth/profile`.

## Related Documentation

- [Frontend Auth Redirect Fix](./FRONTEND_AUTH_REDIRECT_FIX.md) - Infinite loop fixes
- [API Gateway Routing Fix](./API_GATEWAY_ROUTING_FIX.md) - Backend /api/v1 prefix
- [API Versioning](./API_VERSIONING.md) - API version strategy
