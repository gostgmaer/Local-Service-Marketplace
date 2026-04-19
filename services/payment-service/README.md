# payment-service

Handles all payment processing, refunds, coupons, subscriptions, and payment webhooks.

**Port:** 3006  
**Base path (via gateway):** `/api/v1/payments/*`, `/api/v1/refunds/*`, `/api/v1/coupons/*`, `/api/v1/webhooks/*`

---

## Responsibilities

- Multi-gateway payment processing (Stripe, Razorpay, PayPal, PayU, Instamojo, mock)
- Payment escrow: funds held until job completion
- Refund processing
- Webhook event handling from payment gateways
- Coupon / discount code management
- Subscription and pricing plan management
- Saved payment methods

---

## Owned Database Tables

| Table | Purpose |
|-------|---------|
| `payments` | Payment transactions (pending/completed/failed/refunded) |
| `refunds` | Refund records |
| `payment_webhooks` | Incoming webhook events from gateways |
| `coupons` | Discount codes with rules |
| `coupon_usage` | Coupon redemption history |
| `pricing_plans` | Subscription plans |
| `subscriptions` | Active user subscriptions |
| `saved_payment_methods` | Stored payment methods per user |

---

## Payment Gateways

Select the active gateway via `PAYMENT_GATEWAY` env var:

| Value | Gateway | Webhook Path |
|-------|---------|-------------|
| `mock` | Built-in mock (default, no credentials needed) | — |
| `stripe` | Stripe | `POST /api/v1/webhooks/stripe` |
| `razorpay` | Razorpay | `POST /api/v1/webhooks/razorpay` |
| `paypal` | PayPal | `POST /api/v1/webhooks/paypal` |
| `payubiz` | PayUbiz (India) | `POST /api/v1/webhooks/payubiz` |
| `instamojo` | Instamojo (India) | `POST /api/v1/webhooks/instamojo` |

You can also override the gateway per-request using the `X-Payment-Gateway` header.

---

## API Endpoints

All routes go through the API Gateway at `http://localhost:3700`.

### Authenticated

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/payments` | Initiate a payment |
| GET | `/api/v1/payments` | List payments (paginated) |
| GET | `/api/v1/payments/:id` | Get payment details |
| POST | `/api/v1/refunds` | Request a refund |
| GET | `/api/v1/refunds/:id` | Get refund status |
| GET | `/api/v1/coupons/:code` | Validate a coupon code |
| POST | `/api/v1/coupons` | Create coupon (admin) |
| GET | `/api/v1/pricing-plans` | List pricing plans |
| POST | `/api/v1/subscriptions` | Subscribe to a plan |
| GET | `/api/v1/payment-methods` | List saved payment methods |
| POST | `/api/v1/payment-methods` | Add payment method |
| DELETE | `/api/v1/payment-methods/:id` | Remove payment method |

### Webhook Receivers (public, signature-verified)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/webhooks/stripe` | Stripe webhook |
| POST | `/api/v1/webhooks/razorpay` | Razorpay webhook |
| POST | `/api/v1/webhooks/paypal` | PayPal webhook |
| POST | `/api/v1/webhooks/payubiz` | PayUbiz success/failure |
| POST | `/api/v1/webhooks/instamojo` | Instamojo webhook |

---

## Environment Variables

See [.env.example](.env.example). Key variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `PAYMENT_GATEWAY` | **Yes** | `mock` \| `stripe` \| `razorpay` \| `paypal` \| `payubiz` \| `instamojo` |
| `STRIPE_SECRET_KEY` | If `PAYMENT_GATEWAY=stripe` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | If `PAYMENT_GATEWAY=stripe` | Stripe webhook signing secret |
| `RAZORPAY_KEY_ID` | If `PAYMENT_GATEWAY=razorpay` | |
| `RAZORPAY_KEY_SECRET` | If `PAYMENT_GATEWAY=razorpay` | |
| `PAYPAL_CLIENT_ID` | If `PAYMENT_GATEWAY=paypal` | |
| `PAYPAL_CLIENT_SECRET` | If `PAYMENT_GATEWAY=paypal` | |
| `NOTIFICATION_SERVICE_URL` | Yes | Points to comms-service |
| `REDIS_URL` | Yes (workers) | Required when WORKERS_ENABLED=true |

---

## Running Locally

```powershell
pnpm install
Copy-Item .env.example .env
# Edit .env — set DATABASE_URL and payment gateway credentials
pnpm start:dev
```

Service starts on `http://localhost:3006`.

**For development without real payment credentials:** `PAYMENT_GATEWAY=mock` is the default and requires no setup.

**For Stripe webhooks in local dev:**

```bash
# Install Stripe CLI and forward webhooks
stripe listen --forward-to http://localhost:3006/webhooks/stripe
# Copy the signing secret to STRIPE_WEBHOOK_SECRET in .env
```

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── payments/            # Core payment processing
│   ├── refunds/             # Refund handling
│   ├── webhooks/            # Gateway webhook receivers
│   ├── coupons/             # Coupon management
│   ├── subscriptions/       # Subscription plans
│   └── payment-methods/     # Saved payment methods
├── gateways/                # Payment gateway adapters (stripe, razorpay, etc.)
├── common/
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
| `payment.retry` | Retry failed payment attempts |
| `payment.refund` | Process async refunds |
| `payment.webhook` | Reprocess failed webhook events |
| `payment.subscription` | Process subscription renewals |
| `payment.cleanup` | Archive old webhook events |

---

## Tests

```powershell
pnpm test
pnpm test:cov
pnpm test:e2e
```

