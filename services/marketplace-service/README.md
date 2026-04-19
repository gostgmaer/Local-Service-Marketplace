# marketplace-service

Manages the core service marketplace: requests, proposals, jobs, reviews, and service categories.

**Port:** 3003  
**Base path (via gateway):** `/api/v1/requests/*`, `/api/v1/proposals/*`, `/api/v1/jobs/*`, `/api/v1/reviews/*`, `/api/v1/categories/*`

---

## Responsibilities

- Service request lifecycle (open → proposals received → assigned → completed/cancelled)
- Proposal submission and acceptance by customers
- Job creation when a proposal is accepted
- Job status management (in_progress → completed)
- Review and rating system for providers
- Service category management (admin)
- Full-text search for service requests
- Provider rating aggregation

---

## Owned Database Tables

| Table | Purpose |
|-------|---------|
| `service_categories` | Service types (plumbing, cleaning, tutoring, etc.) |
| `service_requests` | Customer requests with budget, location, status |
| `service_request_search` | Full-text search index for requests |
| `proposals` | Provider bids on requests |
| `jobs` | Active work contracts (created when proposal accepted) |
| `reviews` | Customer reviews and provider ratings |

---

## API Endpoints

All routes go through the API Gateway at `http://localhost:3700`.

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/categories` | List all service categories |
| GET | `/api/v1/categories/:id` | Get category details |

### Authenticated

#### Service Requests

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/requests` | List requests (paginated, filterable) |
| POST | `/api/v1/requests` | Create a service request (customer) |
| GET | `/api/v1/requests/:id` | Get request details |
| PATCH | `/api/v1/requests/:id` | Update request (owner only) |
| DELETE | `/api/v1/requests/:id` | Cancel request (owner only) |
| GET | `/api/v1/requests/my` | My requests (current user) |

#### Proposals

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/proposals` | List proposals (filter by requestId, providerId) |
| POST | `/api/v1/proposals` | Submit a proposal (provider) |
| GET | `/api/v1/proposals/:id` | Get proposal details |
| PATCH | `/api/v1/proposals/:id/accept` | Accept proposal → creates job (customer) |
| PATCH | `/api/v1/proposals/:id/reject` | Reject proposal (customer) |
| PATCH | `/api/v1/proposals/:id/withdraw` | Withdraw proposal (provider) |

#### Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/jobs` | List jobs (paginated) |
| GET | `/api/v1/jobs/:id` | Get job details |
| PATCH | `/api/v1/jobs/:id` | Update job status |
| GET | `/api/v1/jobs/my` | My jobs (current user) |

#### Reviews

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/reviews` | List reviews (filter by providerId, jobId) |
| POST | `/api/v1/reviews` | Submit review (after job completion) |
| GET | `/api/v1/reviews/:id` | Get review details |

#### Categories (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/categories` | Create category (admin) |
| PATCH | `/api/v1/categories/:id` | Update category (admin) |
| DELETE | `/api/v1/categories/:id` | Deactivate category (admin) |

---

## Pagination

All list endpoints support:

```
GET /api/v1/requests?limit=20&cursor=<cursor>
GET /api/v1/proposals?requestId=<id>&limit=20&page=2
```

---

## Environment Variables

See [.env.example](.env.example). Key variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `USER_SERVICE_URL` | Yes | Points to identity-service |
| `NOTIFICATION_SERVICE_URL` | Yes | Points to comms-service |
| `REDIS_URL` | Yes (workers) | Required when WORKERS_ENABLED=true |
| `KAFKA_BROKERS` | No | Required when EVENT_BUS_ENABLED=true |

---

## Running Locally

```powershell
pnpm install
Copy-Item .env.example .env
# Edit .env — set DATABASE_URL
pnpm start:dev
```

Service starts on `http://localhost:3003`.

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── requests/            # Service request CRUD
│   ├── proposals/           # Proposal lifecycle
│   ├── jobs/                # Job management
│   ├── reviews/             # Reviews and ratings
│   └── categories/          # Service categories
├── common/                  # Guards, interceptors, decorators
├── config/
├── redis/
├── kafka/
├── bullmq/
└── workers/
```

---

## Background Jobs (BullMQ)

When `WORKERS_ENABLED=true`:

| Queue | Jobs |
|-------|------|
| `marketplace.notification` | Notify parties of proposal/job events |
| `marketplace.analytics` | Track request and conversion metrics |
| `marketplace.rating` | Recalculate provider ratings nightly |
| `marketplace.cleanup` | Archive expired requests |

---

## Tests

```powershell
pnpm test
pnpm test:cov
pnpm test:e2e
```
