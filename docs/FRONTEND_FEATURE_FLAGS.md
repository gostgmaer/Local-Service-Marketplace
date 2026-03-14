# Frontend Feature Flags Implementation

## Overview

This document explains the frontend feature flag system implemented to align with backend service availability. When backend services are disabled (like notifications, messaging, email, SMS), the frontend automatically hides related UI elements and prevents API calls that would result in 500 errors.

## Implementation Date

March 14, 2026

## Problem Statement

The backend has certain services that can be disabled via environment variables (e.g., `EMAIL_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`). When these services are disabled, the frontend was still attempting to:
1. Display UI elements for those features (notification bell, messages link)
2. Make API calls to disabled endpoints (`/notifications/unread-count`, `/requests/my`, `/jobs/my`)
3. This resulted in 500 errors and poor user experience

## Solution

Implemented a centralized feature flag system that reads from Next.js environment variables and conditionally:
- Renders/hides UI components
- Enables/disables API calls
- Redirects from disabled feature pages

---

## Configuration Files

### 1. Environment Variables (`.env.local`)

```env
# Feature Flags
NEXT_PUBLIC_NOTIFICATIONS_ENABLED=false
NEXT_PUBLIC_EMAIL_ENABLED=false
NEXT_PUBLIC_SMS_ENABLED=false
NEXT_PUBLIC_IN_APP_NOTIFICATIONS_ENABLED=false
NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=false
NEXT_PUBLIC_MESSAGING_ENABLED=false
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

**Important**: These environment variables MUST start with `NEXT_PUBLIC_` to be accessible in browser-side code.

### 2. Feature Configuration (`config/features.ts`)

Central configuration file that exports:
- `featureFlags` object with typed feature configurations
- Helper functions: `isNotificationsEnabled()`, `isMessagingEnabled()`, `isAnalyticsEnabled()`

```typescript
export const featureFlags = {
  notifications: {
    enabled: process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED === 'true',
    // ... other notification settings
  },
  messaging: {
    enabled: process.env.NEXT_PUBLIC_MESSAGING_ENABLED === 'true',
  },
  analytics: {
    enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true',
  },
};
```

---

## Modified Components

### 1. Navbar (`components/layout/Navbar.tsx`)

**Changes:**
- Import `isNotificationsEnabled`, `isMessagingEnabled` from feature config
- Conditionally render notification bell (desktop & mobile)
- Conditionally render Messages link (desktop & mobile)

**Before:**
```tsx
<Link href="/notifications">
  <Bell />
  {unreadCount > 0 && <span>{unreadCount}</span>}
</Link>
<Link href="/messages">Messages</Link>
```

**After:**
```tsx
{isNotificationsEnabled() && (
  <Link href="/notifications">
    <Bell />
    {unreadCount > 0 && <span>{unreadCount}</span>}
  </Link>
)}
{isMessagingEnabled() && (
  <Link href="/messages">Messages</Link>
)}
```

**Result:** Notification bell and Messages link completely hidden when features disabled.

---

### 2. Dashboard (`app/dashboard/page.tsx`)

**Changes:**
- Import `isNotificationsEnabled`
- Conditionally enable notifications query
- Conditionally render notifications stats card
- Adjust grid layout (3 cols → 2 cols when notifications disabled)

**Before:**
```tsx
const { data: notifications } = useQuery({
  queryKey: ['notifications'],
  queryFn: () => notificationService.getNotifications({ limit: 5 }),
  enabled: isAuthenticated,
});
```

**After:**
```tsx
const { data: notifications } = useQuery({
  queryKey: ['notifications'],
  queryFn: () => notificationService.getNotifications({ limit: 5 }),
  enabled: isAuthenticated && isNotificationsEnabled(),
});
```

**Result:** No API calls to notification service when disabled; notifications card hidden.

---

### 3. Notifications Page (`app/notifications/page.tsx`)

**Changes:**
- Import `isNotificationsEnabled` and `useRouter`
- Redirect to dashboard if notifications disabled
- Conditionally enable query

**Before:**
```tsx
export default function NotificationsPage() {
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications({ limit: 50 }),
  });
  // ...
}
```

**After:**
```tsx
export default function NotificationsPage() {
  const router = useRouter();
  
  useEffect(() => {
    if (!isNotificationsEnabled()) {
      router.push('/dashboard');
    }
  }, [router]);
  
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications({ limit: 50 }),
    enabled: isNotificationsEnabled(),
  });
  // ...
}
```

**Result:** Users cannot access `/notifications` page when feature disabled.

---

### 4. Messages Page (`app/messages/page.tsx`)

**Changes:**
- Import `isMessagingEnabled` and `useRouter`
- Redirect to dashboard if messaging disabled
- Conditionally enable queries

**Before:**
```tsx
const { data: conversations } = useQuery({
  queryKey: ['conversations'],
  queryFn: () => messageService.getConversations(),
});
```

**After:**
```tsx
useEffect(() => {
  if (!isMessagingEnabled()) {
    router.push('/dashboard');
  }
}, [router]);

