# Local Service Marketplace – Architecture Guide

**Last Updated:** May 2026  
**Stack Version:** Next.js 15 / React 19 / NestJS 10 / Node.js 20 LTS / pnpm 10

This document defines the **system architecture, services, infrastructure layers, and scaling strategy** for the Local Service Marketplace platform.

The system is designed so that **code is written once and infrastructure layers are enabled gradually without rewriting services**.

---

# 1. System Design Philosophy

The platform follows these principles:

1. Write services once — no rewrites when scaling
2. Enable infrastructure layers gradually via feature flags
3. Maintain a production-grade PostgreSQL schema from day one (~45 tables)
4. All backend services run in Docker containers
5. Services communicate through HTTP APIs or Kafka events
6. Infrastructure features (Redis, BullMQ, Kafka) are enabled via environment flags
7. Zero cross-service database joins — every cross-boundary read goes through an API call

Scaling requires **infrastructure changes only, not business logic changes**.

---

# 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 15.5.15 |
| Frontend UI | React | 19.2.5 |
| Frontend State | Zustand + TanStack Query | 4.5 / 5.99 |
| Frontend Forms | React Hook Form + Zod | 7.74 / 4.4 |
| Frontend Realtime | Socket.IO client | 4.8.3 |
| Backend Framework | NestJS | 10.x |
| Runtime | Node.js | 20 LTS |
| Package Manager | pnpm (workspace monorepo) | 10.33.2 |
| Database | PostgreSQL | 16 |
| Cache / Queue broker | Redis | 7 |
| Background jobs | BullMQ (`@nestjs/bullmq`) | — |
| Event streaming | Kafka (optional, Level 4+) | — |
| Containerization | Docker + Compose | 20.x+ |
| Orchestration (scale) | Kubernetes | — |
| Hosting | Frontend → Vercel; Backend → cloud containers | — |

---

# 3. System Architecture

```
Browser / Mobile Client
       │
       ▼
  Frontend — Next.js 15 App Router (port 3000)
       │   Socket.IO client (realtime)
       │   REST via Axios (TanStack Query)
       │
       ▼
  API Gateway (port 3700)
  • JWT validation (every authenticated request)
  • Rate limiting (express-rate-limit + optional Redis)
  • Request logging (Winston structured JSON)
  • Multipart pass-through (file uploads)
  • Sentry error tracking
  • Catch-all proxy → routes to correct microservice
       │
  ┌────┴──────────────────────────────────────────┐
  │                                               │
  ▼                                               ▼
identity-service (3001)         marketplace-service (3003)
payment-service (3006)          comms-service (3007)
oversight-service (3010)        infrastructure-service (3012)
       │
       ▼
  PostgreSQL 16 (shared server, each service owns its schema tables)
       │
       ▼
  Redis 7 (optional — cache, BullMQ queues, token blacklist, rate-limit)
       │
       ▼
  Kafka (optional — event bus, enabled at Level 4+)
```

### Supporting Services

| Service | Port (internal) | Docker Profile | Purpose |
|---------|----------------|----------------|---------|
| email-service | 4000 | `email` | SMTP delivery via Nodemailer — graceful degradation if unconfigured |
| sms-service | 5000 | `sms` | SMS/OTP delivery — stub-ready |

---

# 4. Microservices

The platform uses **6 backend microservices** (merged from original 13 for operational simplicity):

| Service | Port | Merged From | Primary Responsibilities |
|---------|------|-------------|--------------------------|
| **identity-service** | 3001 | auth + user + provider | Authentication (JWT, OAuth, OTP, 2FA, magic links, Apple), user profiles, provider management, RBAC |
| **marketplace-service** | 3003 | request + proposal + job + review | Service requests, proposals/bidding, job lifecycle, reviews, aggregates |
| **payment-service** | 3006 | — | Payments (multi-gateway), refunds, subscriptions, pricing plans, saved methods, webhooks, coupons |
| **comms-service** | 3007 | notification + messaging | Real-time chat (Socket.IO), in-app notifications, email/SMS dispatch, device tokens, preferences |
| **oversight-service** | 3010 | admin + analytics | Admin actions, user management, disputes, audit logs, daily metrics, system settings |
| **infrastructure-service** | 3012 | — | Feature flags, rate limits, background jobs, event store, DLQ management |

Each service:
- exposes REST APIs under its own prefix
- owns its PostgreSQL tables exclusively
- runs in a Docker container with independent lockfile (`pnpm-lock.yaml`)
- communicates with other services only via HTTP or Kafka events
- implements BullMQ queues for all async background work

