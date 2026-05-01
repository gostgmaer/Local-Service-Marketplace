# API Specification

**Local Service Marketplace Platform**
**Last Updated:** May 2026
**Base URL:** `http://localhost:3700/api/v1` (development) · `/api/v1` (production via reverse proxy)

All requests and responses use **JSON** (`Content-Type: application/json`).
Authenticated endpoints require `Authorization: Bearer <access_token>`.

---

## General Conventions

### Response envelope

```json
{
  "success": true,
  "data": { ... },
  "message": "optional human-readable message"
}
```

Error responses:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["email must be a valid email"]
}
```

### Pagination (cursor-based)

All list endpoints accept:

| Query param | Default | Description |
|-------------|---------|-------------|
| `limit` | 20 | Items per page (max 100) |
| `cursor` | — | Opaque cursor from previous response |

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6Ijc4..."}",
    "hasMore": true,
    "total": 142
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request / Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden (wrong role or ownership) |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Internal server error |

---

## 1. Authentication (`/user/auth`)

### Register

`POST /user/auth/register`

```json
{
  "email": "alice@example.com",
  "password": "S3cur3P@ssw0rd",
  "firstName": "Alice",
  "lastName": "Smith",
  "role": "customer"
}
```

Returns `201` with `{ data: { user, accessToken, refreshToken } }`.

---

### Login

`POST /user/auth/login`

```json
{ "email": "alice@example.com", "password": "S3cur3P@ssw0rd" }
```

Returns `{ accessToken, refreshToken, user }`.
If 2FA is enabled, returns `{ requiresTwoFactor: true, tempToken }` instead.

---

### 2FA Login

`POST /user/auth/2fa/login`

```json
{ "tempToken": "...", "code": "123456" }
```

Returns full `{ accessToken, refreshToken, user }`.

---

### Refresh Token

`POST /user/auth/refresh`

```json
{ "refreshToken": "..." }
```

Returns new `{ accessToken }`.

---

### Logout

`POST /user/auth/logout` — _JWT required_

Revokes the current access token in Redis and invalidates the refresh token.

---

### Logout All Devices

`POST /user/auth/revoke-all-tokens` — _JWT required_

---

### Password Reset (Request)

`POST /user/auth/password-reset/request`

```json
{ "email": "alice@example.com" }
```

Triggers an email with a time-limited link. Always returns `200` (no email enumeration).

---

### Password Reset (Confirm)

`POST /user/auth/password-reset/confirm`

```json
{ "token": "...", "password": "NewP@ssw0rd!" }
```

---

### Google OAuth

`GET /user/auth/google` — Redirects to Google.
`GET /user/auth/google/callback` — Handled server-side, issues JWT.

### Facebook OAuth

`GET /user/auth/facebook` → `GET /user/auth/facebook/callback`

### Apple Sign In

`GET /user/auth/apple` → `GET /user/auth/apple/callback`
`POST /user/auth/apple/mobile` — Mobile SDK token exchange.

---

### Magic Link

`POST /user/auth/magic-link/request`

```json
{ "email": "alice@example.com" }
```

`GET /user/auth/magic-link/verify?token=...` — Returns JWT pair.

---

### OTP (SMS)

```
POST /user/auth/phone/otp/request  → { "phone": "+1234567890" }
POST /user/auth/phone/otp/verify   → { "phone": "+1234567890", "otp": "6-digit code" }
```

### OTP (Email)

```
POST /user/auth/email/otp/request  → { "email": "alice@example.com" }
POST /user/auth/email/otp/verify   → { "email": "alice@example.com", "otp": "6-digit code" }
```

---

### 2FA Management

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /user/auth/2fa/status` | JWT | Is 2FA enabled? |
| `POST /user/auth/2fa/enable` | JWT | Enable TOTP |
| `GET /user/auth/2fa/qr-code` | JWT | SVG QR code for authenticator app |
| `POST /user/auth/2fa/verify` | JWT | Confirm TOTP code to activate |
| `POST /user/auth/2fa/disable` | JWT | Disable 2FA |
| `POST /user/auth/2fa/backup-codes/generate` | JWT | Generate one-time backup codes |
| `POST /user/auth/2fa/backup-codes/verify` | JWT | Use backup code as login factor |

---

### Sessions & Devices

