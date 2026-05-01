# Quick Reference — Local Service Marketplace

All commands, ports, and troubleshooting in one place.

---

## Essential Docker Commands

```powershell
# Start all services (uses COMPOSE_PROFILES from docker.env)
docker-compose up -d

# Start with frontend container
# (set COMPOSE_PROFILES=workers,frontend in docker.env first)
docker-compose up -d

# Stop all services
docker-compose down

# Full reset — deletes all data volumes (WARNING: irreversible)
docker-compose down -v

# View all running containers and their health status
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f identity-service

# Restart a service
docker-compose restart marketplace-service

# Rebuild and restart after code changes
docker-compose up -d --build

# Rebuild a single service
docker-compose up -d --build identity-service

# Scale a service (e.g. 3 gateway replicas)
docker-compose up -d --scale api-gateway=3
```

---

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| **API Gateway** | 3700 | http://localhost:3700 |
| **Frontend** | 3000 | http://localhost:3000 |
| identity-service | 3001 | http://localhost:3001 |
| marketplace-service | 3003 | http://localhost:3003 |
| payment-service | 3006 | http://localhost:3006 |
| comms-service | 3007 | http://localhost:3007 (REST + Socket.IO) |
| oversight-service | 3010 | http://localhost:3010 |
| infrastructure-service | 3012 | http://localhost:3012 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Kafka | 9092 | localhost:9092 (optional) |
| email-service | 4000 | localhost:4000 (Docker: 3500) |
| sms-service | 5000 | localhost:5000 (Docker: 3000) |

---

## Health Checks

```powershell
# API Gateway (main entry point)
curl http://localhost:3700/health -UseBasicParsing

# All services
curl http://localhost:3001/health -UseBasicParsing  # identity-service
curl http://localhost:3003/health -UseBasicParsing  # marketplace-service
curl http://localhost:3006/health -UseBasicParsing  # payment-service
curl http://localhost:3007/health -UseBasicParsing  # comms-service
curl http://localhost:3010/health -UseBasicParsing  # oversight-service
curl http://localhost:3012/health -UseBasicParsing  # infrastructure-service

# Redis
docker exec marketplace-redis redis-cli ping

# PostgreSQL
docker exec marketplace-postgres psql -U postgres -c "SELECT 1"
```

---

## Database Commands

```powershell
# Run all migrations
cd database ; node migrate.js

# Seed database with 1000+ records
cd database ; node seed.js

# Connect to database manually
docker exec -it marketplace-postgres psql -U postgres -d marketplace

# Check database tables
docker exec marketplace-postgres psql -U postgres -d marketplace -c "\dt"

# Count users
docker exec marketplace-postgres psql -U postgres -d marketplace -c "SELECT COUNT(*) FROM users;"

# Apply schema to fresh database
Get-Content database\schema.sql | docker exec -i marketplace-postgres psql -U postgres -d marketplace

# Recreate database (WARNING: deletes all data)
.\scripts\recreate-database.ps1
```

---

## Default Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@marketplace.com` | `password123` |
| Provider | `provider1@example.com` | `password123` |
| Customer | `customer1@example.com` | `password123` |

---

## Environment Files

| File | Purpose | Committed? |
|------|---------|-----------|
| `docker.env` | Docker Compose runtime (real secrets) | **No** |
| `.env.example` | Root template | Yes |
| `services/*/.env.example` | Per-service template | Yes |
| `api-gateway/.env.example` | Gateway template | Yes |
| `frontend/.env.local` | Frontend config | No |

```powershell
# Copy all .env.example to .env (local dev)
Get-ChildItem -Path "." -Filter ".env.example" -Recurse |
  Where-Object { $_.FullName -notmatch "node_modules" } |
  ForEach-Object { Copy-Item $_.FullName (Join-Path $_.DirectoryName ".env") }
```

---

## Compose Profiles

Set `COMPOSE_PROFILES` in `docker.env`:

| Value | What Starts | Level |
|-------|-------------|-------|
| _(empty)_ | Core services only | 1 |
| `cache` | + Redis (cache only) | 2 |
| `workers` | + Redis + BullMQ workers | 3 |
| `workers,frontend` | + Next.js frontend container | 3 |
| `workers,pooling` | + PgBouncer | 3 |
| `workers,infrastructure` | + infrastructure-service | 3 |
| `workers,events` | + Kafka + Zookeeper | 4 |
| `full` | Everything | 5 |

---

## Secrets Management

```powershell
# Generate all production secrets
.\scripts\generate-production-secrets.ps1

# Apply secrets to all service .env files
.\scripts\apply-secrets.ps1

# Verify all env files are configured correctly
.\scripts\check-env.ps1
```

