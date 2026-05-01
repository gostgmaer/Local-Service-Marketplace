# Environment Variables Configuration Guide

Complete reference for every environment variable used across the Local Service Marketplace platform.

---

## Table of Contents

1. [Quick Setup](#1-quick-setup)
2. [Critical Security Variables](#2-critical-security-variables)
3. [Root / Docker Compose Variables (docker.env)](#3-root--docker-compose-variables-dockerenv)
4. [API Gateway](#4-api-gateway)
5. [identity-service](#5-identity-service)
6. [marketplace-service](#6-marketplace-service)
7. [payment-service](#7-payment-service)
8. [comms-service](#8-comms-service)
9. [oversight-service](#9-oversight-service)
10. [infrastructure-service](#10-infrastructure-service)
11. [Frontend (Next.js)](#11-frontend-nextjs)
12. [Shared Variables (All Backend Services)](#12-shared-variables-all-backend-services)
13. [Feature Flags Reference](#13-feature-flags-reference)
14. [Scaling Levels Reference](#14-scaling-levels-reference)
15. [Verification Checklist](#15-verification-checklist)
16. [Production Deployment Guide](#16-production-deployment-guide)

---

## 1. Quick Setup

### Step 1 — Copy example files

```powershell
# Copy all .env.example to .env in every service and api-gateway
Get-ChildItem -Path "." -Filter ".env.example" -Recurse |
  Where-Object { $_.FullName -notmatch "node_modules" } |
  ForEach-Object { Copy-Item $_.FullName (Join-Path $_.DirectoryName ".env") }
```

Or use the setup script:

```powershell
.\scripts\setup-env-files.ps1
```

### Step 2 — Generate critical secrets

```bash
# Windows (PowerShell) — requires Git Bash / WSL / OpenSSL for Windows
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET (different value!)
openssl rand -base64 48   # GATEWAY_INTERNAL_SECRET
openssl rand -base64 64   # ENCRYPTION_KEY
openssl rand -base64 32   # SESSION_SECRET
```

### Step 3 — Set secrets in docker.env

```env
# docker.env (used by Docker Compose — never committed to git)
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated, different from JWT_SECRET>
GATEWAY_INTERNAL_SECRET=<generated>
ENCRYPTION_KEY=<generated>
SESSION_SECRET=<generated>
```

### Step 4 — Verify

```powershell
.\scripts\check-env.ps1
```

---

## 2. Critical Security Variables

These variables **must** be set before starting the platform. Leaving them as defaults is a security risk.

| Variable | Required In | Must Match? | Purpose |
|----------|------------|-------------|---------|
| `JWT_SECRET` | api-gateway, identity-service | **YES — same value** | Sign & verify JWT access tokens |
| `JWT_REFRESH_SECRET` | identity-service | No (must be **different** from JWT_SECRET) | Sign refresh tokens |
| `GATEWAY_INTERNAL_SECRET` | api-gateway, identity-service, oversight-service | **YES — same value** | Service-to-service auth for /auth/verify |
| `ENCRYPTION_KEY` | identity-service, docker.env | No | Encrypt sensitive fields at rest |
| `SESSION_SECRET` | docker.env, frontend | No | Session/NextAuth signing |
| `DATABASE_PASSWORD` | All services | **YES — same value** | PostgreSQL authentication |

### Generating secrets

```bash
# JWT_SECRET — minimum 32 chars, recommend 48+ base64
openssl rand -base64 48

# ENCRYPTION_KEY — recommend 64+ base64
openssl rand -base64 64

# SESSION_SECRET — 32 base64
openssl rand -base64 32
```

### TOKEN_VALIDATION_STRATEGY

Controls how the API Gateway validates Bearer tokens:

| Strategy | Latency | Security | When to Use |
|----------|---------|----------|-------------|
| `local` | 1–5ms | Good | Default; fast, offline JWT verification |
| `api` | 10–50ms | Best | When you need real-time user status checks or token revocation |

```env
TOKEN_VALIDATION_STRATEGY=local   # or `api`
```

---

## 3. Root / Docker Compose Variables (`docker.env`)

`docker.env` is loaded by `docker-compose.yml` and distributes variables to all containers. It is `.gitignored` and must never be committed.

### Resource Limits

```env
# CPU fractions (0.25 = quarter core, 1.0 = full core)
# MEM in Docker units (256M, 512M, 1G)
#
# Base service defaults:
# CPU_DB=0.5        MEM_DB=384M
# CPU_REDIS=0.05    MEM_REDIS=64M
# CPU_IDENTITY=0.25
# CPU_MARKETPLACE=0.25
# CPU_PAYMENT=0.15
# CPU_COMMS=0.15
# CPU_OVERSIGHT=0.15
# CPU_INFRA=0.1
# CPU_GATEWAY=0.25
# CPU_FRONTEND=0.1  MEM_FRONTEND=160M
# MEM_SERVICE=256M  # shared NestJS default

# Worker overrides (_W suffix, used at Level 3+):
# CPU_IDENTITY_W=0.5   MEM_SERVICE_W=256M
```

### Database

```env
DATABASE_HOST=postgres          # Always `postgres` inside Docker
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=<strong-password>    # CHANGE IN PRODUCTION
DATABASE_NAME=marketplace
DATABASE_URL=postgresql://postgres:<password>@postgres:5432/marketplace

POSTGRES_USER=postgres          # Passed to the postgres container
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=marketplace

DB_POOL_MAX=10
DB_POOL_MIN=2

# SSL — set to true for cloud-managed databases (AWS RDS, GCP Cloud SQL, etc.)
DATABASE_SSL=false
```

### Security & JWT

```env
JWT_SECRET=<generated — min 32 chars>
JWT_REFRESH_SECRET=<generated — different from JWT_SECRET>
GATEWAY_INTERNAL_SECRET=<generated>
TOKEN_VALIDATION_STRATEGY=local

# Session Secret — used by NextAuth and session management
SESSION_SECRET=<generated — min 32 chars>

# Encryption Key — encrypts sensitive fields at rest (OAuth tokens, payment tokens)
ENCRYPTION_KEY=<generated — min 64 chars>
```

### Redis

```env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<leave empty for dev, set for production>
```

### Kafka & Zookeeper (Optional)

```env
KAFKA_BROKERS=kafka:29092          # Internal Docker address
KAFKA_CLIENT_ID=marketplace-service
ZOOKEEPER_HOST=zookeeper
ZOOKEEPER_PORT=2181
```

### Compose Profiles

Controls which optional infrastructure layers start:

```env
# Common setups:
COMPOSE_PROFILES=workers               # Redis + background workers (recommended for dev)
COMPOSE_PROFILES=workers,frontend      # + Next.js frontend container
COMPOSE_PROFILES=workers,pooling       # + PgBouncer connection pooler
COMPOSE_PROFILES=workers,infrastructure # + infrastructure-service
COMPOSE_PROFILES=workers,events        # + Kafka + Zookeeper
COMPOSE_PROFILES=full                  # Everything
```

| Profile | Starts | Scaling Level |
|---------|--------|--------------|
| `workers` | Redis + BullMQ workers in each service | Level 3 |
| `cache` | Redis only (no workers) | Level 2 |
| `pooling` | PgBouncer connection pooler | Any |
| `frontend` | Next.js frontend container | Any |
| `infrastructure` | infrastructure-service | Any |
| `events` | Kafka + Zookeeper | Level 4 |
| `scaling` | Redis + Kafka + PgBouncer + infra | Level 4 |
| `full` | All of the above | Level 5 |

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3700    # Public browser-facing API URL
INTERNAL_API_URL=http://api-gateway:3000    # Docker-internal SSR URL
NEXTAUTH_URL=http://localhost:3000           # Must match browser URL
AUTH_SECRET=<generated>                      # NextAuth secret
FRONTEND_PORT=3000
```

### Feature Flags

```env
CACHE_ENABLED=true             # Redis caching (Level 2+)
WORKERS_ENABLED=true           # BullMQ background workers (Level 3+)
EVENT_BUS_ENABLED=false        # Kafka event streaming (Level 4+)
BACKGROUND_JOBS_ENABLED=true   # infrastructure-service background jobs
RATE_LIMITING_ENABLED=true     # Rate limiting (always recommended)
FEATURE_FLAGS_ENABLED=true     # Feature flag system
```

### OAuth & External Services

```env
GOOGLE_CLIENT_ID=              # Optional: Google OAuth
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=               # Optional: Facebook OAuth
FACEBOOK_APP_SECRET=
FILE_UPLOAD_SERVICE_URL=https://your-file-service.example.com
```

---

## 4. API Gateway

**File:** `api-gateway/.env`
**Port:** 3700
**Template:** `api-gateway/.env.example`

```env
NODE_ENV=development
PORT=3700
SERVICE_NAME=api-gateway

# JWT & Auth
JWT_SECRET=<must match identity-service>
GATEWAY_INTERNAL_SECRET=<must match identity-service and oversight-service>
TOKEN_VALIDATION_STRATEGY=local    # `local` or `api`

# Downstream Service URLs
# Docker: use container names. Local: use localhost.
IDENTITY_SERVICE_URL=http://localhost:3001
MARKETPLACE_SERVICE_URL=http://localhost:3003
PAYMENT_SERVICE_URL=http://localhost:3006
COMMS_SERVICE_URL=http://localhost:3007
OVERSIGHT_SERVICE_URL=http://localhost:3010
INFRASTRUCTURE_SERVICE_URL=http://localhost:3012

# Legacy aliases (backward compatibility)
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3001
REQUEST_SERVICE_URL=http://localhost:3003
PROPOSAL_SERVICE_URL=http://localhost:3003
JOB_SERVICE_URL=http://localhost:3003
MESSAGING_SERVICE_URL=http://localhost:3007
NOTIFICATION_SERVICE_URL=http://localhost:3007
REVIEW_SERVICE_URL=http://localhost:3003
ADMIN_SERVICE_URL=http://localhost:3010
ANALYTICS_SERVICE_URL=http://localhost:3010

# External services (deployed separately)
FILE_UPLOAD_SERVICE_URL=https://your-file-service.example.com
EMAIL_SERVICE_URL=http://localhost:4000    # Docker: http://email-service:3500
SMS_SERVICE_URL=http://localhost:5000      # Docker: http://sms-service:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000        # 60 second window
RATE_LIMIT_MAX_REQUESTS=500       # requests per window per client

# CORS
CORS_ORIGIN=http://localhost:3000    # Comma-separate for multiple origins
FRONTEND_URL=http://localhost:3000

# Redis Rate Limiting
# false = in-memory counters (single-instance, fastest)
# true  = Redis-backed counters (shared across multiple gateway replicas)
REDIS_RATE_LIMIT_ENABLED=false
REDIS_HOST=                          # Only required if REDIS_RATE_LIMIT_ENABLED=true
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Feature Flags
ANALYTICS_ENABLED=false       # Enable /analytics/* routing to oversight-service
KAFKA_ENABLED=false           # Enable Kafka event publishing from gateway
INFRASTRUCTURE_ENABLED=false  # Enable /events/* /feature-flags/* routing
MESSAGING_ENABLED=false       # Enable /messages/* routing to comms-service

# Logging
LOG_LEVEL=info
REQUEST_TIMEOUT_MS=72000
```

---

## 5. identity-service

**File:** `services/identity-service/.env`
**Port:** 3001
**Template:** `services/identity-service/.env.example`
**Owns:** users, sessions, providers, tokens, social_accounts, login_attempts

```env
NODE_ENV=development
PORT=3001
SERVICE_NAME=identity-service

# Database
DATABASE_HOST=localhost    # Docker: pgbouncer
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=marketplace
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace
DB_POOL_MAX=10
DB_POOL_MIN=2
DATABASE_SSL=false         # true for cloud-managed DBs

# JWT
JWT_SECRET=<must match api-gateway>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different from JWT_SECRET>
JWT_REFRESH_EXPIRATION=90d
SESSION_TTL_DAYS=90

# Security
GATEWAY_INTERNAL_SECRET=<must match api-gateway>
ENCRYPTION_KEY=<generated — encrypts sensitive fields at rest>
SESSION_SECRET=<generated>

# Token Expiry
EMAIL_VERIFICATION_EXPIRES_IN=24h
PASSWORD_RESET_EXPIRES_IN=1h

# Rate Limiting
MAX_LOGIN_ATTEMPTS=5
LOGIN_ATTEMPT_WINDOW=15m

# Pagination
DEFAULT_PAGE_LIMIT=20
MAX_PAGE_LIMIT=100

# OAuth — Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3700/api/v1/user/auth/google/callback

# OAuth — Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:3700/api/v1/user/auth/facebook/callback

FRONTEND_URL=http://localhost:3000    # OAuth redirect target

# Service Communication
NOTIFICATION_SERVICE_URL=http://localhost:3007    # Docker: http://comms-service:3007

# SMS (Optional)
SMS_SERVICE_ENABLED=false
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Redis
REDIS_HOST=localhost    # Docker: redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Kafka (Optional)
KAFKA_BROKERS=localhost:9092    # Docker: kafka:29092
KAFKA_CLIENT_ID=identity-service

# Feature Flags
CACHE_ENABLED=false
EVENT_BUS_ENABLED=false
WORKERS_ENABLED=false
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
FILE_UPLOAD_SERVICE_URL=http://localhost:4100
FILE_DEFAULT_TENANT_ID=local-service-marketplace
REQUEST_TIMEOUT_MS=72000
```

---

## 6. marketplace-service

**File:** `services/marketplace-service/.env`
**Port:** 3003
**Template:** `services/marketplace-service/.env.example`
**Owns:** service_requests, proposals, jobs, reviews, service_categories

```env
NODE_ENV=development
PORT=3003
SERVICE_NAME=marketplace-service

# Database
DATABASE_HOST=localhost    # Docker: pgbouncer
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=marketplace
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace
DB_POOL_MAX=10
DB_POOL_MIN=2
DATABASE_SSL=false

# Pagination
DEFAULT_PAGE_LIMIT=20
MAX_PAGE_LIMIT=100

# Service Communication
USER_SERVICE_URL=http://localhost:3001          # Docker: http://identity-service:3001
AUTH_SERVICE_URL=http://localhost:3001
NOTIFICATION_SERVICE_URL=http://localhost:3007  # Docker: http://comms-service:3007

# Redis
REDIS_HOST=localhost    # Docker: redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Kafka (Optional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=marketplace-service

# Feature Flags
CACHE_ENABLED=false
EVENT_BUS_ENABLED=false
WORKERS_ENABLED=false
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
FILE_UPLOAD_SERVICE_URL=http://localhost:4100
FILE_DEFAULT_TENANT_ID=local-service-marketplace
REQUEST_TIMEOUT_MS=72000
```

---

## 7. payment-service

**File:** `services/payment-service/.env`
**Port:** 3006
**Template:** `services/payment-service/.env.example`
**Owns:** payments, refunds, payment_webhooks, coupons, pricing_plans, subscriptions

```env
NODE_ENV=development
PORT=3006
SERVICE_NAME=payment-service

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=marketplace
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace
DATABASE_POOL_MAX=10
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_CONNECTION_TIMEOUT_MS=10000
DATABASE_QUERY_TIMEOUT_MS=30000
DB_POOL_MAX=10
DB_POOL_MIN=2
DATABASE_SSL=false

# Pagination
DEFAULT_PAGE_LIMIT=20
MAX_PAGE_LIMIT=100

# Payment Gateway
# Select active gateway: mock | stripe | razorpay | paypal | payubiz | instamojo
# `mock` is safe for development and CI — no real charges
PAYMENT_GATEWAY=mock

# Stripe (set PAYMENT_GATEWAY=stripe)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_RETURN_URL=http://localhost:3000/payment/confirm

# Razorpay (set PAYMENT_GATEWAY=razorpay)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# PayPal (set PAYMENT_GATEWAY=paypal)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
PAYPAL_API_URL=https://api-m.sandbox.paypal.com    # Production: https://api-m.paypal.com

# PayUbiz / PayU India (set PAYMENT_GATEWAY=payubiz)
PAYU_KEY=your_payu_merchant_key
PAYU_SALT=your_payu_salt
PAYU_SUCCESS_URL=http://localhost:3006/webhooks/payubiz
PAYU_FAILURE_URL=http://localhost:3006/webhooks/payubiz
PAYU_API_URL=https://test.payu.in                  # Production: https://secure.payu.in

# Instamojo (set PAYMENT_GATEWAY=instamojo)
INSTAMOJO_API_KEY=your_instamojo_api_key
INSTAMOJO_AUTH_TOKEN=your_instamojo_auth_token
INSTAMOJO_SALT=your_instamojo_salt
INSTAMOJO_WEBHOOK_URL=http://localhost:3006/webhooks/instamojo
INSTAMOJO_REDIRECT_URL=http://localhost:3000/payment/confirm
INSTAMOJO_API_URL=https://test.instamojo.com       # Production: https://api.instamojo.com

# Service Communication
NOTIFICATION_SERVICE_URL=http://localhost:3007    # Docker: http://comms-service:3007

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Kafka (Optional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=payment-service

# Feature Flags
CACHE_ENABLED=false
EVENT_BUS_ENABLED=false
WORKERS_ENABLED=false
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
FILE_UPLOAD_SERVICE_URL=http://localhost:4100
FILE_DEFAULT_TENANT_ID=local-service-marketplace
REQUEST_TIMEOUT_MS=72000
```

---

## 8. comms-service

**File:** `services/comms-service/.env`
**Port:** 3007
**Template:** `services/comms-service/.env.example`
**Owns:** notifications, notification_deliveries, messages, attachments

```env
NODE_ENV=development
PORT=3007
SERVICE_NAME=comms-service

# Database
DATABASE_HOST=localhost    # Docker: pgbouncer
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=marketplace
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace
DB_POOL_MAX=10
DB_POOL_MIN=2
DATABASE_SSL=false

# Email Service
EMAIL_SERVICE_URL=http://localhost:4000    # Docker: http://email-service:3500
EMAIL_ENABLED=true

# SMS Service
SMS_SERVICE_URL=http://localhost:5000      # Docker: http://sms-service:3000
SMS_ENABLED=false
SMS_API_KEY=change-me-to-a-strong-random-secret

# Push Notifications (FCM / Firebase)
# Set FCM_ENABLED=true and provide Firebase credentials to enable push notifications
FCM_ENABLED=false
# Get credentials from: Firebase Console → Project Settings → Service Accounts
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
# Private key: base64-encoded string or raw JSON string (use \\n for newlines)
# Production: store this in a secrets manager, not in .env
FIREBASE_PRIVATE_KEY=base64_encoded_private_key_or_raw_json_string

# In-App / Push Feature Flags
IN_APP_NOTIFICATIONS_ENABLED=false
PUSH_NOTIFICATIONS_ENABLED=false
NOTIFICATION_PREFERENCES_ENABLED=false
DEVICE_TRACKING_ENABLED=false

# Redis
REDIS_HOST=localhost    # Docker: redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Kafka (Optional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=comms-service

# Feature Flags
CACHE_ENABLED=false
EVENT_BUS_ENABLED=false
WORKERS_ENABLED=false
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
FILE_UPLOAD_SERVICE_URL=http://localhost:4100
FILE_DEFAULT_TENANT_ID=local-service-marketplace
REQUEST_TIMEOUT_MS=72000
```

---

## 9. oversight-service

**File:** `services/oversight-service/.env`
**Port:** 3010
**Template:** `services/oversight-service/.env.example`
**Owns:** admin_actions, disputes, audit_logs, system_settings, user_activity_logs, daily_metrics

```env
NODE_ENV=development
PORT=3010
SERVICE_NAME=oversight-service

# Database
DATABASE_HOST=localhost    # Docker: pgbouncer
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=marketplace
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace
DB_POOL_MAX=10
DB_POOL_MIN=2
DATABASE_SSL=false

# Security
GATEWAY_INTERNAL_SECRET=<must match api-gateway and identity-service>

# Service Communication
AUTH_SERVICE_URL=http://localhost:3001    # Docker: http://identity-service:3001

# Redis
REDIS_HOST=localhost    # Docker: redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Kafka (Optional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=oversight-service

# Feature Flags
EVENT_BUS_ENABLED=false
WORKERS_ENABLED=false
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
FILE_UPLOAD_SERVICE_URL=http://localhost:4100
FILE_DEFAULT_TENANT_ID=local-service-marketplace
REQUEST_TIMEOUT_MS=72000
```

---

## 10. infrastructure-service

**File:** `services/infrastructure-service/.env`
**Port:** 3012
**Template:** `services/infrastructure-service/.env.example`
**Owns:** events, background_jobs, rate_limits, feature_flags
**Profile:** Started only when COMPOSE_PROFILES includes `infrastructure` or `full`

```env
NODE_ENV=development
PORT=3012
SERVICE_NAME=infrastructure-service

# Database
DATABASE_HOST=localhost    # Docker: pgbouncer
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=marketplace
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace
DB_POOL_MAX=10
DB_POOL_MIN=2
DATABASE_SSL=false

# Redis (Required when CACHE_ENABLED or WORKERS_ENABLED)
REDIS_HOST=localhost    # Docker: redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# Kafka (Optional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=infrastructure-service

# Feature Flags
CACHE_ENABLED=false
EVENT_BUS_ENABLED=false
BACKGROUND_JOBS_ENABLED=false
RATE_LIMITING_ENABLED=true
FEATURE_FLAGS_ENABLED=true
WORKERS_ENABLED=false
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
FILE_UPLOAD_SERVICE_URL=http://localhost:4100
FILE_DEFAULT_TENANT_ID=local-service-marketplace
REQUEST_TIMEOUT_MS=72000
```

---

## 11. Frontend (Next.js)

**File:** `frontend/.env.local`
**Port:** 3000

```env
# Public — baked into browser bundle at build time
NEXT_PUBLIC_API_URL=http://localhost:3700        # Must be reachable from user's browser
NEXT_PUBLIC_APP_NAME=Local Service Marketplace
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3007     # comms-service Socket.IO endpoint

# Server-side only (Next.js SSR / API routes inside Docker)
INTERNAL_API_URL=http://api-gateway:3000

# NextAuth / Auth.js
NEXTAUTH_URL=http://localhost:3000               # Must match the URL users access the app on
AUTH_SECRET=<same as SESSION_SECRET>             # Generate: openssl rand -base64 32
NEXTAUTH_SECRET=<same as AUTH_SECRET>

# Google OAuth (if using Google Sign-In on frontend)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

NODE_ENV=development
```

---

## 12. Shared Variables (All Backend Services)

Every NestJS backend service uses these common variables:

| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `PORT` | service-specific | See port table in README |
| `SERVICE_NAME` | service-specific | Used in structured logs |
| `DATABASE_HOST` | `localhost` | `pgbouncer` inside Docker |
| `DATABASE_PORT` | `5432` | |
| `DATABASE_USER` | `postgres` | |
| `DATABASE_PASSWORD` | `postgres` | **Change in production** |
| `DATABASE_NAME` | `marketplace` | All services share one DB |
| `DATABASE_URL` | derived | Full connection string |
| `DATABASE_SSL` | `false` | `true` for cloud-managed DBs |
| `DB_POOL_MAX` | `10` | PgBouncer multiplexes these |
| `DB_POOL_MIN` | `2` | |
| `REDIS_HOST` | `localhost` | `redis` inside Docker |
| `REDIS_PORT` | `6379` | |
| `REDIS_PASSWORD` | `` | Set for Redis AUTH |
| `REDIS_URL` | `redis://localhost:6379` | Alternative to host/port |
| `KAFKA_BROKERS` | `localhost:9092` | `kafka:29092` inside Docker |
| `KAFKA_CLIENT_ID` | service name | Unique per service |
| `CACHE_ENABLED` | `false` | Enable Redis caching |
| `EVENT_BUS_ENABLED` | `false` | Enable Kafka events |
| `WORKERS_ENABLED` | `false` | Enable BullMQ workers |
| `WORKER_CONCURRENCY` | `5` | Worker threads per queue |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `REQUEST_TIMEOUT_MS` | `72000` | HTTP client timeout (ms) |
| `FILE_UPLOAD_SERVICE_URL` | `http://localhost:4100` | File upload microservice |
| `FILE_DEFAULT_TENANT_ID` | `local-service-marketplace` | Multi-tenant file isolation |
| `DEFAULT_PAGE_LIMIT` | `20` | Default pagination size |
| `MAX_PAGE_LIMIT` | `100` | Maximum allowed page size |

### Docker vs Local values

| Variable | Local Dev | Inside Docker |
|----------|-----------|---------------|
| `DATABASE_HOST` | `localhost` | `pgbouncer` (or `postgres`) |
| `REDIS_HOST` | `localhost` | `redis` |
| `KAFKA_BROKERS` | `localhost:9092` | `kafka:29092` |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:3007` | `http://comms-service:3007` |
| `AUTH_SERVICE_URL` | `http://localhost:3001` | `http://identity-service:3001` |

---

## 13. Feature Flags Reference

| Flag | Scope | Default | Effect When `true` |
|------|-------|---------|-------------------|
| `CACHE_ENABLED` | All services | `false` | Enables Redis caching |
| `WORKERS_ENABLED` | All services | `false` | Starts BullMQ worker processors |
| `EVENT_BUS_ENABLED` | All services | `false` | Publishes/subscribes Kafka topics |
| `BACKGROUND_JOBS_ENABLED` | infrastructure-service | `false` | Enables scheduled background jobs |
| `RATE_LIMITING_ENABLED` | All services | `true` | Enforces per-IP/user rate limits |
| `FEATURE_FLAGS_ENABLED` | All services | `true` | Enables runtime feature flag checks |
| `WORKER_CONCURRENCY` | All services | `5` | Concurrent jobs per queue |
| `REDIS_RATE_LIMIT_ENABLED` | api-gateway | `false` | Shares rate limits across replicas |
| `ANALYTICS_ENABLED` | api-gateway | `false` | Enables /analytics/* route |
| `KAFKA_ENABLED` | api-gateway | `false` | Gateway publishes Kafka events |
| `INFRASTRUCTURE_ENABLED` | api-gateway | `false` | Enables /events/* and /feature-flags/* |
| `MESSAGING_ENABLED` | api-gateway | `false` | Enables /messages/* route |
| `FCM_ENABLED` | comms-service | `false` | Firebase push notifications |
| `SMS_ENABLED` | comms-service | `false` | SMS delivery via sms-service |
| `EMAIL_ENABLED` | comms-service | `true` | Email delivery via email-service |
| `IN_APP_NOTIFICATIONS_ENABLED` | comms-service | `false` | Stores in-app notifications |
| `PUSH_NOTIFICATIONS_ENABLED` | comms-service | `false` | Sends FCM push messages |

---

## 14. Scaling Levels Reference

| Level | COMPOSE_PROFILES | Feature Flags | Memory | Concurrent Users |
|-------|-----------------|---------------|--------|-----------------|
| **1 — MVP** | _(none)_ | All disabled | ~3–5 GB | 200–350 |
| **2 — Cache** | `cache` | `CACHE_ENABLED=true` | ~4–6 GB | 500–1K |
| **3 — Workers** | `workers` | `CACHE_ENABLED=true`, `WORKERS_ENABLED=true` | ~5–7 GB | 2K+ |
| **4 — Events** | `workers,events` | All above + `EVENT_BUS_ENABLED=true` | ~8–10 GB | 10K+ |
| **5 — Full Scale** | `full` | All enabled | ~12–16 GB | 50K+ |

---

## 15. Verification Checklist

```powershell
.\scripts\check-env.ps1
```

### Manual Checks

- [ ] `JWT_SECRET` is identical in `api-gateway/.env` and `services/identity-service/.env`
- [ ] `GATEWAY_INTERNAL_SECRET` is identical in `api-gateway/.env`, `services/identity-service/.env`, and `services/oversight-service/.env`
- [ ] `JWT_REFRESH_SECRET` is **different** from `JWT_SECRET`
- [ ] `ENCRYPTION_KEY` is set (64+ chars)
- [ ] `SESSION_SECRET` is set (32+ chars)
- [ ] All secrets are at least 32 characters and not placeholder values
- [ ] `DATABASE_PASSWORD` changed from `postgres` in production
- [ ] `CORS_ORIGIN` contains only your production domain (not `*`)
- [ ] `FRONTEND_URL` points to the correct frontend origin
- [ ] `NODE_ENV=production` set in all services for production
- [ ] `DATABASE_SSL=true` set for cloud-managed databases
- [ ] Redis password set (`REDIS_PASSWORD`) in production
- [ ] No `.env` files committed to git (only `.env.example` files)

---

## 16. Production Deployment Guide

### Generate all secrets

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
echo "GATEWAY_INTERNAL_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 64)"
echo "SESSION_SECRET=$(openssl rand -base64 32)"
echo "DATABASE_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
```

### Update service URLs

Replace all `localhost` references with production container names or domain:

```env
# Docker Compose production
IDENTITY_SERVICE_URL=http://identity-service:3001
DATABASE_HOST=pgbouncer
REDIS_HOST=redis
KAFKA_BROKERS=kafka:29092
```

### Enable SSL

```env
DATABASE_SSL=true        # Required for AWS RDS, GCP Cloud SQL, Azure Flexible Server
NODE_ENV=production      # In all services
```

### Configure real providers

```env
# Email
EMAIL_HOST=smtp.sendgrid.net
EMAIL_USER=apikey
EMAIL_PASS=<SendGrid API key>

# SMS
SMS_SERVICE_ENABLED=true
TWILIO_ACCOUNT_SID=<your SID>
TWILIO_AUTH_TOKEN=<your token>
TWILIO_PHONE_NUMBER=<your number>

# Push notifications
FCM_ENABLED=true
FIREBASE_PROJECT_ID=<your-project>
FIREBASE_CLIENT_EMAIL=<service account email>
FIREBASE_PRIVATE_KEY=<base64-encoded private key>

# Payment
PAYMENT_GATEWAY=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Use a secrets manager in production

Never put production secrets in files committed to source control. Use:

| Platform | Solution |
|----------|----------|
| **AWS** | AWS Secrets Manager + ECS task role |
| **GCP** | Secret Manager + Workload Identity |
| **Azure** | Key Vault + Managed Identity |
| **Kubernetes** | Kubernetes Secrets (encrypted at rest) |
| **Render** | Environment Variables in dashboard |
| **Railway** | Variables in project settings |
| **Docker Compose** | External `.env` on server, never in repo |

### Required GitHub Secrets (for CI/CD)

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Frontend deployment |
| `VERCEL_ORG_ID` | Vercel organization |
| `VERCEL_PROJECT_ID` | Vercel project |
| `RENDER_DEPLOY_HOOK_IDENTITY` | identity-service deploy trigger |
| `RENDER_DEPLOY_HOOK_MARKETPLACE` | marketplace-service deploy trigger |
| `RENDER_DEPLOY_HOOK_PAYMENT` | payment-service deploy trigger |
| `RENDER_DEPLOY_HOOK_COMMS` | comms-service deploy trigger |
| `RENDER_DEPLOY_HOOK_OVERSIGHT` | oversight-service deploy trigger |
| `RENDER_DEPLOY_HOOK_INFRASTRUCTURE` | infrastructure-service deploy trigger |
| `RENDER_DEPLOY_HOOK_API_GATEWAY` | api-gateway deploy trigger |