```
GET    /user/auth/sessions        — list active sessions
DELETE /user/auth/sessions/:id    — revoke session
DELETE /user/auth/sessions/all    — revoke all
GET    /user/auth/devices         — trusted device list
DELETE /user/auth/devices/:id     — untrust device
GET    /user/auth/login-history   — paginated login log
```

---

## 2. Users (`/users`)

All endpoints require Admin role unless noted.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | Admin | List all users (paginated) |
| GET | `/users/:id` | Admin | User detail |
| PATCH | `/users/:id` | Admin | Edit user |
| DELETE | `/users/:id` | Admin | Soft-delete user |
| GET | `/users/me` | JWT | Own profile |
| PATCH | `/users/me` | JWT | Update own profile |

**PATCH `/users/me` body:**
```json
{
  "firstName": "Alice",
  "lastName": "Smith",
  "phone": "+1234567890",
  "bio": "...",
  "profilePhoto": "https://..."
}
```

---

## 3. Providers (`/providers`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/providers` | JWT | Create provider profile |
| GET | `/providers` | Public | Browse providers (paginated, filterable) |
| GET | `/providers/:id` | Public | Provider public profile |
| PATCH | `/providers/:id` | JWT (owner) | Update profile |
| DELETE | `/providers/:id` | JWT (owner/admin) | Delete provider |
| GET | `/providers/:id/services` | Public | Services offered |
| PUT | `/providers/:id/services` | JWT (owner) | Replace service list |
| GET | `/providers/:id/availability` | Public | Availability slots |
| PUT | `/providers/:id/availability` | JWT (owner) | Update availability |

**GET `/providers` query params:** `categoryId`, `city`, `minRating`, `verified`, `limit`, `cursor`

---

## 4. Service Requests (`/requests`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/requests` | JWT (customer) | Create request |
| GET | `/requests` | Public | Browse requests (paginated) |
| GET | `/requests/search` | Public | Full-text search |
| GET | `/requests/my` | JWT | My requests |
| GET | `/requests/stats` | JWT | Request stats |
| GET | `/requests/:id` | Public | Request detail |
| PATCH | `/requests/:id` | JWT (owner) | Update request |
| DELETE | `/requests/:id` | JWT (owner) | Delete request |
| POST | `/requests/:id/accept-proposal/:proposalId` | JWT (customer) | Accept proposal → creates job |

**POST `/requests` body:**
```json
{
  "title": "Need a plumber",
  "description": "Leaking pipe under kitchen sink",
  "categoryId": "uuid",
  "budget": 150,
  "currency": "USD",
  "location": { "city": "Austin", "state": "TX", "lat": 30.27, "lng": -97.74 },
  "deadline": "2026-06-15T00:00:00Z"
}
```

---

## 5. Categories (`/categories`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | Public | All active categories |
| POST | `/categories` | Admin | Create |
| PATCH | `/categories/:id` | Admin | Update |
| DELETE | `/categories/:id` | Admin | Soft-delete (sets `active=false`) |

---

## 6. Proposals (`/proposals`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/proposals` | JWT (provider) | Submit proposal |
| GET | `/proposals/my` | JWT (provider) | My proposals |
| GET | `/proposals/request/:requestId` | JWT | Proposals on a request |
| GET | `/proposals/:id` | JWT | Proposal detail |
| PATCH | `/proposals/:id` | JWT (owner) | Update proposal |
| DELETE | `/proposals/:id` | JWT (owner) | Delete proposal |

**POST `/proposals` body:**
```json
{
  "requestId": "uuid",
  "price": 120,
  "currency": "USD",
  "message": "I can fix this in 2 hours. Available tomorrow.",
  "estimatedHours": 2,
  "availableDate": "2026-06-10"
}
```

---

## 7. Jobs (`/jobs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/jobs/my` | JWT | My jobs |
| GET | `/jobs/:id` | JWT | Job detail |
| PATCH | `/jobs/:id/start` | JWT (provider) | Start job |
| PATCH | `/jobs/:id/complete` | JWT (provider) | Mark complete |
| PATCH | `/jobs/:id/confirm` | JWT (customer) | Confirm completion |
| PATCH | `/jobs/:id/cancel` | JWT | Cancel |

