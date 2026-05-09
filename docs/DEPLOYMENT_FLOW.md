# Deployment Flow — Local Service Marketplace

Complete reference for code flow, build flow, and deployment flow.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Code Flow](#2-code-flow)
3. [Build Flow](#3-build-flow)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Deployment Flow (Production)](#5-deployment-flow-production)
6. [Secrets Management](#6-secrets-management)
7. [Database Lifecycle](#7-database-lifecycle)
8. [First Deploy Checklist](#8-first-deploy-checklist)
9. [Day-to-Day Developer Workflow](#9-day-to-day-developer-workflow)
10. [Rollback](#10-rollback)

---

## 1. Architecture Overview

```
Browser / Mobile App
        │
        ▼
  [ Traefik ] ← TLS termination, routing by subdomain
        │
        ▼
  [ API Gateway :3700 ] ← JWT validation, rate limiting, request routing
        │
   ┌────┴────────────────────────────────┐
   │             Microservices           │
   ├─ identity-service     :3001         │
   ├─ marketplace-service  :3003         │
   ├─ payment-service      :3006         │
   ├─ comms-service        :3007         │
   ├─ oversight-service    :3010         │
   └─ infrastructure-service :3012       │
        │
   ┌────┴──────────────────┐
   │  Shared Infrastructure │
   ├─ PostgreSQL  :5432     │
   └─ Redis       :6379     │
```

All services communicate via Docker internal DNS (e.g. `http://identity-service:3001`). No cross-service database joins — services call each other's HTTP APIs.

---

## 2. Code Flow

### Request lifecycle (API call)

```
1. Client sends HTTP request to https://lsp-api.easydev.in/api/v1/...

2. Traefik receives request
   - Terminates TLS (Let's Encrypt cert)
   - Routes to api-gateway:3700 based on subdomain rule

3. API Gateway (NestJS, port 3700)
   - Rate limiting check (Redis)
   - JWT validation via GET /auth/verify → identity-service:3001
   - Strips internal headers
   - Proxies to target microservice

4. Target Microservice (NestJS)
   - Controller validates DTO (class-validator)
   - Service executes business logic
   - Repository executes parameterized SQL (PostgreSQL)
   - Returns JSON response

5. Response travels back through Gateway → Traefik → Client
```

### Authentication flow

```
POST /api/v1/user/auth/login
        │
        ▼
  identity-service
   ├─ Validates credentials against users table (bcrypt compare)
   ├─ Checks login_attempts table (lockout after 5 failures)
   ├─ Creates session in sessions table
   └─ Returns { accessToken, refreshToken, user }

Every subsequent request:
  Authorization: Bearer <accessToken>
        │
        ▼
  API Gateway → GET http://identity-service:3001/auth/verify
        │
        ▼
  identity-service validates token, returns { userId, role }
        │
        ▼
  Gateway injects X-User-Id, X-User-Role headers → target service
```

### Service ownership

| Domain | Service | Owns Tables |
|--------|---------|-------------|
| Auth, Users, Providers | identity-service | users, sessions, providers, provider_services, locations, favorites |
| Requests, Jobs, Reviews | marketplace-service | service_requests, proposals, jobs, reviews, service_categories |
| Payments | payment-service | payments, refunds, coupons |
| Notifications, Messaging | comms-service | notifications, messages, attachments |
| Admin, Analytics | oversight-service | admin_actions, disputes, audit_logs, system_settings |
| Events, Feature Flags | infrastructure-service | events, feature_flags, background_jobs, rate_limits |

---

## 3. Build Flow

### Local build

```
pnpm install          # installs all workspace dependencies
pnpm build:all        # builds all services (tsc compile via nest build)
```

Each service produces `dist/` with compiled JS from TypeScript.

### Docker image build (per service)

```
Dockerfile (each service):
  FROM node:20-alpine AS builder
    COPY package.json pnpm-lock.yaml
    RUN pnpm install --frozen-lockfile
    COPY src/
    RUN pnpm build          # nest build → dist/

  FROM node:20-alpine AS production
    COPY --from=builder dist/
    COPY --from=builder node_modules/
    CMD ["node", "dist/main"]
```

### GitHub Actions build (CI → build-and-push)

```
For each service in parallel:
  1. Checkout code
  2. pnpm install --frozen-lockfile
  3. ESLint
  4. TypeScript typecheck
  5. Jest unit tests (--passWithNoTests)
  6. Trivy security scan (HIGH + CRITICAL vulnerabilities → fails build)
  7. docker buildx build --platform linux/arm64
  8. Push to ghcr.io/gostgmaer/lsp-<service>:latest
               ghcr.io/gostgmaer/lsp-<service>:<git-sha>
```

Images are **ARM64 native** (for Oracle Cloud ARM instance). Built on `ubuntu-24.04-arm` runner to avoid QEMU emulation crashes.

---

## 4. CI/CD Pipeline

File: `.github/workflows/deploy-backend-arm.yml`

### Triggers

| Trigger | When |
|---------|------|
| Auto | Every push to `master` or `main` |
| Manual | GitHub → Actions → Run workflow (with optional inputs) |

### Manual inputs (workflow_dispatch)

| Input | Default | Effect |
|-------|---------|--------|
| `run_seed` | false | Runs `database/seed.js` after deploy — creates categories, feature flags, system settings |
| `skip_migrations` | false | Skips DB migrations (use for hotfixes only) |
| `force_clean_cache` | false | Bypasses pnpm + Docker layer cache for a full clean build |

### Job sequence

```
push to master
      │
      ▼
 ┌──────────────────────────────────────────┐
 │  Job 1: ci  (7 parallel matrix jobs)     │
 │  ┌─────────────────────────────────────┐ │
 │  │ identity-service  │ lint+test+trivy │ │
 │  │ marketplace-service│               │ │
 │  │ payment-service   │               │ │
 │  │ comms-service     │               │ │
 │  │ oversight-service │               │ │
 │  │ infrastructure-service│           │ │
 │  │ api-gateway       │               │ │
 │  └─────────────────────────────────────┘ │
 └──────────────────────────────────────────┘
      │  (all must pass)
      ▼
 ┌──────────────────────────────────────────┐
 │  Job 2: build-and-push (6 parallel)      │
 │  Builds ARM64 Docker images → GHCR       │
 └──────────────────────────────────────────┘
      │
      ▼
 ┌──────────────────────────────────────────┐
 │  Job 3: deploy-and-release               │
 │  1. Validate SSH + GHCR secrets          │
 │  2. git archive → release.tgz            │
 │  3. Generate docker.env from GH Secrets  │
 │  4. SCP release.tgz → server             │
 │  5. SCP docker.env → server              │
 │  6. SSH: extract, migrate, deploy        │
 │  7. SSH: seed (if run_seed=true)         │
 │  8. Create GitHub Release                │
 └──────────────────────────────────────────┘
```

---

## 5. Deployment Flow (Production)

### Server-side deploy script: `scripts/deploy-production-worker.sh`

Executed on the Oracle Cloud ARM server via SSH:

```
Step 1 — Extract release archive
  mkdir ~/Local-Service-Marketplace.stage-<run_id>
  tar -xzf release.tgz -C stage/

Step 2 — Place docker.env
  If docker.env.from-gha exists (uploaded by GHA) → use it
  Else fall back to existing ~/Local-Service-Marketplace/docker.env

Step 3 — Atomic swap (blue-green style)
  Backup current: mv app/ app.backup-<run_id>
  Promote stage:  mv stage/ app/

Step 4 — Pull Docker images from GHCR
  docker compose pull (all services)

Step 5 — Start infrastructure
  docker compose up -d postgres redis

Step 6 — Wait for PostgreSQL + Redis health

Step 7 — Schema + migrations
  If users table missing → apply database/schema.sql (full schema)
  Else run database/migrate.js (incremental migrations only)
  Uses pg_advisory_lock(99) to prevent concurrent migration runs

Step 8 — Bootstrap admin users
  Upserts SUPER_ADMIN + ADMIN from env vars via SQL
  Creates RBAC roles + permissions if missing

Step 9 — Start all services
  docker compose up -d identity-service marketplace-service
                        payment-service comms-service
                        oversight-service api-gateway

Step 10 — Health check all services
  GET /health on each service (timeout 5 min)

Step 11 — Cleanup old images
  docker image prune -f

If any step fails → automatic rollback to backup
```

### docker.env generation (in GitHub Actions)

Every deploy generates a fresh `docker.env` from GitHub Secrets + Variables:

```
GitHub Secrets (write-only, sensitive) → plain values in docker.env
GitHub Variables (readable, config)    → plain values in docker.env
```

The file is uploaded to the server via SCP, never stored in git.

### Docker Compose service levels

| Level | Command | Services included |
|-------|---------|-------------------|
| L1 (basic) | `pnpm docker:l1` | postgres, all services, api-gateway |
| L2 (cache) | `pnpm docker:l2` | + redis |
| L3 (workers) | `pnpm docker:l3` | + BullMQ workers |
| L4 (events) | `pnpm docker:l4` | + Kafka event bus |
| L5 (full) | `pnpm docker:l5` | everything |

Production uses **L3** (workers).

---

## 6. Secrets Management

### Local workflow

```
1. pnpm secrets:edit
   → generates crypto secrets, opens secrets.local.env in Notepad
   → fill in 6 required fields

2. pnpm secrets:push:bash
   → reads secrets.local.env
   → uses GHCR_TOKEN for auth (no gh auth login needed)
   → pushes secrets → GitHub Secrets
   → pushes config  → GitHub Variables
   → deletes secrets.local.env

3. On next push to master, GHA reads from GitHub Secrets/Variables
   → generates docker.env on the runner
   → uploads to server via SCP
```

### Updating existing secrets

```
1. pnpm secrets:pull
   → fetches all GitHub Variables (with values)
   → lists GitHub Secret names (values unreadable)
   → merges with local file preserving secret values
   → opens Notepad

2. Edit any value

3. pnpm secrets:push:bash
```

### Secret categories

| Category | Storage | Readable back? |
|----------|---------|----------------|
| JWT keys, passwords, API keys | GitHub Secret | No |
| Domains, DB config, payment gateway, OAuth client IDs | GitHub Variable | Yes |

### Required GitHub Secrets (deploy infrastructure — set manually)

| Secret | Value |
|--------|-------|
| `OCI_HOST` | Server IP address |
| `OCI_USER` | SSH username (e.g. `ubuntu`) |
| `OCI_SSH_PRIVATE_KEY` | Private SSH key content |
| `OCI_PORT` | `22` |
| `GHCR_USERNAME` | GitHub username |
| `GHCR_TOKEN` | GitHub PAT with `packages:write` + `repo` scopes |

---

## 7. Database Lifecycle

### Schema

`database/schema.sql` — full schema applied only on first deploy (when `users` table doesn't exist).

### Migrations

`database/migrations/` — incremental SQL files tracked in `schema_migrations` table.

```
migrate.js up    → applies all pending migrations in order
migrate.js down  → rolls back last migration
migrate.js status → shows applied/pending list
```

Migrations use `pg_advisory_lock(99)` — safe to run concurrently (only one wins).

### Seed data

`database/seed.js` — idempotent, safe to run multiple times:
- 1 super admin user
- RBAC roles + permissions
- Service categories
- Feature flags
- System settings

Run via: `pnpm db:seed` (local) or trigger GHA with `run_seed=true` (production).

---

## 8. First Deploy Checklist

```
[ ] 1. Set LSP_* secrets in GitHub
       pnpm secrets:edit  → fill in values
       pnpm secrets:push:bash

[ ] 2. Set deploy secrets manually in GitHub Settings → Secrets:
       OCI_HOST, OCI_USER, OCI_SSH_PRIVATE_KEY, OCI_PORT
       GHCR_USERNAME, GHCR_TOKEN

[ ] 3. Ensure server has Docker + Docker Compose installed
       ssh user@server "docker --version && docker compose version"

[ ] 4. Create external Docker network on server
       ssh user@server "docker network create edge 2>/dev/null || true"

[ ] 5. Push to master
       git push origin master

[ ] 6. Watch pipeline: GitHub → Actions → Backend Unified CI-CD (ARM)

[ ] 7. Trigger manual deploy with seed:
       GitHub → Actions → Run workflow → run_seed = true

[ ] 8. Verify:
       curl https://lsp-api.easydev.in/health
       curl https://lsp-api.easydev.in/api/v1/health
```

---

## 9. Day-to-Day Developer Workflow

### Make a code change and deploy

```bash
# 1. Make changes
git add .
git commit -m "feat: your change"
git push origin master
# → CI runs → images built → deployed automatically
```

### Update a config value (e.g. change CORS origins)

```bash
pnpm secrets:pull          # opens secrets.local.env with current values
# edit LSP_CORS_ORIGINS
pnpm secrets:push:bash     # pushes to GitHub Variables
git commit --allow-empty -m "chore: trigger deploy for env update"
git push origin master
```

### Run seed data again (e.g. after wiping DB)

GitHub → Actions → Run workflow → `run_seed = true`

### Force clean rebuild (cache issues)

GitHub → Actions → Run workflow → `force_clean_cache = true`

### Skip migrations (hotfix)

GitHub → Actions → Run workflow → `skip_migrations = true`

### Local dev with Docker

```bash
pnpm docker:l2        # postgres + redis + all services
pnpm docker:logs      # tail all logs
pnpm docker:ps        # check service status
```

### Local dev without Docker

```bash
pnpm infra:up         # start postgres + redis only
pnpm services:dev     # start all NestJS services with hot reload
```

---

## 10. Rollback

### Automatic rollback (deploy script)

If any step in `deploy-production-worker.sh` fails, the script automatically:
1. Stops new containers
2. Restores backup: `mv app.backup-<run_id> app/`
3. Restarts old containers from backup

### Manual rollback to previous image

```bash
# SSH into server
ssh user@server

# Redeploy previous git SHA image
cd ~/Local-Service-Marketplace
docker compose pull  # pulls :latest (previous if new deploy failed)
./scripts/deploy-production-worker.sh --env-file docker.env --no-build --skip-migrations
```

### Rollback database migration

```bash
# SSH into server
cd ~/Local-Service-Marketplace
docker compose run --rm -e DATABASE_URL=... node:20-alpine \
  node database/migrate.js down
```
