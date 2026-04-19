# identity-service

Handles all authentication, user management, and provider profiles for the Local Service Marketplace.

**Port:** 3001  
**Base path (via gateway):** `/api/v1/user/auth/*`, `/api/v1/users/*`, `/api/v1/providers/*`

---

## Responsibilities

- User registration, login, logout
- JWT access token (15 min) + refresh token (90 days) issuance
- OAuth sign-in: Google, Facebook
- Email verification and password reset
- User profile management (customer + provider)
- Provider onboarding: profile, services offered, availability, portfolio, verification documents
- Token blacklisting via Redis (immediate logout invalidation)
- Login attempt tracking and rate limiting
- Session management

---

## Owned Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Core user accounts (UUID PK, roles: customer/provider/admin) |
| `sessions` | Active sessions with refresh tokens |
| `email_verification_tokens` | Email verification codes |
| `password_reset_tokens` | Password reset links |
| `login_attempts` | Track failed logins per IP/email |
| `social_accounts` | Linked OAuth accounts (Google, Facebook) |
| `user_devices` | Registered device tokens (push notifications) |
| `providers` | Provider profiles, verification status, ratings |
| `provider_services` | Services a provider offers |
| `provider_availability` | Weekly working hours |
| `provider_portfolio` | Portfolio images |
| `provider_documents` | Verification documents |
| `locations` | Provider/user location data |
| `favorites` | Customer saved providers |

---

## API Endpoints

All routes go through the API Gateway at `http://localhost:3700`.

### Public (no authentication)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/user/auth/signup` | Register new account |
| POST | `/api/v1/user/auth/login` | Login and receive JWT tokens |
| POST | `/api/v1/user/auth/refresh` | Refresh access token |
| POST | `/api/v1/user/auth/password-reset/request` | Send password reset email |
| POST | `/api/v1/user/auth/password-reset/confirm` | Confirm reset with token |
| POST | `/api/v1/user/auth/verify-email` | Verify email address |
| GET | `/api/v1/user/auth/google` | Initiate Google OAuth |
| GET | `/api/v1/user/auth/google/callback` | Google OAuth callback |
| GET | `/api/v1/user/auth/facebook` | Initiate Facebook OAuth |
| GET | `/api/v1/user/auth/facebook/callback` | Facebook OAuth callback |

### Authenticated (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/user/auth/logout` | Invalidate tokens |
| GET | `/api/v1/users/me` | Get current user profile |
| PATCH | `/api/v1/users/me` | Update profile |
| DELETE | `/api/v1/users/me` | Soft-delete account |
| GET | `/api/v1/providers` | List all providers (paginated) |
| GET | `/api/v1/providers/:id` | Get provider profile |
| POST | `/api/v1/providers` | Create provider profile |
| PATCH | `/api/v1/providers/:id` | Update provider profile |
| POST | `/api/v1/providers/:id/portfolio` | Upload portfolio image |
| DELETE | `/api/v1/providers/:id/portfolio/:imageId` | Delete portfolio image |
| POST | `/api/v1/providers/:id/documents` | Upload verification document |
| GET | `/api/v1/providers/:id/availability` | Get availability |
| PUT | `/api/v1/providers/:id/availability` | Set weekly availability |
| GET | `/api/v1/providers/:id/services` | List services offered |
| POST | `/api/v1/providers/:id/services` | Add service offering |
| DELETE | `/api/v1/providers/:id/services/:serviceId` | Remove service offering |

### Internal (gateway-to-service, requires GATEWAY_INTERNAL_SECRET)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/verify` | Verify a JWT token (used by gateway in `api` strategy) |

---

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | **Yes** | Must match api-gateway |
| `JWT_REFRESH_SECRET` | **Yes** | Different from JWT_SECRET |
| `GATEWAY_INTERNAL_SECRET` | **Yes** | Must match api-gateway and oversight-service |
| `ENCRYPTION_KEY` | **Yes** | For encrypting sensitive fields at rest |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | Yes (workers) | Required when WORKERS_ENABLED=true |
| `GOOGLE_CLIENT_ID` | No | Required for Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Required for Google OAuth |
| `FACEBOOK_APP_ID` | No | Required for Facebook OAuth |
| `FACEBOOK_APP_SECRET` | No | Required for Facebook OAuth |
| `NOTIFICATION_SERVICE_URL` | Yes | Points to comms-service |

---

## Running Locally

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 17 running (locally or via Docker)
- Redis running (optional, required for `WORKERS_ENABLED=true`)

### Steps

```powershell
# Install dependencies
pnpm install

# Copy environment template
Copy-Item .env.example .env

# Edit .env — set DATABASE_URL, JWT_SECRET, GATEWAY_INTERNAL_SECRET

# Start in development mode (hot-reload)
pnpm start:dev
```

Service starts on `http://localhost:3001`.

### Running with Docker (all services)

```powershell
# From repo root
docker-compose up -d
```

---

## Project Structure

```
src/
├── app.module.ts            # Root module
├── main.ts                  # Entry point
├── modules/
│   ├── auth/                # Authentication (login, signup, JWT, OAuth)
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/      # Passport strategies (local, jwt, google, facebook)
│   │   └── guards/
│   ├── users/               # User profile management
│   ├── providers/           # Provider profiles and services
│   └── admin/               # Admin user operations
├── common/                  # Shared guards, decorators, interceptors
├── config/                  # Configuration modules
├── redis/                   # Redis client module
├── bullmq/                  # BullMQ setup
└── workers/                 # Background job processors
```

---

## Background Jobs (BullMQ)

When `WORKERS_ENABLED=true`, the service registers these queues:

| Queue | Jobs |
|-------|------|
| `identity.notification` | Send welcome email, email verification |
| `identity.cleanup` | Remove expired tokens and sessions |
| `identity.document-expiry` | Notify providers of expiring documents |

---

## Tests

```powershell
pnpm test           # Unit tests
pnpm test:cov       # With coverage report
pnpm test:e2e       # End-to-end tests
```
