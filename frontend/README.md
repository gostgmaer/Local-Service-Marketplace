# Frontend — Next.js 15

**Next.js 15.5.15** application (App Router) — customer, provider, and admin UI for the Local Service Marketplace.

**Port:** 3000

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.5.15 | App Router SSR/SSG framework |
| `react` | 19.2.5 | UI library |
| `react-dom` | 19.2.5 | DOM renderer |
| `typescript` | 5.x | Type safety |
| `tailwindcss` | 3.x | Utility-first CSS |
| `next-auth` / `auth.js` | 5.x | Session management + OAuth |
| `zustand` | 4.x | Client state management |
| `react-hook-form` | 7.74.0 | Form management |
| `zod` | 4.4.1 | Schema validation |
| `@hookform/resolvers` | 5.2.2 | RHF + Zod integration |
| `socket.io-client` | 4.8.3 | Real-time chat + notifications |
| `@tanstack/react-query` | 5.x | Server state / data fetching |
| `axios` | 1.x | HTTP client |

---

## Project Structure

```
frontend/
├── app/                        # Next.js 15 App Router
│   ├── (auth)/                 # Login, signup, OAuth callback, 2FA, OTP
│   ├── (public)/               # Landing, categories, providers, requests
│   └── dashboard/              # Protected — customer, provider, admin views
├── components/                 # Reusable UI components
├── hooks/                      # Custom React hooks (useAuth, useSocket, etc.)
├── services/                   # API client functions (axios wrappers)
├── store/                      # Zustand stores
├── schemas/                    # Zod validation schemas
├── types/                      # TypeScript types
├── utils/                      # Utility functions
├── styles/                     # Global CSS
├── auth.config.ts              # NextAuth configuration (credentials + OAuth)
├── middleware.ts               # Route protection (public vs protected)
├── next.config.js              # Next.js 15 config (standalone output, CSP headers)
└── tailwind.config.js          # Tailwind configuration
```

---

## Authentication Methods

All auth flows are handled via `auth.config.ts` + identity-service backend:

| Method | Frontend Route | Backend Endpoint |
|--------|---------------|-----------------|
| Email + Password | `/login` | `POST /api/v1/user/auth/login` |
| Phone OTP | `/phone-login` | `POST /api/v1/user/auth/phone/otp/request` |
| Email OTP | `/login` | `POST /api/v1/user/auth/email/otp/request` |
| Magic link | `/login` | `POST /api/v1/user/auth/magic-link/request` |
| Google OAuth | `/login` (OAuth button) | `GET /api/v1/user/auth/google` |
| Facebook OAuth | `/login` (OAuth button) | `GET /api/v1/user/auth/facebook` |
| Apple Sign In | `/login` (OAuth button) | `GET /api/v1/user/auth/apple` |
| TOTP 2FA | `/login` (step 2) | `POST /api/v1/user/auth/2fa/login` |

---

## Real-time (Socket.IO)

The frontend connects to `comms-service` via Socket.IO for:
- Real-time chat messages
- In-app notification push
- Typing indicators
- Online presence
- Job status updates

Connection is established in `hooks/useSocket.ts` after login, using the JWT access token as auth.

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3007
```

---

## Route Protection

Configured in `middleware.ts` using NextAuth session checks:

- **Public** — `/`, `/login`, `/signup`, `/providers/:id`, `/requests/:id`, etc.
- **Protected** — `/dashboard/**`, `/checkout/**` — redirects to `/login` if unauthenticated
- **Role guards** — Provider-only and Admin-only dashboard sections enforced client-side

See [docs/ROUTE_PROTECTION_REFERENCE.md](../docs/ROUTE_PROTECTION_REFERENCE.md) for the full route table.

---

## Development

```powershell
# Install
pnpm install    # requires Node.js 20 LTS + pnpm 10+

# Dev server (hot reload)
pnpm dev        # → http://localhost:3000

# Production build
pnpm build
pnpm start

# Tests
pnpm test
pnpm test:cov
```

Set `NEXT_PUBLIC_API_URL=http://localhost:3700` in `.env.local`.

---

## Environment Variables

Key variables in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3700
NEXT_PUBLIC_SOCKET_URL=http://localhost:3007
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<generate with openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Full reference: [docs/ENVIRONMENT_VARIABLES_GUIDE.md](../docs/ENVIRONMENT_VARIABLES_GUIDE.md#11-frontend-nextjs)