---

## Frontend Commands

```powershell
cd frontend

# Development with hot-reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run unit tests
pnpm test

# Run tests with coverage
pnpm test:cov
```

---

## API Testing

```powershell
# Run full API test suite (Newman / Postman)
.\scripts\run-postman-tests.ps1

# Quick signup test
$body = @{
  name = "Test User"
  email = "test@example.com"
  phone = "+1234567890"
  password = "Test123!@#"
  role = "customer"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3700/api/v1/user/auth/signup" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Quick login test
$body = @{ email = "customer1@example.com"; password = "password123" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:3700/api/v1/user/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

---

## Troubleshooting

### Port already in use

```powershell
# Find what is using port 3700
Get-Process -Id (Get-NetTCPConnection -LocalPort 3700).OwningProcess

# Kill the process
Stop-Process -Id [PROCESS_ID] -Force
```

### JWT_SECRET mismatch errors (`401 Unauthorized` on all requests)

1. Ensure `JWT_SECRET` is identical in `docker.env`, `api-gateway/.env`, and `services/identity-service/.env`
2. Restart both services: `docker-compose restart api-gateway identity-service`

### Service fails to start (database connection refused)

```powershell
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# If using PgBouncer, check pgbouncer logs
docker-compose logs pgbouncer
```

### Redis connection errors / workers not processing

```powershell
# Verify Redis is in your COMPOSE_PROFILES
# docker.env should have: COMPOSE_PROFILES=workers (or include workers)

# Check Redis container
docker-compose ps redis
docker exec marketplace-redis redis-cli ping    # should return PONG

# Verify WORKERS_ENABLED=true in docker.env
```

### Service not responding after restart

```powershell
# Check container logs for startup errors
docker-compose logs --tail=50 [service-name]

# Check if the container is crash-looping
docker-compose ps [service-name]

# Force rebuild
docker-compose up -d --build [service-name]
```

### Database schema out of date

```powershell
cd database
node migrate.js

# If migrations fail, recreate database
.\scripts\recreate-database.ps1
```

### Frontend cannot connect to API

Ensure `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches the API Gateway URL the browser can reach:

```env
NEXT_PUBLIC_API_URL=http://localhost:3700   # for local dev
```

---

## Project Structure

```
Local-Service-Marketplace/
├── api-gateway/                # NestJS API Gateway (port 3700)
├── services/
│   ├── identity-service/       # Auth + Users + Providers (port 3001)
│   ├── marketplace-service/    # Requests + Proposals + Jobs (port 3003)
│   ├── payment-service/        # Payments + Refunds (port 3006)
│   ├── comms-service/          # Notifications + Messaging (port 3007)
│   ├── oversight-service/      # Admin + Analytics (port 3010)
│   └── infrastructure-service/ # Feature Flags + Jobs (port 3012)
├── frontend/                   # Next.js (port 3000)
├── database/                   # Schema, migrations, seed
├── docs/                       # All documentation
│   ├── api/                    # API specs
│   ├── architecture/           # Architecture docs
│   ├── deployment/             # Deployment & scaling
│   └── guides/                 # Integration guides
├── scripts/                    # PowerShell utility scripts
├── config/                     # Shared configuration (queue-config)
├── docker-compose.yml          # Core orchestration
├── docker.env                  # Runtime secrets (gitignored)
└── .env.example                # Template for docker.env
```

---

## Documentation Index

| Doc | Purpose |
|-----|---------|
| [QUICK_START.md](QUICK_START.md) | 5-step startup |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Full setup for all environments |
| [MARKETPLACE_GUIDE.md](MARKETPLACE_GUIDE.md) | Roles, workflows, capabilities |
| [ENVIRONMENT_VARIABLES_GUIDE.md](ENVIRONMENT_VARIABLES_GUIDE.md) | All env vars explained |
| [BULLMQ_CONFIGURATION_GUIDE.md](BULLMQ_CONFIGURATION_GUIDE.md) | Background job queues |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and fixes |
| [api/API_SPECIFICATION.md](api/API_SPECIFICATION.md) | API endpoint reference |
| [guides/AUTHENTICATION_WORKFLOW.md](guides/AUTHENTICATION_WORKFLOW.md) | Auth flow details |
| [guides/KAFKA_INTEGRATION.md](guides/KAFKA_INTEGRATION.md) | Kafka event setup |
| [deployment/SCALING_STRATEGY.md](deployment/SCALING_STRATEGY.md) | Scaling levels |

---