---

# 5. Database Schema

The platform uses a **production-grade PostgreSQL 16 schema with ~45 tables** from day one.

### Ownership Map (summary)

| Service | Tables |
|---------|--------|
| identity-service | users, sessions, email_verification_tokens, password_reset_tokens, login_attempts, social_accounts, user_devices, providers, provider_services, provider_availability, favorites, locations |
| marketplace-service | service_requests, service_categories, service_request_search, proposals, jobs, reviews |
| payment-service | payments, refunds, payment_webhooks, coupons, coupon_usage |
| comms-service | notifications, notification_deliveries, messages, attachments |
| oversight-service | admin_actions, disputes, audit_logs, system_settings, user_activity_logs, daily_metrics |
| infrastructure-service | events, background_jobs, rate_limits, feature_flags |

> **Rule:** No service may JOIN across boundary. Cross-boundary data is fetched via internal API calls.

---

# 6. Authentication & Security Architecture

```
Client
  │ POST /api/v1/user/auth/login
  ▼
API Gateway
  │ No auth required for /user/auth/* routes
  ▼
identity-service AuthController
  │ bcrypt.compare(password, hash)
  │ issue: accessToken (JWT 15 min) + refreshToken (JWT 7 days, stored in DB + Redis)
  ▼
Client stores tokens (httpOnly cookie or Authorization header)

Subsequent requests:
  Client → API Gateway → JWT middleware → verifyToken → attach user to req → forward to service
  
  On logout:
  identity-service → token added to Redis blacklist (TTL = remaining JWT TTL)
  All active tokens for device invalidated immediately
```

### Security Controls Implemented

| Control | Implementation |
|---------|---------------|
| Password hashing | bcrypt (cost factor 12) |
| JWT access tokens | RS256 or HS256, 15-min TTL |
| JWT refresh tokens | Stored in `sessions` table + Redis, 7-day TTL |
| Token revocation | Redis blacklist — immediate logout across all services |
| Rate limiting | Gateway: express-rate-limit; Auth routes: stricter `auth-rate-limit.middleware` |
| 2FA (TOTP) | Authenticator-app QR code + backup codes |
| OAuth | Google, Facebook, Apple (mobile + web) |
| OTP | Phone (SMS) + Email OTP login |
| Magic links | Time-limited JWT links via email |
| Login attempt tracking | `login_attempts` table; lockout after threshold |
| Device tracking | `user_devices` table (Level 5+) |
| Structured logging | Winston JSON; request_id, user_id, action in every log line |
| Sentry error tracking | Integrated in api-gateway |
| RBAC | Roles + permissions stored in DB; RBAC controller in identity-service |
| Security headers (frontend) | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |

---

# 7. Background Jobs (BullMQ)

All 6 services use BullMQ (`@nestjs/bullmq`) for async work.

| Service | Queues | Repeatable Jobs |
|---------|--------|----------------|
| identity-service | email-verification, password-reset, session-cleanup, token-cleanup | token-cleanup, session-cleanup |
| marketplace-service | request-notifications, proposal-notifications | — |
| payment-service | payment-processing, refund-processing, subscription-renewal | subscription-renewal |
| comms-service | email-delivery, sms-delivery, push-notification | — |
| oversight-service | analytics-aggregation, audit-log-cleanup | daily-metrics |
| infrastructure-service | event-processing, job-queue, dlq-retry | — |

Workers run in **separate Docker containers** (profile: `workers`) to keep API containers lean.

---

# 8. Real-time Architecture (Socket.IO)

`comms-service` hosts a Socket.IO server for:
- Bi-directional chat messages
- Live notification push
- Job status updates

The frontend uses `socket.io-client@4.8.3`.

---

# 9. Scaling Levels

| Level | Users | Extra Infrastructure | Compose File |
|-------|-------|---------------------|--------------|
| 1 MVP | 0–500 | None (Postgres only) | `docker-compose.yml` |
| 2 Cache | 500–2k | + Redis | `docker-compose.level2.yml` |
| 3 Workers | 2k–10k | + BullMQ workers | `docker-compose.level3.yml` |
| 4 Events | 10k–50k | + Kafka | `docker-compose.level4.yml` |
| 5 Full Scale | 50k+ | + K8s replicas, Elasticsearch | `docker-compose.level5.yml` |

Feature flags control behaviour at each level. Services degrade gracefully when a flag is `false`.

---

# 10. CI/CD & Code Quality

