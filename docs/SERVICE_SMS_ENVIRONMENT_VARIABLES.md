# Environment Variables Reference

All variables with a `*` are **required** for production. All others are optional or provider-specific.

---

## Application

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` * | `development` | `development` / `production` / `test` |
| `PORT` | `3000` | HTTP port to listen on |
| `API_PREFIX` | `/api/v1` | Route prefix |

## Authentication

| Variable | Default | Description |
|---|---|---|
| `API_KEY` * | — | Bearer token all clients must supply |

## Database

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` * | `mongodb://localhost:27017/sms-delivery-service` | MongoDB connection string |
| `REDIS_URL` | — | Redis URL for distributed rate limiting (optional) |

## SMS Provider

| Variable | Default | Description |
|---|---|---|
| `SMS_PROVIDER` * | `mock` | Active provider name (see list below) |
| `SMS_FALLBACK_PROVIDER` | — | Fallback provider if primary fails |
| `SMS_MAX_RETRY_ATTEMPTS` | `3` | Max retry attempts for failed sends |

### Valid `SMS_PROVIDER` values

| Value | Provider | Free? |
|---|---|---|
| `mock` | Mock (dev only) | ✅ Always free |
| `fast2sms` | Fast2SMS | ✅ Free, no CC |
| `2factor` | 2Factor.in | ✅ Free trial, no CC |
| `smsgateway` | SMSGateway.me | ✅ Free self-hosted |
| `infobip` | Infobip | ✅ 30-day trial |
| `telnyx` | Telnyx | ✅ $10 credit, no CC |
| `vonage` | Vonage | ✅ €2 credit |
| `msg91` | MSG91 | ✅ ₹50 credit |
| `d7networks` | D7 Networks | ✅ Trial credits |
| `sinch` | Sinch | CC required |
| `textlocal` | TextLocal | CC required |
| `gupshup` | Gupshup | CC required |
| `plivo` | Plivo | CC required |
| `awssns` | AWS SNS | CC required |
| `twilio` | Twilio | CC required |
| `kaleyra` | Kaleyra | Enterprise |
| `airteliq` | Airtel IQ | Enterprise |
| `jiocx` | JioCX | Enterprise |
| `exotel` | Exotel | Trial available |
| `routemobile` | Route Mobile | Enterprise |
| `valuefirst` | ValueFirst | Enterprise |
| `smscountry` | SMSCountry | Paid |

## OTP

| Variable | Default | Description |
|---|---|---|
| `OTP_LENGTH` | `6` | Number of OTP digits (4–8) |
| `OTP_EXPIRY_MINUTES` | `10` | OTP validity in minutes |
| `OTP_MAX_ATTEMPTS` | `5` | Max verify attempts before lockout |

## Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Global rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per IP per window |
| `SMS_RATE_LIMIT_WINDOW_MS` | `60000` | SMS send rate limit window (1 min) |
| `SMS_RATE_LIMIT_MAX` | `50` | Max sends per tenant per window |

## Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |
| `LOG_FORMAT` | JSON | Set to `pretty` for coloured dev output |

## Provider Credentials

See `.env.sample` for the full list of provider-specific environment variables.
Each provider only needs its own set — leave all others blank.
