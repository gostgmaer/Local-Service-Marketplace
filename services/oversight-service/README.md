# oversight-service

Handles administration, dispute resolution, audit logging, analytics, and platform health monitoring.

**Port:** 3010  
**Base path (via gateway):** `/api/v1/admin/*`, `/api/v1/analytics/*`, `/api/v1/disputes/*`

---

## Responsibilities

- Admin dashboard: user management, provider verification, platform stats
- Dispute resolution between customers and providers
- Full audit trail of all admin actions
- Platform analytics: daily/monthly metrics, revenue tracking
- User activity logging
- System settings management
- Content moderation tools

---

## Owned Database Tables

| Table | Purpose |
|-------|---------|
| `admin_actions` | Log of all admin operations |
| `disputes` | Customer/provider dispute cases |
| `audit_logs` | System-wide audit trail |
| `system_settings` | Configurable platform settings (key/value) |
| `user_activity_logs` | Activity logs per user |
| `daily_metrics` | Aggregated analytics per day |

---

## API Endpoints

All admin routes require `role=admin`. All routes go through the API Gateway at `http://localhost:3700`.

### Admin — Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/users` | List all users (paginated, filterable) |
| GET | `/api/v1/admin/users/:id` | Get user details |
| PATCH | `/api/v1/admin/users/:id/suspend` | Suspend user account |
| PATCH | `/api/v1/admin/users/:id/reinstate` | Reinstate suspended account |
| DELETE | `/api/v1/admin/users/:id` | Permanently delete user |
| PATCH | `/api/v1/admin/users/:id/role` | Change user role |

### Admin — Providers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/providers` | List providers with verification status |
| PATCH | `/api/v1/admin/providers/:id/verify` | Approve provider verification |
| PATCH | `/api/v1/admin/providers/:id/reject` | Reject verification documents |

### Disputes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/disputes` | List disputes (admin sees all, users see own) |
| POST | `/api/v1/disputes` | Open a dispute (customer or provider) |
| GET | `/api/v1/disputes/:id` | Get dispute details |
| PATCH | `/api/v1/disputes/:id` | Update dispute status (admin) |
| POST | `/api/v1/disputes/:id/resolution` | Submit resolution (admin) |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/dashboard` | Platform overview stats (admin) |
| GET | `/api/v1/analytics/revenue` | Revenue metrics by period |
| GET | `/api/v1/analytics/users` | User growth metrics |
| GET | `/api/v1/analytics/services` | Popular service categories |
| GET | `/api/v1/analytics/providers` | Provider performance metrics |

### System Settings (Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/settings` | Get all system settings |
| PATCH | `/api/v1/admin/settings/:key` | Update a setting |

### Audit Logs (Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/audit-logs` | Query audit logs (paginated, filterable) |

---

## Environment Variables

See [.env.example](.env.example). Key variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `GATEWAY_INTERNAL_SECRET` | **Yes** | Must match api-gateway and identity-service |
| `REDIS_URL` | Yes (workers) | Required when WORKERS_ENABLED=true |
| `USER_SERVICE_URL` | Yes | Points to identity-service |
| `NOTIFICATION_SERVICE_URL` | Yes | Points to comms-service |
| `PAYMENT_SERVICE_URL` | Yes | Points to payment-service |
| `MARKETPLACE_SERVICE_URL` | Yes | Points to marketplace-service |

---

## Running Locally

```powershell
pnpm install
Copy-Item .env.example .env
# Edit .env — set DATABASE_URL, GATEWAY_INTERNAL_SECRET, and service URLs
pnpm start:dev
```

Service starts on `http://localhost:3010`.

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── admin/               # Admin user and provider management
│   ├── disputes/            # Dispute lifecycle
│   ├── analytics/           # Metrics and dashboard
│   ├── audit/               # Audit log queries
│   └── settings/            # System settings
├── common/
├── config/
├── redis/
├── bullmq/
└── workers/
```

---

## Background Jobs (BullMQ)

When `WORKERS_ENABLED=true`:

| Queue | Jobs |
|-------|------|
| `oversight.analytics` | Aggregate daily metrics (runs nightly) |
| `oversight.reports` | Generate scheduled admin reports |
| `oversight.cleanup` | Archive old audit logs |

---

## Tests

```powershell
pnpm test
pnpm test:cov
pnpm test:e2e
```
