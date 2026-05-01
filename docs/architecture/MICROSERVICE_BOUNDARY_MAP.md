# Microservice Boundary Map

**Last Updated:** May 2026

This document defines **which service owns which database tables, which routes each service exposes, and how services communicate**.

**Core rules:**
1. Each service **owns its tables** — no other service may query them directly
2. Cross-boundary data is fetched **via API call or Kafka event only**
3. **No cross-service database joins** — ever
4. Each service runs with its own `pnpm-lock.yaml` and Docker image

---

# 1. API Gateway (port 3700)

**Not a domain service.** Acts as the single entry point for all external traffic.

**Responsibilities:**
- JWT validation on every authenticated request (`jwt-auth.middleware.ts`)
- Auth-specific rate limiting (`auth-rate-limit.middleware.ts`)
- General rate limiting (express-rate-limit, optional Redis backend at Level 2+)
- Structured request logging (Winston JSON — timestamp, service_name, request_id, user_id, action)
- Multipart/form-data pass-through for file uploads
- Sentry error tracking integration
- Catch-all proxy routing to microservices based on URL prefix

**Route → Microservice mapping (from `services.config.ts`):**

| Prefix | Target Service |
|--------|---------------|
| `/user/auth/*` | identity-service |
| `/users/*` | identity-service |
| `/identity/*` | identity-service (RBAC) |
| `/providers/*` | identity-service |
| `/provider-documents/*` | identity-service |
| `/provider-portfolio/*` | identity-service |
| `/favorites/*` | identity-service |
| `/roles/*` | identity-service |
| `/permissions/*` | identity-service |
| `/requests/*` | marketplace-service |
| `/categories/*` | marketplace-service |
| `/proposals/*` | marketplace-service |
| `/jobs/*` | marketplace-service |
| `/reviews/*` | marketplace-service |
| `/review-aggregates/*` | marketplace-service |
| `/payments/*` | payment-service |
| `/refunds/*` | payment-service |
| `/coupons/*` | payment-service |
| `/payment-methods/*` | payment-service |
| `/subscriptions/*` | payment-service |
| `/pricing-plans/*` | payment-service |
| `/webhooks/*` | payment-service |
| `/notifications/*` | comms-service |
| `/messages/*` | comms-service |
| `/admin/*` | oversight-service |
| `/disputes/*` | oversight-service |
| `/analytics/*` | oversight-service |
| `/feature-flags/*` | infrastructure-service |
| `/background-jobs/*` | infrastructure-service |
| `/rate-limits/*` | infrastructure-service |
| `/events/*` | infrastructure-service |

---

# 2. identity-service (port 3001)

Auth, user profiles, provider management, RBAC, device tracking.

### Tables owned

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, role, bcrypt password hash, status) |
| `sessions` | Refresh token store (device-scoped, revocable) |
| `email_verification_tokens` | One-time email verify links |
| `password_reset_tokens` | Password reset links |
| `login_attempts` | Brute-force tracking per IP/email |
| `social_accounts` | OAuth provider links (Google, Facebook, Apple) |
| `user_devices` | Device fingerprint tracking (enabled at Level 5) |
| `providers` | Provider profile (bio, rating, verification status) |
| `provider_services` | Services a provider offers |
| `provider_availability` | Provider schedule slots |
| `favorites` | Customer ↔ provider saved relationships |
| `locations` | User / provider geographic data |

### API surface

