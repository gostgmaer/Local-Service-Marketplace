# infrastructure-service

Manages platform infrastructure concerns: event storage, background job scheduling, rate limiting, and feature flags.

**Port:** 3012  
**Base path (via gateway):** `/api/v1/events/*`, `/api/v1/feature-flags/*`, `/api/v1/jobs/*`

---

## Responsibilities

- Persistent event log (audit trail for all domain events)
- Background job scheduling and status tracking
- Distributed rate limiting rules
- Feature flag management (enable/disable features at runtime)
- Kafka event consumption and storage
- Health and system diagnostics

---

## Owned Database Tables

| Table | Purpose |
|-------|---------|
| `events` | Domain event log (all services publish events here) |
| `background_jobs` | Job definitions and execution history |
| `rate_limits` | Rate limiting configuration per route/user |
| `feature_flags` | Feature enable/disable configuration |

---

## Docker Profile

This service is optional and only starts when the `infrastructure` or `full` Docker Compose profile is active:

```powershell
# In docker.env:
COMPOSE_PROFILES=workers,infrastructure

# Or start manually
docker-compose up -d infrastructure-service
```

---

## API Endpoints

All routes go through the API Gateway at `http://localhost:3700`.

### Events

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/events` | Query event log (paginated, filterable) |
| GET | `/api/v1/events/:id` | Get event details |

### Feature Flags

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/feature-flags` | List all feature flags |
| GET | `/api/v1/feature-flags/:key` | Get a feature flag value |
| PATCH | `/api/v1/feature-flags/:key` | Update a feature flag (admin) |

### Background Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/jobs` | List scheduled jobs and their status |
| POST | `/api/v1/jobs/:name/trigger` | Manually trigger a job (admin) |
| GET | `/api/v1/jobs/:id/history` | View job execution history |

### Health & Diagnostics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Service health check |
| GET | `/api/v1/health/queue` | BullMQ queue health |
| GET | `/api/v1/health/kafka` | Kafka consumer health |

---

## Environment Variables

See [.env.example](.env.example). Key variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | Yes (workers) | Required when WORKERS_ENABLED=true |
| `EVENT_BUS_ENABLED` | No | `true` to enable Kafka consumption |
| `KAFKA_BROKERS` | If EVENT_BUS_ENABLED | Kafka broker addresses |
| `KAFKA_GROUP_ID` | If EVENT_BUS_ENABLED | Consumer group ID |

---

## Running Locally

```powershell
pnpm install
Copy-Item .env.example .env
# Edit .env — set DATABASE_URL
# Optional: add Kafka config for EVENT_BUS_ENABLED=true
pnpm start:dev
```

Service starts on `http://localhost:3012`.

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── events/              # Event log management
│   ├── feature-flags/       # Feature flag CRUD
│   ├── jobs/                # Background job registry
│   └── rate-limits/         # Rate limit configuration
├── consumers/               # Kafka event consumers
├── common/
├── config/
├── redis/
├── kafka/
├── bullmq/
└── workers/
```

---

## Kafka Event Consumption

When `EVENT_BUS_ENABLED=true`, the service consumes events from all services and persists them to the `events` table:

| Topic | Source |
|-------|--------|
| `request_created` | marketplace-service |
| `proposal_submitted` | marketplace-service |
| `job_started` | marketplace-service |
| `payment_completed` | payment-service |
| `review_submitted` | marketplace-service |
| `user_registered` | identity-service |

---

## Tests

```powershell
pnpm test
pnpm test:cov
pnpm test:e2e
```
