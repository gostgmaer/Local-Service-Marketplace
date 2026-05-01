# API Gateway

Single entry point for all client requests. Routes to 6 backend microservices with JWT authentication, rate limiting, and structured logging.

**Port:** 3700 (external) → 3000 (internal container)

**Full routing table and public route list:** [docs/api/API_GATEWAY_README.md](../docs/api/API_GATEWAY_README.md)

---

## Quick Summary

| Concern | Implementation |
|---------|---------------|
| Auth validation | `JwtAuthMiddleware` — validates Bearer token, injects `x-user-*` headers |
| Rate limiting | `express-rate-limit` (100 req/min per IP; stricter on `/user/auth/*`) |
| Logging | Winston JSON — `timestamp`, `service_name`, `request_id`, `user_id`, `action` |
| Proxying | `http-proxy-middleware` — per-route target from `services.config.ts` |
| Error tracking | Sentry (`SENTRY_DSN`) |

## Token Validation Strategies

```env
TOKEN_VALIDATION_STRATEGY=local   # Verify JWT locally (default, fast)
TOKEN_VALIDATION_STRATEGY=api     # Call identity-service /auth/validate (checks account status)
```

## Development

```powershell
pnpm install   # Node.js 20 LTS + pnpm 10+
Copy-Item .env.example .env
pnpm start:dev
```