**Authentication (external prefix: `/api/v1/user/auth`)**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | Public | Register new user (email + password) |
| POST | `/signup` | Public | Alias for register |
| POST | `/login` | Public | Email/password login → JWT pair |
| POST | `/logout` | JWT | Revoke current token (Redis blacklist) |
| POST | `/revoke-token` | JWT | Revoke a specific token |
| POST | `/revoke-all-tokens` | JWT | Logout all devices |
| POST | `/refresh` | Refresh token | Issue new access token |
| POST | `/password-reset/request` | Public | Send reset email |
| POST | `/password-reset/confirm` | Public | Apply new password |
| POST | `/password-reset/verify-token` | Public | Validate reset token |
| GET | `/google` | Public | Redirect to Google OAuth |
| GET | `/google/callback` | Public | Google OAuth callback → JWT |
| GET | `/facebook` | Public | Redirect to Facebook OAuth |
| GET | `/facebook/callback` | Public | Facebook OAuth callback → JWT |
| POST | `/oauth/exchange` | Public | Exchange one-time SSO code for JWT |
| POST | `/phone/login` | Public | Phone + OTP login |
| POST | `/phone/otp/request` | Public | Send SMS OTP |
| POST | `/phone/otp/verify` | Public | Verify SMS OTP |
| POST | `/email/otp/request` | Public | Send email OTP |
| POST | `/email/otp/verify` | Public | Verify email OTP |
| POST | `/check-identifier` | Public | Check if email/phone is registered |
| GET | `/me` | JWT | Current user profile |
| PATCH | `/me` | JWT | Update current user |
| GET | `/email/verify` | Public | Verify email via link |
| POST | `/verify` | Public | Submit email verification token |
| GET | `/2fa/status` | JWT | 2FA enabled/disabled |
| POST | `/2fa/enable` | JWT | Enable TOTP 2FA |
| GET | `/2fa/qr-code` | JWT | QR code for authenticator app |
| POST | `/2fa/verify` | JWT | Confirm TOTP setup |
| POST | `/2fa/disable` | JWT | Disable 2FA |
| POST | `/2fa/backup-codes/generate` | JWT | Generate one-time backup codes |
| POST | `/2fa/backup-codes/verify` | JWT | Login using backup code |
| POST | `/2fa/login` | Public | Complete login step with TOTP |
| GET | `/sessions` | JWT | List active sessions |
| DELETE | `/sessions/:id` | JWT | Revoke a session |
| DELETE | `/sessions/all` | JWT | Revoke all sessions |
| GET | `/devices` | JWT | Trusted devices |
| DELETE | `/devices/:id` | JWT | Remove trusted device |
| POST | `/change-password` | JWT | Change password |
| POST | `/email/resend-verification` | JWT | Resend verification email |
| POST | `/account/deactivate` | JWT | Soft-deactivate account |
| DELETE | `/account` | JWT | Schedule account deletion (grace period) |
| POST | `/account/cancel-deletion` | JWT | Cancel pending deletion |
| GET | `/login-history` | JWT | Paginated login log |
| GET | `/social/accounts` | JWT | Linked social OAuth accounts |
| POST | `/social/link/:provider` | JWT | Link OAuth account |
| DELETE | `/social/unlink/:provider` | JWT | Unlink OAuth account |
| POST | `/magic-link/request` | Public | Request magic sign-in link |
| GET | `/magic-link/verify` | Public | Verify magic link → JWT |
| GET | `/apple` | Public | Apple OAuth redirect |
| GET | `/apple/callback` | Public | Apple OAuth callback |
| POST | `/apple/mobile` | Public | Apple mobile sign-in (token exchange) |

**Users (prefix: `/api/v1/users`):** GET `/`, GET `/:id`, PATCH `/:id`, DELETE `/:id` — Admin-scoped

**Providers (prefix: `/api/v1/providers`):** Full CRUD + services + availability management

**RBAC (prefix: `/api/v1/identity`, `/roles`, `/permissions`):** Role/permission assignment

---

# 3. marketplace-service (port 3003)

Service requests, proposals, job lifecycle, reviews, review aggregates.

### Tables owned

| Table | Purpose |
|-------|---------|
| `service_requests` | Customer posted requests |
| `service_categories` | Category taxonomy (soft-deletable via `active` boolean) |
| `service_request_search` | Denormalised FTS index |
| `proposals` | Provider bids on requests |
| `jobs` | Accepted jobs (lifecycle: created → started → completed → confirmed) |
| `reviews` | Post-job ratings and text (30-day edit window) |

### API surface