**Job lifecycle:** `created` → `started` → `completed` → `confirmed` (or `cancelled` at any stage)

---

## 8. Reviews (`/reviews`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/reviews` | JWT (customer) | Submit review after job |
| GET | `/reviews/my` | JWT | My reviews |
| GET | `/reviews/:id` | Public | Review detail |
| GET | `/reviews/jobs/:jobId/review` | JWT | Review for a specific job |
| GET | `/reviews/provider/:providerId` | Public | All reviews for provider |
| GET | `/reviews/provider/:providerId/rating` | Public | Aggregate rating |
| POST | `/reviews/:id/respond` | JWT (provider) | Provider response |
| POST | `/reviews/:id/helpful` | JWT | Mark helpful |
| PATCH | `/reviews/:id` | JWT (owner, 30-day) | Edit review |
| DELETE | `/reviews/:id` | JWT (owner/admin) | Delete |

**POST `/reviews` body:**
```json
{
  "jobId": "uuid",
  "rating": 5,
  "comment": "Excellent work, very professional!",
  "tags": ["punctual", "clean"]
}
```

---

## 9. Review Aggregates (`/review-aggregates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/review-aggregates/provider/:id` | Public | Stats summary |
| GET | `/review-aggregates/provider/:id/distribution` | Public | 1–5 star breakdown |
| GET | `/review-aggregates/provider/:id/trust-badge` | Public | Badge level |
| GET | `/review-aggregates/top-rated` | Public | Top-rated providers |
| GET | `/review-aggregates/by-rating` | Public | Sort by rating |

---

## 10. Payments (`/payments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments` | JWT | Initiate payment |
| GET | `/payments/my` | JWT | My payment history |
| GET | `/payments/:id` | JWT | Payment detail |
| POST | `/payments/:id/capture` | JWT | Capture pre-authorised payment |
| POST | `/payments/:id/cancel` | JWT | Cancel payment |

**POST `/payments` body:**
```json
{
  "jobId": "uuid",
  "amount": 120,
  "currency": "USD",
  "gateway": "stripe",
  "paymentMethodId": "pm_uuid_optional"
}
```

---

## 11. Refunds (`/refunds`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/refunds/:paymentId` | JWT | Request refund |
| GET | `/refunds/:id` | JWT | Refund detail |
| GET | `/refunds/payment/:paymentId` | JWT | All refunds for a payment |

---

## 12. Subscriptions (`/subscriptions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/subscriptions` | JWT (provider) | Subscribe to a plan |
| POST | `/subscriptions/:id/activate` | JWT | Activate |
| GET | `/subscriptions/provider/:providerId` | JWT | Provider's subscriptions |
| GET | `/subscriptions/provider/:providerId/active` | JWT | Active subscription |
| POST | `/subscriptions/provider/:providerId/upgrade` | JWT | Upgrade plan |
| GET | `/subscriptions/provider/:providerId/status` | JWT | Current status |

---

## 13. Pricing Plans (`/pricing-plans`)

`GET /pricing-plans` — Public. Returns all active plans.
`GET /pricing-plans/active` — Public. Active plans only.

---

## 14. Payment Methods (`/payment-methods`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payment-methods` | JWT | Save a method |
| GET | `/payment-methods` | JWT | My saved methods |
| GET | `/payment-methods/default` | JWT | Default method |
| GET | `/payment-methods/expiring` | JWT | Expiring cards |
| DELETE | `/payment-methods/:id` | JWT | Remove method |

---

## 15. Coupons (`/coupons`)

`POST /coupons` · `GET /coupons` · `PATCH /coupons/:id` · `DELETE /coupons/:id` — Admin.
`POST /coupons/validate` — JWT. Validate a coupon code.
`POST /coupons/redeem` — JWT. Redeem against a payment.

---

## 16. Webhooks (`/webhooks`)

`POST /webhooks/:gateway` — Public (gateway verified by HMAC signature)

Supported gateways: `stripe`, `razorpay`, `paypal`, `mock`

---

## 17. Notifications (`/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | JWT | My notifications (paginated) |
| GET | `/notifications/unread-count` | JWT | Count of unread |
| POST | `/notifications/:id/read` | JWT | Mark as read |
| POST | `/notifications/read-all` | JWT | Mark all read |
| DELETE | `/notifications/:id` | JWT | Delete |
| GET | `/notifications/preferences` | JWT | Notification preferences |
| PATCH | `/notifications/preferences` | JWT | Update preferences |
| POST | `/notifications/devices` | JWT | Register push token |
| DELETE | `/notifications/devices/:id` | JWT | Remove device token |