const { data: conversations } = useQuery({
  queryKey: ['conversations'],
  queryFn: () => messageService.getConversations(),
  enabled: isMessagingEnabled(),
});
```

**Result:** Users cannot access `/messages` page when feature disabled.

---

### 5. Notification Hook (`hooks/useNotifications.ts`)

**Changes:**
- Import `isNotificationsEnabled`
- Only fetch unread count when notifications enabled

**Before:**
```tsx
const fetchUnreadCount = useCallback(async () => {
  if (!enabled) {
    setUnreadCount(0);
    return;
  }
  // ... fetch logic
}, [enabled]);
```

**After:**
```tsx
const fetchUnreadCount = useCallback(async () => {
  const notificationsEnabled = isNotificationsEnabled();
  if (!enabled || !notificationsEnabled) {
    setUnreadCount(0);
    return;
  }
  // ... fetch logic
}, [enabled]);
```

**Result:** No polling or API calls when notifications disabled.

---

## Feature Flag Reference

| Environment Variable | Feature Controlled | UI Impact |
|---------------------|-------------------|-----------|
| `NEXT_PUBLIC_NOTIFICATIONS_ENABLED` | In-app notifications | Hides notification bell, disables unread count polling, blocks `/notifications` page |
| `NEXT_PUBLIC_MESSAGING_ENABLED` | Direct messaging | Hides "Messages" link, blocks `/messages` page |
| `NEXT_PUBLIC_EMAIL_ENABLED` | Email notifications | Controls email-based notification delivery |
| `NEXT_PUBLIC_SMS_ENABLED` | SMS notifications | Controls SMS-based notification delivery |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | User analytics tracking | Disables analytics collection |

---

## How to Enable/Disable Features

### Development Environment

1. Edit `frontend/nextjs-app/.env.local`
2. Set feature flag to `true` or `false`:
   ```env
   NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true  # Enable
   NEXT_PUBLIC_MESSAGING_ENABLED=false     # Disable
   ```
3. Restart Next.js dev server:
   ```powershell
   cd frontend/nextjs-app
   pnpm dev
   ```

### Production Environment

1. Set environment variables in your hosting platform (Vercel, AWS, etc.)
2. Ensure variables start with `NEXT_PUBLIC_` prefix
3. Redeploy application

### Docker Environment

1. Edit root `.env` file (used by docker-compose)
2. Ensure frontend service passes these variables:
   ```yaml
   environment:
     - NEXT_PUBLIC_NOTIFICATIONS_ENABLED=${NOTIFICATIONS_ENABLED}
     - NEXT_PUBLIC_MESSAGING_ENABLED=${MESSAGING_ENABLED}
   ```

---

## Testing

### Test Feature Flags are Working

1. **Disable Notifications:**
   ```env
   NEXT_PUBLIC_NOTIFICATIONS_ENABLED=false
   ```
   - ✅ No notification bell in navbar
   - ✅ No notification card in dashboard
   - ✅ `/notifications` redirects to `/dashboard`
   - ✅ No API calls to `/notifications/*`

2. **Disable Messaging:**
   ```env
   NEXT_PUBLIC_MESSAGING_ENABLED=false
   ```
   - ✅ No "Messages" link in navbar
   - ✅ `/messages` redirects to `/dashboard`
   - ✅ No API calls to `/messages/*`

3. **Enable All Features:**
   ```env
   NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true
   NEXT_PUBLIC_MESSAGING_ENABLED=true
   ```
   - ✅ All UI elements visible
   - ✅ All pages accessible
   - ✅ API calls work normally

---

## Backend Synchronization

The frontend feature flags should match backend service availability:

| Backend Service | Backend Env Var | Frontend Env Var |
|----------------|-----------------|------------------|
| notification-service | `NOTIFICATIONS_ENABLED` | `NEXT_PUBLIC_NOTIFICATIONS_ENABLED` |
| messaging-service | `MESSAGING_ENABLED` | `NEXT_PUBLIC_MESSAGING_ENABLED` |
| email-service | `EMAIL_ENABLED` | `NEXT_PUBLIC_EMAIL_ENABLED` |
| sms-service | `SMS_ENABLED` | `NEXT_PUBLIC_SMS_ENABLED` |
| analytics-service | `ANALYTICS_ENABLED` | `NEXT_PUBLIC_ANALYTICS_ENABLED` |

**Important:** Keep these synchronized to prevent 500 errors and provide consistent UX.

---

## Error Prevention

### Before Implementation
- Frontend called `/notifications/unread-count` → **500 Error** (service disabled)
- Frontend called `/requests/my` → **500 Error** (tried to fetch notification data)
- Frontend displayed notification bell → Clicking showed errors

### After Implementation
- Frontend checks `isNotificationsEnabled()` → Returns `false`
- No API calls made to disabled services
- UI elements hidden, preventing user confusion
- No 500 errors in console or user experience

---

## Common Issues & Solutions

### Issue: Feature flag changes not reflecting

**Solution:**
1. Clear Next.js cache: `rm -rf .next`
2. Restart dev server: `pnpm dev`
3. Hard refresh browser: `Ctrl+Shift+R`

### Issue: Environment variable undefined in browser

**Solution:**
- Ensure variable starts with `NEXT_PUBLIC_` prefix
- Restart dev server after adding new variables
- Check browser console: `console.log(process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED)`

### Issue: 500 errors still occurring

**Solution:**
1. Verify backend `.env` matches frontend `.env.local`
2. Check API Gateway is forwarding correct headers
3. Ensure backend services respect their own feature flags

---

## Future Enhancements

### Planned Improvements

1. **Admin Panel for Feature Flags:**
   - Toggle features without redeployment
   - Per-user or per-tenant feature flags
   - A/B testing capabilities

2. **Runtime Feature Flag Updates:**
   - Fetch feature flags from API on app load
   - Update flags without restart

3. **Feature Flag Analytics:**
   - Track which features are used most
   - Measure impact of enabling/disabling features

4. **Gradual Rollouts:**
   - Enable features for percentage of users
   - Canary deployments

---

## Developer Guidelines

### When Adding New Features

1. **Add environment variable:**
   ```env
   NEXT_PUBLIC_MY_FEATURE_ENABLED=false
   ```

2. **Update `config/features.ts`:**
   ```typescript
   export const featureFlags = {
     // ... existing flags
     myFeature: {
       enabled: process.env.NEXT_PUBLIC_MY_FEATURE_ENABLED === 'true',
     },
   };
   
   export const isMyFeatureEnabled = () => featureFlags.myFeature.enabled;
   ```

3. **Conditionally render UI:**
   ```tsx
   import { isMyFeatureEnabled } from '@/config/features';
   
   {isMyFeatureEnabled() && (
     <MyFeatureComponent />
   )}
   ```

4. **Conditionally enable queries:**
   ```tsx
   const { data } = useQuery({
     queryKey: ['my-feature-data'],
     queryFn: () => api.getMyFeatureData(),
     enabled: isMyFeatureEnabled(),
   });
   ```

5. **Document in this file!**

---

## Related Documentation

- [API Specification](./API_SPECIFICATION.md)
- [Backend Implementation Complete](./BACKEND_IMPLEMENTATION_COMPLETE.md)
- [Environment Variables Audit](./ENVIRONMENT_VARIABLES_AUDIT_REPORT.md)
- [Architecture Overview](./ARCHITECTURE.md)

---

## Changelog

### March 14, 2026
- ✅ Created `config/features.ts` with centralized feature flag configuration
- ✅ Added 7 feature flag environment variables to `.env.local`
- ✅ Updated Navbar to conditionally show notifications & messaging
- ✅ Updated Dashboard to conditionally fetch & display notifications
- ✅ Updated Notifications page with redirect when disabled
- ✅ Updated Messages page with redirect when disabled
- ✅ Updated useNotifications hook to respect feature flags
- ✅ Fixed all TypeScript compilation errors
- ✅ Verified no 500 errors from disabled services

---

## Summary

The frontend feature flag system provides:
- ✅ **No 500 Errors** - Prevents calls to disabled backend services
- ✅ **Better UX** - Hides unavailable features instead of showing errors
- ✅ **Configuration Flexibility** - Easy to enable/disable features per environment
- ✅ **Backend Alignment** - Frontend respects backend service availability
- ✅ **Type Safety** - TypeScript ensures correct usage
- ✅ **Scalability** - Easy to add new features with flag support

**Status:** ✅ Complete and Production Ready
