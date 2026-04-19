# Local Service Marketplace

A **production-ready, microservices-based platform** that connects customers who need local services (cleaning, plumbing, tutoring, etc.) with verified service providers.

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-E0234E?logo=nestjs)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-000000?logo=nextdotjs)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2017-4169E1?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Cache-Redis%207-DC382D?logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Containers-Docker-2496ED?logo=docker)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6?logo=typescript)](https://typescriptlang.org)

---

## Table of Contents

1. [What This Platform Does](#1-what-this-platform-does)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Services & Ports](#4-services--ports)
5. [Quick Start (Docker)](#5-quick-start-docker)
6. [Local Development (No Docker)](#6-local-development-no-docker)
7. [Environment Configuration](#7-environment-configuration)
8. [API Reference](#8-api-reference)
9. [Authentication](#9-authentication)
10. [Business Flows](#10-business-flows)
11. [Database Schema](#11-database-schema)
12. [Background Jobs (BullMQ)](#12-background-jobs-bullmq)
13. [Event Streaming (Kafka)](#13-event-streaming-kafka)
14. [Scaling Levels](#14-scaling-levels)
15. [Testing](#15-testing)
16. [CI/CD Pipeline](#16-cicd-pipeline)
17. [Contributing](#17-contributing)
18. [Security Checklist](#18-security-checklist)
19. [Documentation Index](#19-documentation-index)

---

## 1. What This Platform Does

**Customers** post service requests (e.g. "need a plumber this weekend"). **Providers** browse open requests and submit competitive proposals. Once a customer accepts a proposal, a **job** is created. After job completion the customer pays and leaves a review.

Core capabilities:

- Multi-role user system: Customer, Provider, Admin
- Provider verification with document upload and portfolio
- Service request lifecycle: open → proposals → job → payment → review
- Multi-gateway payment processing (Stripe, Razorpay, PayPal, PayU, Instamojo, mock)
- Real-time notifications (email, SMS, in-app, push via FCM)
- Admin dashboard with dispute resolution, audit logs, and analytics
- OAuth sign-in (Google, Facebook)
- Scalable from a single Docker Compose stack to Kubernetes

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js + React | 15.x |
| Backend | NestJS + Express | 10.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 17 |
| Connection Pooler | PgBouncer | 1.22 |
| Cache & Queues | Redis | 7.x |
| Background Jobs | BullMQ | 5.x |
| Event Streaming | Apache Kafka | 3.x |
| Containers | Docker + Compose | 20.x / 2.x |
| Auth | JWT + Passport | HS256, RS256 |
| Validation | class-validator | 0.14 |
| Logging | Winston + nest-winston | 3.x |
| Testing | Jest + Supertest | 29.x |
| API Tests | Newman (Postman CLI) | latest |

---

## 3. Architecture Overview

```
Browser / Mobile
       |
       v
 ┌─────────────────────────────────────────────────────┐
 │            Frontend — Next.js                       │  :3000
 │   (React + NextAuth + Zustand + Tailwind CSS)       │
 └─────────────────────┬───────────────────────────────┘
                       │  REST / HTTPS
                       v
 ┌─────────────────────────────────────────────────────┐
 │           API Gateway — NestJS                      │  :3700
 │  • JWT validation      • Route proxying             │
 │  • Rate limiting       • CORS                       │
 │  • x-user-* header injection                        │
 └──┬──────┬──────┬──────┬──────┬──────────────────────┘
    │      │      │      │      │
    v      v      v      v      v
┌───────┐ ┌───┐ ┌───┐ ┌───┐ ┌────────────┐ ┌──────────────┐
│identity│ │mkt│ │pay│ │coms│ │oversight   │ │infrastructure│
│ :3001  │ │:03│ │:06│ │:07│ │   :3010    │ │   :3012      │
└───────┘ └───┘ └───┘ └───┘ └────────────┘ └──────────────┘
    │                   │
    v                   v
┌──────────┐    ┌──────────────┐
│email-svc │    │  sms-service │
│ :3500    │    │   :3000      │
│(internal)│    │  (internal)  │
└──────────┘    └──────────────┘

All services share:
  PostgreSQL :5432 (via PgBouncer :5432)
  Redis      :6379  (cache + queues)
  Kafka      :9092  (optional event bus)
```

### Communication Rules

| Rule | Detail |
|------|--------|
| All client traffic | Goes through API Gateway only — never direct to services |
| Notifications | All services call comms-service; no service calls email/SMS directly |
| User data | Services call identity-service API — never cross-service DB joins |
| Background work | All queued via BullMQ (Redis); workers run inside each service process |
| Events (optional) | Published to Kafka when `EVENT_BUS_ENABLED=true`; services fall back to HTTP |

### Data Ownership (No Cross-Service DB Joins)

| Service | Owns These Tables |
|---------|------------------|
| identity-service | `users`, `sessions`, `providers`, `provider_services`, `provider_availability`, `provider_portfolio`, `provider_documents`, `social_accounts`, `login_attempts`, `email_verification_tokens`, `password_reset_tokens`, `locations`, `favorites` |
| marketplace-service | `service_requests`, `service_categories`, `proposals`, `jobs`, `reviews`, `service_request_search` |
| payment-service | `payments`, `refunds`, `payment_webhooks`, `coupons`, `coupon_usage`, `pricing_plans`, `subscriptions`, `saved_payment_methods` |
| comms-service | `notifications`, `notification_deliveries`, `messages`, `attachments` |
| oversight-service | `admin_actions`, `disputes`, `audit_logs`, `system_settings`, `user_activity_logs`, `daily_metrics` |
| infrastructure-service | `events`, `background_jobs`, `rate_limits`, `feature_flags` |

---

## 4. Services & Ports

### Core Services

| Service | Local Port | Docker Container | Role |
|---------|-----------|-----------------|------|
| frontend | 3000 | `frontend` | Next.js customer/provider/admin UI |
| api-gateway | 3700 | `api-gateway` | Single entry point — JWT auth, routing, rate limiting |
| identity-service | 3001 | `identity-service` | Auth, JWT, OAuth (Google/Facebook), users, providers |
| marketplace-service | 3003 | `marketplace-service` | Requests, proposals, jobs, reviews, categories |
| payment-service | 3006 | `payment-service` | Payments, refunds, coupons, subscriptions |
| comms-service | 3007 | `comms-service` | Email, SMS, in-app, push notifications + messaging |
| oversight-service | 3010 | `oversight-service` | Admin ops, dispute resolution, analytics, audit logs |
| infrastructure-service | 3012 | `infrastructure-service` | Feature flags, rate limits, background jobs, event store |

### Infrastructure Services

| Service | Local Port | Docker Container | Role |
|---------|-----------|-----------------|------|
| PostgreSQL | 5432 | `postgres` | Primary database |
| PgBouncer | 5432 (Docker) | `pgbouncer` | Connection pooler |
| Redis | 6379 | `redis` | Cache + BullMQ queues |
| Zookeeper | 2181 | `zookeeper` | Kafka coordination (optional) |
| Kafka | 9092 | `kafka` | Event streaming (optional) |
| email-service | 4000 (local) / 3500 (Docker) | `email-service` | SMTP delivery |
| sms-service | 5000 (local) / 3000 (Docker) | `sms-service` | SMS/OTP delivery |

---

## 5. Quick Start (Docker)

**Prerequisites:** Docker Desktop 20.x+, Docker Compose 2.x+, 4 GB RAM minimum (8 GB recommended)

### Step 1 — Clone and configure

```powershell
git clone https://github.com/your-org/local-service-marketplace.git
cd local-service-marketplace

# Copy the template — docker.env is gitignored and holds your real secrets
Copy-Item .env.example docker.env
```

### Step 2 — Generate secrets

Open `docker.env` and replace these five values (generate each with `openssl rand -base64 48`):

```env
JWT_SECRET=<replace>
JWT_REFRESH_SECRET=<replace — must differ from JWT_SECRET>
GATEWAY_INTERNAL_SECRET=<replace>
ENCRYPTION_KEY=<replace — use openssl rand -base64 64>
SESSION_SECRET=<replace — use openssl rand -base64 32>
```

### Step 3 — Start the platform

```powershell
# Start core services + Redis workers (recommended)
docker-compose up -d

# Wait ~60 seconds, then check health
curl http://localhost:3700/health
```

The `workers` profile in `docker.env` starts Redis automatically. No separate command needed.

### Step 4 — Run database migrations

```powershell
cd database
node migrate.js
```

### Step 5 — Seed sample data (optional)

```powershell
node seed.js
```

Creates 320+ users and 1000+ records across all tables.

**Default credentials:**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@marketplace.com` | `password123` |
| Provider | `provider1@example.com` | `password123` |
| Customer | `customer1@example.com` | `password123` |

### Access the platform

| URL | What you get |
|-----|-------------|
| http://localhost:3000 | Frontend (Next.js) |
| http://localhost:3700 | API Gateway |
| http://localhost:3700/health | Health check |

---

## 6. Local Development (No Docker)

Run each service independently with hot-reload. Only PostgreSQL and Redis need to run via Docker.

### Step 1 — Start infrastructure only

```powershell
docker run -d --name mkt-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=marketplace `
  -p 5432:5432 postgres:17-alpine

docker run -d --name mkt-redis -p 6379:6379 redis:7-alpine
```

### Step 2 — Install all dependencies

```powershell
# From repo root — installs all workspaces
pnpm install
```

Or per service:

```powershell
cd services/identity-service ; pnpm install
cd ../marketplace-service    ; pnpm install
cd ../payment-service        ; pnpm install
cd ../comms-service          ; pnpm install
cd ../oversight-service      ; pnpm install
cd ../infrastructure-service ; pnpm install
cd ../../api-gateway         ; pnpm install
cd ../frontend               ; pnpm install
```

### Step 3 — Copy and configure env files

```powershell
# Copy all .env.example files to .env
Get-ChildItem -Path "." -Filter ".env.example" -Recurse |
  Where-Object { $_.FullName -notmatch "node_modules" } |
  ForEach-Object { Copy-Item $_.FullName (Join-Path $_.DirectoryName ".env") }
```

Edit each `.env` to use `localhost` for `DATABASE_HOST` and `REDIS_HOST`, and ensure `JWT_SECRET` and `GATEWAY_INTERNAL_SECRET` match across `api-gateway/.env` and `services/identity-service/.env`.

### Step 4 — Run database setup

```powershell
cd database
node migrate.js
node seed.js    # optional
```

### Step 5 — Start services (separate terminals)

```powershell
# Terminal 1 — API Gateway
cd api-gateway ; pnpm start:dev

# Terminal 2 — identity-service
cd services/identity-service ; pnpm start:dev

# Terminal 3 — marketplace-service
cd services/marketplace-service ; pnpm start:dev

# Terminal 4 — payment-service
cd services/payment-service ; pnpm start:dev

# Terminal 5 — comms-service
cd services/comms-service ; pnpm start:dev

# Terminal 6 — oversight-service
cd services/oversight-service ; pnpm start:dev

# Terminal 7 — frontend
cd frontend ; pnpm dev
```

> **Tip:** infrastructure-service is optional for local dev. It handles feature flags and background job tracking.

---

## 7. Environment Configuration

The platform uses a layered env configuration:

| File | Purpose | Committed? |
|------|---------|-----------|
| `docker.env` | Docker Compose runtime config (real secrets) | **No** (gitignored) |
| `.env.example` | Root template — copy to `docker.env` | Yes |
| `services/*/. env.example` | Per-service template — copy to `.env` for local dev | Yes |
| `api-gateway/.env.example` | API Gateway template | Yes |
| `frontend/.env.local` | Frontend config (not committed) | No |

### Critical variables that must match across services

```env
# Same value in api-gateway AND identity-service
JWT_SECRET=...

# Same value in api-gateway, identity-service, AND oversight-service
GATEWAY_INTERNAL_SECRET=...
```

### Full reference

See [docs/ENVIRONMENT_VARIABLES_GUIDE.md](docs/ENVIRONMENT_VARIABLES_GUIDE.md) for the complete variable reference with descriptions, defaults, and production guidance.

---

## 8. API Reference

All routes are prefixed with `/api/v1`. The API Gateway (port 3700) is the only entry point.

### Public Routes (no authentication required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/user/auth/signup` | Register a new account |
| POST | `/api/v1/user/auth/login` | Login and receive JWT tokens |
| POST | `/api/v1/user/auth/refresh` | Refresh access token |
| POST | `/api/v1/user/auth/password-reset/request` | Request password reset email |
| POST | `/api/v1/user/auth/password-reset/confirm` | Confirm password reset |
| GET | `/api/v1/user/auth/google` | Google OAuth redirect |
| GET | `/api/v1/user/auth/google/callback` | Google OAuth callback |
| GET | `/api/v1/user/auth/facebook` | Facebook OAuth redirect |
| GET | `/api/v1/user/auth/facebook/callback` | Facebook OAuth callback |
| GET | `/api/v1/categories` | List service categories |
| GET | `/health` | Gateway health check |

### Authenticated Routes (Bearer token required)

#### Identity Service — Users & Providers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users/me` | Get current user profile |
| PATCH | `/api/v1/users/me` | Update current user profile |
| DELETE | `/api/v1/users/me` | Delete account |
| POST | `/api/v1/user/auth/logout` | Invalidate tokens |
| POST | `/api/v1/user/auth/verify-email` | Verify email address |
| GET | `/api/v1/providers` | List all providers |
| GET | `/api/v1/providers/:id` | Get provider profile |
| POST | `/api/v1/providers` | Create provider profile |
| PATCH | `/api/v1/providers/:id` | Update provider profile |
| POST | `/api/v1/providers/:id/portfolio` | Upload portfolio image |
| POST | `/api/v1/providers/:id/documents` | Upload verification document |
| GET | `/api/v1/providers/:id/availability` | Get provider availability |
| PUT | `/api/v1/providers/:id/availability` | Set provider availability |

#### Marketplace Service — Requests, Proposals, Jobs, Reviews

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/requests` | List service requests |
| POST | `/api/v1/requests` | Create service request |
| GET | `/api/v1/requests/:id` | Get request details |
| PATCH | `/api/v1/requests/:id` | Update request |
| DELETE | `/api/v1/requests/:id` | Cancel request |
| GET | `/api/v1/proposals` | List proposals |
| POST | `/api/v1/proposals` | Submit proposal |
| GET | `/api/v1/proposals/:id` | Get proposal details |
| PATCH | `/api/v1/proposals/:id/accept` | Accept a proposal (creates job) |
| PATCH | `/api/v1/proposals/:id/reject` | Reject a proposal |
| GET | `/api/v1/jobs` | List jobs |
| GET | `/api/v1/jobs/:id` | Get job details |
| PATCH | `/api/v1/jobs/:id` | Update job status |
| POST | `/api/v1/reviews` | Leave a review |
| GET | `/api/v1/reviews` | List reviews |

#### Payment Service

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/payments` | Initiate payment |
| GET | `/api/v1/payments` | List payments |
| GET | `/api/v1/payments/:id` | Get payment details |
| POST | `/api/v1/refunds` | Request refund |
| GET | `/api/v1/refunds/:id` | Get refund status |
| GET | `/api/v1/coupons/:code` | Validate coupon |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook receiver |
| POST | `/api/v1/webhooks/razorpay` | Razorpay webhook receiver |

#### Comms Service — Notifications & Messaging

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications` | List user notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark notification as read |
| PATCH | `/api/v1/notifications/read-all` | Mark all as read |
| GET | `/api/v1/messages` | List messages |
| POST | `/api/v1/messages` | Send message |
| GET | `/api/v1/messages/:jobId` | Get job conversation |

#### Oversight Service — Admin & Analytics

| Method | Path | Role Required |
|--------|------|--------------|
| GET | `/api/v1/admin/users` | Admin |
| PATCH | `/api/v1/admin/users/:id/suspend` | Admin |
| PATCH | `/api/v1/admin/users/:id/unsuspend` | Admin |
| POST | `/api/v1/admin/providers/:id/verify` | Admin |
| GET | `/api/v1/admin/disputes` | Admin |
| PATCH | `/api/v1/admin/disputes/:id/resolve` | Admin |
| GET | `/api/v1/analytics/overview` | Admin |
| GET | `/api/v1/analytics/revenue` | Admin |
| GET | `/api/v1/admin/audit-logs` | Admin |
| GET | `/api/v1/admin/settings` | Admin |
| PATCH | `/api/v1/admin/settings` | Admin |

#### Infrastructure Service (optional)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/feature-flags` | List feature flags |
| PATCH | `/api/v1/feature-flags/:key` | Update feature flag |
| GET | `/api/v1/events` | List events |

### Pagination

All list endpoints support cursor-based pagination:

```
GET /api/v1/requests?limit=20&cursor=<cursor>
GET /api/v1/providers?limit=20&page=2
```

### API Response Format

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 20 }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Description field is required",
    "details": []
  }
}
```

Full spec: [docs/api/API_SPECIFICATION.md](docs/api/API_SPECIFICATION.md)

---

## 9. Authentication

### Request Flow

```
Client  ──[POST /api/v1/user/auth/login]──► API Gateway
                                                │
                                      proxies to identity-service
                                                │
                                      validates credentials
                                                │
                                      returns { accessToken, refreshToken }
                                                │
Client  ──[Bearer accessToken]──────► API Gateway
                                                │
                                      validates JWT (local or api strategy)
                                                │
                                      injects x-user-* headers
                                                │
                                      ────────────► backend service
                                                    (reads headers, no JWT needed)
```

### Headers injected by gateway (forwarded to every service)

| Header | Value |
|--------|-------|
| `x-user-id` | UUID of authenticated user |
| `x-user-email` | User's email address |
| `x-user-role` | `customer`, `provider`, or `admin` |
| `x-user-name` | User's display name |
| `x-user-phone` | User's phone number |

### Token lifetimes

| Token | Expiry | Storage |
|-------|--------|---------|
| Access token | 15 minutes | Memory (not persisted) |
| Refresh token | 90 days | HTTP-only cookie or secure storage |

### Validation strategies

```env
# api-gateway/.env
TOKEN_VALIDATION_STRATEGY=local   # Faster — gateway verifies JWT locally (default)
TOKEN_VALIDATION_STRATEGY=api     # More secure — calls identity-service to check user status
```

Full workflow: [docs/guides/AUTHENTICATION_WORKFLOW.md](docs/guides/AUTHENTICATION_WORKFLOW.md)

---

## 10. Business Flows

### Customer: Post a Job

```
1. Register / Login              POST /api/v1/user/auth/login
2. Create service request        POST /api/v1/requests
3. Receive proposals             GET  /api/v1/proposals?requestId=<id>
4. Accept a proposal             PATCH /api/v1/proposals/<id>/accept
5. Job created automatically     (marketplace-service internal)
6. Track job progress            GET  /api/v1/jobs/<id>
7. Pay on completion             POST /api/v1/payments
8. Leave review                  POST /api/v1/reviews
```

### Provider: Win Work

```
1. Register as provider          POST /api/v1/user/auth/signup
2. Complete provider profile     POST /api/v1/providers
3. Upload verification docs      POST /api/v1/providers/<id>/documents
4. Browse open requests          GET  /api/v1/requests
5. Submit proposal               POST /api/v1/proposals
6. Execute job, update status    PATCH /api/v1/jobs/<id>
7. Get paid after review         (payment-service releases escrow)
```

### Payment Flow

```
Customer accepts proposal
  → Job created (status: in_progress)
  → Customer initiates payment POST /api/v1/payments
      → Payment gateway processes (Stripe / Razorpay / mock)
      → Webhook confirms POST /api/v1/webhooks/<gateway>
      → Payment marked completed
      → Job status → completed
      → comms-service notifies both parties
```

### Notification Routing

```
Any service ──► comms-service:3007 ──► email-service (SMTP)
                                   ──► sms-service   (OTP / SMS)
                                   ──► Firebase FCM  (push, optional)
                                   ──► DB            (in-app notifications)
```

---

## 11. Database Schema

Single PostgreSQL instance. Each service owns its tables — no cross-service joins.

| Category | Tables |
|----------|--------|
| **Auth** | `users`, `sessions`, `email_verification_tokens`, `password_reset_tokens`, `login_attempts`, `social_accounts` |
| **Providers** | `providers`, `provider_services`, `provider_availability`, `provider_portfolio`, `provider_documents` |
| **Marketplace** | `service_categories`, `service_requests`, `proposals`, `jobs`, `reviews`, `service_request_search` |
| **Payments** | `payments`, `refunds`, `payment_webhooks`, `coupons`, `coupon_usage`, `pricing_plans`, `subscriptions`, `saved_payment_methods` |
| **Comms** | `notifications`, `notification_deliveries`, `messages`, `attachments` |
| **Admin** | `admin_actions`, `disputes`, `audit_logs`, `system_settings`, `user_activity_logs`, `daily_metrics` |
| **Infra** | `events`, `background_jobs`, `rate_limits`, `feature_flags` |

All tables use:
- UUID primary keys
- `created_at` / `updated_at` timestamps
- `deleted_at` for soft deletes
- Indexed foreign keys

Schema: [database/schema.sql](database/schema.sql) | Migrations: [database/migrations/](database/migrations/)

---

## 12. Background Jobs (BullMQ)

Workers run inside each service when `WORKERS_ENABLED=true`. Redis is required.

| Service | Queues |
|---------|--------|
| identity-service | `identity.notification`, `identity.cleanup`, `identity.document-expiry` |
| marketplace-service | `marketplace.notification`, `marketplace.analytics`, `marketplace.rating`, `marketplace.cleanup` |
| payment-service | `payment.retry`, `payment.refund`, `payment.webhook`, `payment.subscription`, `payment.cleanup` |
| comms-service | `comms.email`, `comms.sms`, `comms.push`, `comms.digest`, `comms.cleanup` |
| oversight-service | `oversight.audit`, `oversight.cleanup` |
| infrastructure-service | `infra.background-jobs`, `infra.cleanup` |

**Scheduled jobs:**

| Job | Schedule |
|-----|----------|
| Email digest | Daily 8 AM |
| Rating recalculation | Nightly 3 AM |
| Token/session cleanup | Daily 2 AM |
| Expired coupon cleanup | Weekly Sunday |
| Analytics aggregation | Daily midnight |

Enable: `WORKERS_ENABLED=true` in `docker.env` (requires `COMPOSE_PROFILES=workers`).

Full guide: [docs/BULLMQ_CONFIGURATION_GUIDE.md](docs/BULLMQ_CONFIGURATION_GUIDE.md)

---

## 13. Event Streaming (Kafka)

When `EVENT_BUS_ENABLED=true`, services publish and consume domain events. Kafka is **optional** — all services work without it using direct HTTP calls.

| Event | Producer | Consumers |
|-------|----------|-----------|
| `request.created` | marketplace-service | comms-service |
| `proposal.submitted` | marketplace-service | comms-service |
| `proposal.accepted` | marketplace-service | comms-service, payment-service |
| `job.started` | marketplace-service | comms-service |
| `job.completed` | marketplace-service | payment-service, comms-service |
| `payment.completed` | payment-service | marketplace-service, comms-service |
| `review.submitted` | marketplace-service | oversight-service |
| `user.registered` | identity-service | comms-service |

Enable: `COMPOSE_PROFILES=workers,events` + `EVENT_BUS_ENABLED=true` in `docker.env`.

Full guide: [docs/guides/KAFKA_INTEGRATION.md](docs/guides/KAFKA_INTEGRATION.md)

---

## 14. Scaling Levels

The platform supports 5 graduated scaling levels:

| Level | Profiles | Memory | Users | What You Get |
|-------|----------|--------|-------|-------------|
| **1 — MVP** | _(none)_ | ~3–5 GB | 200–350 | Core API + DB only |
| **2 — Cache** | `cache` | ~4–6 GB | 500–1K | + Redis caching |
| **3 — Workers** | `workers` | ~5–7 GB | 2K+ | + Async background jobs |
| **4 — Events** | `workers,events` | ~8–10 GB | 10K+ | + Kafka event streaming |
| **5 — Full** | `full` | ~12–16 GB | 50K+ | + Kubernetes + CDN-ready |

```powershell
# Example: run Level 3 (recommended for dev)
# In docker.env:
COMPOSE_PROFILES=workers
CACHE_ENABLED=true
WORKERS_ENABLED=true

docker-compose up -d
```

Scaling strategy: [docs/deployment/SCALING_STRATEGY.md](docs/deployment/SCALING_STRATEGY.md)

---

## 15. Testing

### Unit Tests

```powershell
# Run from any service directory
pnpm test

# With coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

### API / Integration Tests (Newman)

```powershell
# Run the full API test suite (requires services to be running)
.\scripts\run-postman-tests.ps1

# Or with Newman directly
npx newman run docs/Local-Service-Marketplace.postman_collection.json `
  --environment newman/newman.env.json `
  --reporters cli,html
```

Import the Postman collection for manual testing:

```
docs/Local-Service-Marketplace.postman_collection.json
```

Tests cover all 8 services: health checks, auth flows, CRUD operations, error handling, and business flows.

---

## 16. CI/CD Pipeline

### Pull Request → `main`

Triggered by `.github/workflows/pr.yml`:

1. Frontend lint + test + build
2. All 6 backend services build (parallel)
3. API Gateway build
4. Vercel preview deployment — URL posted as PR comment

### Merge to `main`

Triggered by `.github/workflows/release.yml`:

1. Auto-generates semantic version tag (`vX.Y.Z`)
2. Creates GitHub Release with changelog
3. Deploys frontend to Vercel production
4. Triggers all Render deploy hooks (one per service)

### Conventional Commit Version Bumping

| Commit type | Version bump |
|-------------|-------------|
| `feat:` | Minor — `v1.1.0` |
| `fix:` or `chore:` | Patch — `v1.0.1` |
| `BREAKING CHANGE` or `major:` | Major — `v2.0.0` |

### Required GitHub Secrets

| Secret | How to Get |
|--------|-----------|
| `VERCEL_TOKEN` | Vercel Account → Settings → Tokens |
| `VERCEL_ORG_ID` | `vercel link` → `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `vercel link` → `.vercel/project.json` |
| `RENDER_DEPLOY_HOOK_IDENTITY` | Render → identity-service → Settings → Deploy Hook |
| `RENDER_DEPLOY_HOOK_MARKETPLACE` | Render → marketplace-service → Deploy Hook |
| `RENDER_DEPLOY_HOOK_PAYMENT` | Render → payment-service → Deploy Hook |
| `RENDER_DEPLOY_HOOK_COMMS` | Render → comms-service → Deploy Hook |
| `RENDER_DEPLOY_HOOK_OVERSIGHT` | Render → oversight-service → Deploy Hook |
| `RENDER_DEPLOY_HOOK_INFRASTRUCTURE` | Render → infrastructure-service → Deploy Hook |
| `RENDER_DEPLOY_HOOK_API_GATEWAY` | Render → api-gateway → Deploy Hook |

---

## 17. Contributing

### Branch Naming

```
feat/short-description        # New feature
fix/short-description         # Bug fix
chore/short-description       # Build, deps, config
docs/short-description        # Documentation only
```

### Commit Messages (Conventional Commits)

```
feat(identity): add Apple Sign-In support
fix(payment): handle Razorpay webhook signature mismatch
chore(deps): bump bullmq to 5.74
docs(readme): update scaling levels table
```

### Development Workflow

1. Create a feature branch from `main`
2. Install dependencies: `pnpm install` from repo root
3. Copy env files: `.\scripts\setup-env-files.ps1`
4. Start services: `docker-compose up -d`
5. Make changes following NestJS module architecture
6. Add/update unit tests (`pnpm test`)
7. Run API tests: `.\scripts\run-postman-tests.ps1`
8. Push and open a PR

### Architecture Rules

- Each service must be independent and own its database tables
- Never perform cross-service database joins — call the owning service's API instead
- All notifications must go through comms-service
- Use DTO validation with class-validator on all controller inputs
- Paginate all list endpoints
- Log all sensitive actions via audit log (oversight-service)

See [docs/AI_DEVELOPER_GUIDE.md](docs/AI_DEVELOPER_GUIDE.md) and [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for full architecture rules.

---

## 18. Security Checklist (Production)

- [ ] Generate unique `JWT_SECRET` (min 32 chars) — same in api-gateway and identity-service
- [ ] Generate unique `JWT_REFRESH_SECRET` (different from JWT_SECRET)
- [ ] Generate unique `GATEWAY_INTERNAL_SECRET` — same in api-gateway, identity-service, oversight-service
- [ ] Generate `ENCRYPTION_KEY` (min 64 chars)
- [ ] Generate `SESSION_SECRET` (min 32 chars)
- [ ] Change default `DATABASE_PASSWORD` from `postgres`
- [ ] Set Redis password (`REDIS_PASSWORD`)
- [ ] Set `NODE_ENV=production` in all services
- [ ] Set `DATABASE_SSL=true` for cloud-managed databases
- [ ] Set `CORS_ORIGIN` to your production domain (not `*`)
- [ ] Enable HTTPS/TLS at the load balancer
- [ ] Configure real email provider (not mock SMTP)
- [ ] Configure real SMS provider (Twilio or similar)
- [ ] Set up Google/Facebook OAuth credentials
- [ ] Enable rate limiting (`RATE_LIMITING_ENABLED=true`)
- [ ] Set up database backups
- [ ] Never commit `.env` or `docker.env` to git

---

## 19. Documentation Index

| Topic | File |
|-------|------|
| Getting started (all environments) | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| Quick start (3-minute setup) | [docs/QUICK_START.md](docs/QUICK_START.md) |
| Quick reference (all commands) | [docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) |
| **Environment variables (full reference)** | [docs/ENVIRONMENT_VARIABLES_GUIDE.md](docs/ENVIRONMENT_VARIABLES_GUIDE.md) |
| Marketplace guide (roles & capabilities) | [docs/MARKETPLACE_GUIDE.md](docs/MARKETPLACE_GUIDE.md) |
| API specification | [docs/api/API_SPECIFICATION.md](docs/api/API_SPECIFICATION.md) |
| API Gateway details | [docs/api/API_GATEWAY_README.md](docs/api/API_GATEWAY_README.md) |
| Architecture detail | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| Service boundary map | [docs/architecture/MICROSERVICE_BOUNDARY_MAP.md](docs/architecture/MICROSERVICE_BOUNDARY_MAP.md) |
| System diagram | [docs/architecture/SYSTEM_DIAGRAM.md](docs/architecture/SYSTEM_DIAGRAM.md) |
| Authentication workflow | [docs/guides/AUTHENTICATION_WORKFLOW.md](docs/guides/AUTHENTICATION_WORKFLOW.md) |
| OAuth integration | [docs/guides/OAUTH_INTEGRATION_GUIDE.md](docs/guides/OAUTH_INTEGRATION_GUIDE.md) |
| Multi-auth guide | [docs/guides/MULTI_AUTH_GUIDE.md](docs/guides/MULTI_AUTH_GUIDE.md) |
| Background jobs (BullMQ) | [docs/BULLMQ_CONFIGURATION_GUIDE.md](docs/BULLMQ_CONFIGURATION_GUIDE.md) |
| Caching guide | [docs/guides/CACHING_GUIDE.md](docs/guides/CACHING_GUIDE.md) |
| Kafka integration | [docs/guides/KAFKA_INTEGRATION.md](docs/guides/KAFKA_INTEGRATION.md) |
| Scaling strategy | [docs/deployment/SCALING_STRATEGY.md](docs/deployment/SCALING_STRATEGY.md) |
| Database seeding | [docs/DATABASE_SEEDING.md](docs/DATABASE_SEEDING.md) |
| Route protection reference | [docs/ROUTE_PROTECTION_REFERENCE.md](docs/ROUTE_PROTECTION_REFERENCE.md) |
| Standardized API responses | [docs/STANDARDIZED_API_RESPONSES.md](docs/STANDARDIZED_API_RESPONSES.md) |
| Secrets management | [docs/guides/SECRETS_MANAGEMENT_GUIDE.md](docs/guides/SECRETS_MANAGEMENT_GUIDE.md) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Production readiness report | [docs/PRODUCTION_READINESS_REPORT.md](docs/PRODUCTION_READINESS_REPORT.md) |
| AI developer guide | [docs/AI_DEVELOPER_GUIDE.md](docs/AI_DEVELOPER_GUIDE.md) |
| Token validation guide | [api-gateway/TOKEN_VALIDATION_GUIDE.md](api-gateway/TOKEN_VALIDATION_GUIDE.md) |

### Per-Service README Files

| Service | README |
|---------|--------|
| identity-service | [services/identity-service/README.md](services/identity-service/README.md) |
| marketplace-service | [services/marketplace-service/README.md](services/marketplace-service/README.md) |
| payment-service | [services/payment-service/README.md](services/payment-service/README.md) |
| comms-service | [services/comms-service/README.md](services/comms-service/README.md) |
| oversight-service | [services/oversight-service/README.md](services/oversight-service/README.md) |
| infrastructure-service | [services/infrastructure-service/README.md](services/infrastructure-service/README.md) |

---

## Common Commands

```powershell
# Start all services (Level 3 — Redis + workers)
docker-compose up -d

# Start with frontend
docker-compose --profile frontend up -d

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f identity-service

# Restart a service
docker-compose restart marketplace-service

# Rebuild after code changes
docker-compose up -d --build

# Run database migrations
cd database ; node migrate.js

# Seed sample data
cd database ; node seed.js

# Stop all services
docker-compose down

# Full reset (deletes all data volumes)
docker-compose down -v

# Scale a service (e.g. run 3 gateway replicas)
docker-compose up -d --scale api-gateway=3

# Check service health
curl http://localhost:3700/health
```
