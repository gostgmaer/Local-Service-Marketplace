# Frontend Authentication Redirect Loop Fix - March 14, 2026

## Problem

After logging in, the frontend was stuck in an infinite redirect loop with continuous API calls instead of properly redirecting to the dashboard.

## Root Causes

### 1. **Login/Signup Pages Redirect During Render**

**Files Affected:**
- `app/(auth)/login/page.tsx` (line 67-69)
- `app/(auth)/signup/page.tsx` (line 35-37)

**Issue:**
```typescript
// WRONG - Executes on every render
if (isAuthenticated) {
  router.push('/dashboard');
}
```

This check ran on **every render**, not just when authentication state changed. This caused:
- Redirect triggers on every component update
- React re-renders after state changes
- Creates infinite loop of redirects and re-renders

**Fix:**
```typescript
// CORRECT - Only executes when isAuthenticated changes
useEffect(() => {
  if (isAuthenticated) {
    router.push('/dashboard');
  }
}, [isAuthenticated, router]);
```

### 2. **useAuth Hook Infinite Loop**

**File:** `hooks/useAuth.ts` (lines 18-20)

**Issue:**
```typescript
// WRONG - checkAuth creates new function reference on every store update
useEffect(() => {
  checkAuth();
}, [checkAuth]);
```

The `checkAuth` function from Zustand store is not memoized, so it creates a new function reference every time the store updates. This caused:
- useEffect sees "new" checkAuth function → runs effect
- Effect calls checkAuth() → updates store
- Store update creates new checkAuth reference
- Infinite loop repeats

**Fix:**
```typescript
// CORRECT - Only run once on component mount
useEffect(() => {
  checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Empty dependency array
```

### 3. **Middleware Token Mismatch**

**File:** `middleware.ts`

**Issue:**
```typescript
// WRONG - Middleware tries to read from cookies
const token = request.cookies.get('access_token')?.value;

// But tokens are stored in localStorage (not accessible in middleware)
localStorage.setItem('access_token', token);
```

This created a mismatch:
- Client-side code stores tokens in **localStorage**
- Middleware runs **server-side** (cannot access localStorage)
- Middleware always thinks user is not authenticated
- Redirects to login even when user is logged in

**Fix:**
```typescript
export function middleware(request: NextRequest) {
  // Token-based auth check removed
  // Auth handled client-side in useAuth and page components
  return NextResponse.next();
}
```

**Note:** For production SSR with proper authentication:
- Implement cookie-based token storage
- Set httpOnly cookies from backend
- Middleware can then read cookies securely

### 4. **API URL Missing /api/v1 Prefix**

**File:** `app/(auth)/login/page.tsx`

**Issue:**
Phone login and OAuth URLs were missing the `/api/v1` prefix:
```typescript
// WRONG
await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/phone/login`, data);

// CORRECT
await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/phone/login`, data);
```

**Fixed Endpoints:**
- `/api/v1/auth/phone/login`
- `/api/v1/auth/phone/otp/request`
- `/api/v1/auth/phone/otp/verify`
- `/api/v1/auth/google`
- `/api/v1/auth/facebook`

## Files Modified

1. ✅ `app/(auth)/login/page.tsx`
   - Wrapped redirect in useEffect
   - Added useEffect import
   - Fixed API URLs to include /api/v1 prefix

2. ✅ `app/(auth)/signup/page.tsx`
   - Wrapped redirect in useEffect
   - Added useEffect import

3. ✅ `hooks/useAuth.ts`
   - Fixed checkAuth infinite loop
   - Changed dependency from [checkAuth] to []
   - Exported setToken function

4. ✅ `middleware.ts`
   - Removed server-side token authentication check
   - Added comments explaining why
   - Simplified to passthrough only

## Testing Steps

### 1. Test Login Flow

```bash
# Start frontend
cd frontend/nextjs-app
npm run dev

# Navigate to http://localhost:3000/login
# Enter credentials and login
# Should redirect to /dashboard without loops
```

### 2. Test Already Authenticated

```bash
# While logged in, navigate to http://localhost:3000/login
# Should immediately redirect to /dashboard
# No infinite loops or API call storms
```

### 3. Test Logout and Protected Routes

```bash
# Click logout
# Try to access http://localhost:3000/dashboard
# Should redirect to /login
# After login, should redirect back to /dashboard
```

### 4. Check Browser Console

Open DevTools Console:
- ❌ No infinite useEffect warnings
- ❌ No repeated API calls
- ❌ No "Maximum update depth exceeded" errors
- ✅ Single redirect per auth state change

### 5. Check Network Tab

Open DevTools Network:
- ❌ No repeated /auth/login calls
- ❌ No API call loops
- ✅ Single auth check on page load
- ✅ Clean navigation between pages

## Why This Happened

1. **React Rendering Rules Violation**: Calling side effects (router.push) during render instead of in useEffect
2. **Effect Dependency Misunderstanding**: Including unstable function references in useEffect deps
3. **SSR vs Client-Side Auth**: Mixing server-side middleware with client-side localStorage

## Best Practices Applied

### ✅ DO:
- Use `useEffect` for side effects like navigation
- Include proper dependencies in useEffect
- Use empty array `[]` for "run once on mount" effects
- Add ESLint disable comments when intentionally breaking rules
- Store auth state consistently (all client-side OR all server-side)

### ❌ DON'T:
- Call `router.push()` or other side effects during component render
- Include unstable function references (like Zustand actions) in useEffect deps
- Mix localStorage (client-side) with middleware checks (server-side)
- Redirect on every render without proper guard conditions

## Future Improvements

### For Production:

1. **Cookie-Based Authentication:**
   ```typescript
   // Set httpOnly cookie from backend
   res.cookie('access_token', token, {
     httpOnly: true,
     secure: true,
     sameSite: 'strict',
     maxAge: 15 * 60 * 1000 // 15 minutes
   });
   ```

2. **Server-Side Auth:**
   ```typescript
   // middleware.ts can now access cookies
   export function middleware(request: NextRequest) {
     const token = request.cookies.get('access_token')?.value;
     // Proper server-side auth checks
   }
   ```

3. **Refresh Token Rotation:**
   - Implement automatic token refresh
   - Handle token expiration gracefully
   - Store refresh token in httpOnly cookie

4. **Session Management:**
   - Add session timeout warnings
   - Implement "Remember Me" functionality
   - Handle concurrent logins

## Success Metrics

- ✅ Login redirects to dashboard successfully
- ✅ No infinite redirect loops
- ✅ No excessive API calls
- ✅ Protected routes properly guarded
- ✅ Already-authenticated users skip login page
- ✅ Clean browser console (no errors/warnings)
- ✅ Smooth user experience

## Related Documentation

- [API Gateway Routing Fix](./API_GATEWAY_ROUTING_FIX.md) - Backend /api/v1 prefix implementation
- [API Versioning](./API_VERSIONING.md) - API version strategy
- [Authentication Workflow](./AUTHENTICATION_WORKFLOW.md) - Complete auth flow documentation
