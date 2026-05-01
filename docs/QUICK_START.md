# Quick Start

Get the platform running in 5 steps. For a full guide covering all environments see [GETTING_STARTED.md](GETTING_STARTED.md).

---

## Prerequisites

- Docker Desktop 20.x+ with Docker Compose 2.x+
- 4 GB RAM minimum (8 GB recommended)
- Node.js 20+ and pnpm 10+ (for local dev only)

---

## Step 1 — Clone and configure

```powershell
git clone https://github.com/your-org/local-service-marketplace.git
cd local-service-marketplace

# Copy the template — docker.env is gitignored and holds your real secrets
Copy-Item .env.example docker.env
```

---

## Step 2 — Generate secrets

Open `docker.env` and set these five values. Generate each one with `openssl rand -base64 48`:

```env
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated — must differ from JWT_SECRET>
GATEWAY_INTERNAL_SECRET=<generated>
ENCRYPTION_KEY=<generated — use openssl rand -base64 64>
SESSION_SECRET=<generated — use openssl rand -base64 32>
```

> **Windows?** Use Git Bash or WSL to run `openssl`. Or generate online at https://generate-secret.vercel.app/64

---

## Step 3 — Start services

The default `COMPOSE_PROFILES=workers` in `docker.env` starts Redis automatically alongside all microservices.

```powershell
docker-compose up -d
```

Wait ~60 seconds for containers to become healthy, then verify:

```powershell
curl http://localhost:3700/health   # should return JSON
```

To also start the frontend container:

```powershell
# Edit docker.env:
COMPOSE_PROFILES=workers,frontend

docker-compose up -d
```

---

## Step 4 — Run database migrations

```powershell
cd database
node migrate.js
```

---

## Step 5 — Seed sample data (optional)

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

---

## Access the platform

| URL | What you get |
|-----|-------------|
| http://localhost:3000 | Frontend (Next.js) — requires `frontend` profile |
| http://localhost:3700 | API Gateway |
| http://localhost:3700/health | Health check (JSON) |

---

## Next steps

- Full local development setup (no Docker): [GETTING_STARTED.md#3-environment-local-development-no-docker](GETTING_STARTED.md)
- Environment variable reference: [ENVIRONMENT_VARIABLES_GUIDE.md](ENVIRONMENT_VARIABLES_GUIDE.md)
- All commands and troubleshooting: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- Marketplace roles and workflows: [MARKETPLACE_GUIDE.md](MARKETPLACE_GUIDE.md)