**Requests (prefix: `/api/v1/requests`)**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | JWT (customer) | Create service request |
| GET | `/` | Public | List requests (paginated) |
| GET | `/search` | Public | Full-text search |
| GET | `/my` | JWT | My requests |
| GET | `/stats` | JWT | Request statistics |
| GET | `/:id` | Public | Request detail |
| PATCH | `/:id` | JWT (owner) | Update request |
| DELETE | `/:id` | JWT (owner) | Delete request |
| POST | `/:id/accept-proposal/:proposalId` | JWT (customer) | Accept proposal → creates job |

**Categories:** GET (public), POST/PATCH/DELETE (admin); soft delete preserves data

**Proposals (prefix: `/api/v1/proposals`):** Full CRUD (provider-scoped); list by request

**Jobs (prefix: `/api/v1/jobs`)**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/my` | JWT | My jobs |
| GET | `/:id` | JWT | Job detail |
| PATCH | `/:id/start` | JWT (provider) | Start job |
| PATCH | `/:id/complete` | JWT (provider) | Mark complete |
| PATCH | `/:id/confirm` | JWT (customer) | Confirm completion |
| PATCH | `/:id/cancel` | JWT | Cancel |

**Reviews (prefix: `/api/v1/reviews`)**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | JWT (customer) | Submit review after job |
| GET | `/provider/:providerId` | Public | Provider's reviews |
| GET | `/provider/:providerId/rating` | Public | Aggregate rating |
| POST | `/:id/respond` | JWT (provider) | Provider response |
| POST | `/:id/helpful` | JWT | Upvote review |
| PATCH | `/:id` | JWT (owner, 30-day window) | Edit review |
| DELETE | `/:id` | JWT (owner/admin) | Delete review |

**Review aggregates (prefix: `/api/v1/review-aggregates`):** aggregate stats, rating distribution, trust badge, top-rated, by-rating listings

---

# 4. payment-service (port 3006)

Multi-gateway payments, subscriptions, refunds, webhooks, coupons, saved methods.

### Tables owned

| Table | Purpose |
|-------|---------|
| `payments` | Transaction records (multi-gateway: Stripe, Razorpay, PayPal, mock) |
| `refunds` | Refund records and status |
| `payment_webhooks` | Raw inbound webhook log per gateway |
| `coupons` | Discount code definitions |
| `coupon_usage` | Per-user coupon redemption log |

### API surface

**Payments:** initiate, capture, cancel, list, detail

**Refunds (prefix: `/api/v1/refunds`):** request, get, list per payment, admin list

**Subscriptions (prefix: `/api/v1/subscriptions`):** create, activate, upgrade plan, get active, status, expiring list

**Pricing plans (prefix: `/api/v1/pricing-plans`):** admin CRUD; public GET active plans

**Saved payment methods (prefix: `/api/v1/payment-methods`):** add, list, default, expiring, delete

**Coupons (prefix: `/api/v1/coupons`):** admin CRUD; validate, redeem (JWT)

**Webhooks:** `POST /api/v1/webhooks/:gateway` — accepts Stripe, Razorpay, PayPal events

---

# 5. comms-service (port 3007)

Real-time messaging (Socket.IO), in-app notifications, email/SMS dispatch, device tokens.

### Tables owned

| Table | Purpose |
|-------|---------|
| `notifications` | In-app notification records |
| `notification_deliveries` | Per-channel delivery state |
| `messages` | Chat messages (Socket.IO backed; 15-min edit window) |
| `attachments` | File attachment metadata |

### API surface

**Notifications:** list (paginated), unread count, mark read, mark all read, delete

**Notification preferences:** GET, PATCH — per-user per-channel preferences

**Device tokens:** register push token, remove, list

**Messages:** send, list conversations, get thread (paginated), edit (15-min window), delete

**Socket.IO realtime events (comms-service embedded server):**
- `message:send` / `message:received` — chat
- `message:edited` / `message:deleted`
- `notification:new` — push in-app notification
- `job:status-update` — job lifecycle events
- `typing:start` / `typing:stop` — typing indicators
- `user:online` / `user:offline` — presence

**Internal dispatch (`/updates` prefix):** Called by other services (not gateway-exposed) to trigger email/SMS/push delivery via email-service and sms-service sidecars.

---

# 6. oversight-service (port 3010)

Admin operations, dispute management, audit logging, analytics, system settings.

### Tables owned

| Table | Purpose |
|-------|---------|
| `admin_actions` | Log of all admin-performed actions |
| `disputes` | Dispute records (customer vs provider) |
| `audit_logs` | Immutable system-wide audit trail |
| `system_settings` | Key/value platform configuration |
| `user_activity_logs` | Per-user activity tracking |
| `daily_metrics` | Aggregated daily platform stats |

### API surface

**Admin users:** list, detail, edit, ban, unban, delete (admin role required)

**Admin audit:** GET `/admin/audit-logs` — paginated immutable trail

**System settings:** GET/PATCH `/admin/system-settings`

**Disputes (prefix: `/api/v1/disputes`):** file (customer/provider), list, detail, resolve, close (admin)

**Analytics (prefix: `/api/v1/analytics`):** overview, users, requests, revenue, daily series — admin only

**Public stats (prefix: `/public`):** public platform counters (no auth required)

---

# 7. infrastructure-service (port 3012)

Feature flags, rate limits, background job visibility, event store, DLQ management.

### Tables owned

| Table | Purpose |
|-------|---------|
| `events` | Ordered event log (Kafka fallback at Levels 1–3) |
| `background_jobs` | BullMQ job execution records |
| `rate_limits` | Per-IP / per-user rate limit counters |
| `feature_flags` | Boolean + string feature toggles |

### API surface

| Resource | Prefix | Auth | Operations |
|----------|--------|------|-----------|
| Feature flags | `/api/v1/feature-flags` | Admin | CRUD; GET by key |
| Rate limits | `/api/v1/rate-limits` | Admin | GET, POST, DELETE `/:key` |
| Background jobs | `/api/v1/background-jobs` | Admin | GET all (paginated), GET `/:id`, DELETE `/:id` |
| Events | `/api/v1/events` | Admin | GET paginated, GET `/:id`, POST |
| DLQ | `/api/v1/dlq` | Admin | GET, retry `/:id`, DELETE `/:id` |

---

# 8. Event Communication

When `EVENT_BUS_ENABLED=true` (Level 4+), services publish to and subscribe from Kafka topics.
At Levels 1–3, events are written synchronously to the `events` table.

| Event | Publisher | Consumers |
|-------|-----------|-----------|
| `user.registered` | identity-service | comms-service (welcome email) |
| `user.email.verified` | identity-service | comms-service |
| `provider.onboarded` | identity-service | comms-service (welcome email) |
| `request.created` | marketplace-service | comms-service (provider alerts) |
| `proposal.submitted` | marketplace-service | comms-service (customer alert) |
| `proposal.accepted` | marketplace-service | comms-service, payment-service |
| `job.started` | marketplace-service | comms-service |
| `job.completed` | marketplace-service | comms-service, payment-service |
| `payment.completed` | payment-service | comms-service, marketplace-service |
| `payment.failed` | payment-service | comms-service |
| `review.submitted` | marketplace-service | comms-service, oversight-service |
| `dispute.filed` | oversight-service | comms-service |

All events are stored in the `events` table via infrastructure-service for auditing and replay.

---

# 9. Cross-Service Data Access Patterns

| Scenario | ❌ Forbidden | ✅ Correct |
|----------|------------|-----------|
| Payment service needs user email | `SELECT email FROM users` | `GET /users/:id` on identity-service |
| Marketplace needs payment status | `SELECT * FROM payments` | `GET /payments/:id` on payment-service |
| Comms builds job summary email | Direct DB join | `GET /jobs/:id` on marketplace-service |
| Admin dashboard needs revenue | Query payment DB | `GET /analytics/revenue` via oversight-service |
| Oversight needs provider rating | Join reviews table | `GET /review-aggregates/provider/:id` on marketplace-service |