| Item | Tool |
|------|------|
| PR review automation | `.github/workflows/copilot-pr-review.yml` — requests Copilot review via GitHub API |
| Build validation | `.github/workflows/pr.yml` |
| Linting | ESLint + TypeScript strict mode across all services |
| TypeScript | `"ignoreDeprecations": "6.0"` for Node 20 compatibility |
| Lockfiles | Per-service standalone `pnpm-lock.yaml` (`--ignore-workspace`) |
| Docker builds | Multi-stage Dockerfiles; 3-attempt corepack retry for resilience |


Schema file:

```
database/schema.sql
```

This schema must **not change across scaling stages**.

All schema changes must be handled through **migrations**.

---

# 6. Microservice Data Ownership

Each service owns specific tables.

Service boundaries are defined in:

```
docs/MICROSERVICE_BOUNDARY_MAP.md
```

Rules:

- Services may only directly access their own tables
- Cross-service data access must occur via APIs or events
- Shared tables must have a clearly defined owner

---

# 7. Database Optimization

Primary keys use UUID.

Important indexes include:

service_requests(user_id)
service_requests(category_id)
proposals(request_id)
jobs(provider_id)
reviews(provider_id)
notifications(user_id)
messages(job_id)
payments(job_id)

All list APIs must support pagination.

Example:

```
GET /requests?limit=20&cursor=xyz
```

Avoid cross-service joins.

---

# 8. API Gateway

An API gateway should be deployed early.

Responsibilities:

- request routing
- authentication middleware
- rate limiting
- request logging
- response caching

Common implementations:

NGINX
Envoy
Kong

---

# 9. Dockerized Services

Every backend service must include a Dockerfile.

Example Node Dockerfile

```
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm","run","start"]
```

Example Go Dockerfile

```
FROM golang:1.22-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o server

EXPOSE 3000

CMD ["./server"]
```

---

# 10. Local Development Environment

Local development uses Docker Compose.

Configuration file:

```
docker/docker-compose.yml
```

Core services:

PostgreSQL
Redis (optional)
API Gateway (port 3700)
identity-service
marketplace-service
payment-service
comms-service
oversight-service

---

# 11. Running the Platform Locally

Start services

```
docker compose up --build
```

Run in background

```
docker compose up -d
```

Stop services

```
docker compose down
```

---

# 12. Scaling Strategy

The system supports **five scaling levels**.

---

## Level 1 – MVP

Infrastructure

Frontend → Vercel
Backend → API services
Database → PostgreSQL

Capacity

200–350 concurrent users

---

## Level 2 – Cache Layer

Enable Redis caching.

Benefits

Reduced database load
Faster responses

Capacity

500–1000 concurrent users

---

## Level 3 – Worker Layer

Enable background workers.

Workers handle:

email notifications
analytics processing
payment retries
notification delivery

Capacity

2000+ concurrent users

---

## Level 4 – Event Driven Architecture

Enable Kafka event streaming.

Example events:

request_created
proposal_submitted
job_started
payment_completed
review_submitted

Capacity

10k+ concurrent users

---

## Level 5 – Distributed Platform

Add:

Kubernetes
CDN
Elasticsearch
Redis cluster
Database read replicas

Capacity

50k+ concurrent users

---

# 13. Observability

Monitoring stack should include:

Prometheus
Grafana
OpenTelemetry
Centralized logging

---

# 14. Security Requirements

Passwords must be hashed using bcrypt.

Authentication uses JWT tokens.

Security features:

email verification
password reset
login rate limiting
audit logs
device tracking

Sensitive actions must be logged in audit_logs.

---

# 15. Development Guidelines

Use UUID primary keys.

Always paginate large queries.

Avoid cross-service database access.

Communicate between services using APIs or events.

Cache frequently accessed data.

Keep services loosely coupled.

---

# 16. Repository Structure

```
marketplace-platform

frontend
 └── nextjs-app

gateway
 └── api-gateway

services
 ├── identity-service
 ├── marketplace-service
 ├── payment-service
 ├── comms-service
 ├── oversight-service
 └── infrastructure-service

workers
 └── background-worker

database
 ├── schema.sql
 └── migrations

docker
 └── docker-compose.yml

docs
 ├── ARCHITECTURE.md
 ├── MICROSERVICE_BOUNDARY_MAP.md
 └── SCALING_STRATEGY.md
```

---

# 17. Architecture Guarantee

This architecture ensures:

- one-time service development
- stable database schema
- infrastructure-driven scaling
- minimal service coupling

The system can scale from **MVP to large distributed platform without service rewrites**.

---

End of Architecture Guide