---

## 18. Messages (`/messages`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/messages` | JWT | Send message |
| GET | `/messages/conversations` | JWT | Conversation list |
| GET | `/messages/conversation/:userId` | JWT | Thread (paginated) |
| PATCH | `/messages/:id` | JWT (owner, 15-min) | Edit message |
| DELETE | `/messages/:id` | JWT (owner) | Delete message |

**POST `/messages` body:**
```json
{
  "recipientId": "uuid",
  "content": "Hello, are you available tomorrow?",
  "jobId": "uuid_optional"
}
```

---

## 19. Disputes (`/disputes`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/disputes` | JWT | File a dispute |
| GET | `/disputes/my` | JWT | My disputes |
| GET | `/disputes/:id` | JWT | Dispute detail |
| PATCH | `/disputes/:id/resolve` | Admin | Resolve |
| PATCH | `/disputes/:id/close` | Admin | Close |

**POST `/disputes` body:**
```json
{
  "jobId": "uuid",
  "reason": "Provider did not complete the work as agreed",
  "description": "The sink is still leaking and the provider is unreachable."
}
```

---

## 20. Admin (`/admin`)

All endpoints require Admin role.

| Endpoint | Description |
|----------|-------------|
| `GET /admin/users` | All users (paginated) |
| `GET /admin/users/:id` | User detail |
| `PATCH /admin/users/:id` | Edit user |
| `POST /admin/users/:id/ban` | Ban user |
| `POST /admin/users/:id/unban` | Unban user |
| `DELETE /admin/users/:id` | Delete user |
| `GET /admin/audit-logs` | Audit trail (paginated) |
| `GET /admin/system-settings` | Platform settings |
| `PATCH /admin/system-settings` | Update settings |

---

## 21. Analytics (`/analytics`)

All require Admin role.

| Endpoint | Description |
|----------|-------------|
| `GET /analytics/overview` | KPI dashboard |
| `GET /analytics/users` | User growth |
| `GET /analytics/requests` | Request volume |
| `GET /analytics/revenue` | Revenue metrics |
| `GET /analytics/daily` | Daily time series |

---

## 22. Feature Flags (`/feature-flags`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/feature-flags` | Admin | All flags |
| GET | `/feature-flags/:key` | Service (internal) | Get flag value |
| POST | `/feature-flags` | Admin | Create flag |
| PATCH | `/feature-flags/:key` | Admin | Toggle flag |
| DELETE | `/feature-flags/:key` | Admin | Delete flag |

---

## 23. Roles & Permissions (`/roles`, `/permissions`)

```
GET    /roles               — list all roles
POST   /roles               — create role (Admin)
PATCH  /roles/:id           — update role (Admin)
GET    /permissions         — list all permissions
POST   /identity/assign-role — assign role to user (Admin)
POST   /identity/revoke-role — revoke role from user (Admin)
```

---

## 24. Real-time (Socket.IO)

Connect to `ws://localhost:3007` (comms-service) with:

```js
const socket = io('http://localhost:3700', {
  auth: { token: '<access_token>' },
  path: '/socket.io'
});
```

**Emittable events (client → server):**

| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{ recipientId, content, jobId? }` | Send chat message |
| `typing:start` | `{ conversationId }` | Start typing indicator |
| `typing:stop` | `{ conversationId }` | Stop typing indicator |
| `notification:read` | `{ notificationId }` | Mark notification read |

**Receivable events (server → client):**

| Event | Payload | Description |
|-------|---------|-------------|
| `message:received` | `{ message }` | New chat message |
| `message:edited` | `{ messageId, content }` | Message edited |
| `message:deleted` | `{ messageId }` | Message deleted |
| `notification:new` | `{ notification }` | In-app notification |
| `job:status-update` | `{ jobId, status }` | Job lifecycle change |
| `user:online` | `{ userId }` | User came online |
| `user:offline` | `{ userId }` | User went offline |
| `typing:indicator` | `{ userId, conversationId, typing }` | Typing state |

