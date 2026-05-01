# comms-service

Handles all communications: in-app notifications, push notifications (FCM), email, and SMS.

**Port:** 3007  
**Base path (via gateway):** `/api/v1/notifications/*`, `/api/v1/messages/*`

---

## Responsibilities

- In-app notification creation and delivery
- Push notification delivery via Firebase Cloud Messaging (FCM)
- Email sending (via email-service or direct SMTP)
- SMS sending (via sms-service or Twilio)
- **Real-time chat and notifications via Socket.IO** (embedded server)
- Message threading between users (15-min edit window)
- File attachment support in messages
- Notification preference management
- Device token (push) registration

---

## Owned Database Tables

| Table | Purpose |
|-------|---------|
| `notifications` | Notification records per user |
| `notification_deliveries` | Delivery status across channels (in-app/push/email/sms) |
| `messages` | Chat messages between users |
| `attachments` | Files attached to messages |

---

## Notification Channels

Channels are independently enabled/disabled:

| Channel | Feature Flag | Credentials Needed |
|---------|-------------|-------------------|
| In-app | Always enabled | — |
| Push (FCM) | `FCM_ENABLED=true` | Firebase Admin SDK credentials |
| Email | `EMAIL_ENABLED=true` | `EMAIL_SERVICE_URL` |
| SMS | `SMS_ENABLED=true` | `SMS_SERVICE_URL` |

---

## API Endpoints

All routes go through the API Gateway at `http://localhost:3700`.

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications` | List notifications for current user |
| GET | `/api/v1/notifications/unread-count` | Count of unread notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read |
| PATCH | `/api/v1/notifications/read-all` | Mark all as read |
| DELETE | `/api/v1/notifications/:id` | Delete notification |
| GET | `/api/v1/notifications/preferences` | Get notification preferences |
| PATCH | `/api/v1/notifications/preferences` | Update preferences |
| POST | `/api/v1/notifications/devices` | Register push device token |
| DELETE | `/api/v1/notifications/devices/:id` | Remove device token |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/messages/conversations` | List conversations (paginated) |
| GET | `/api/v1/messages/conversation/:userId` | Messages with a user (paginated) |
| POST | `/api/v1/messages` | Send a message |
| PATCH | `/api/v1/messages/:id` | Edit message (15-min window) |
| DELETE | `/api/v1/messages/:id` | Delete message |

### Socket.IO Real-time Events

Connect to comms-service Socket.IO server with `auth: { token: '<access_token>' }`.

| Event (client → server) | Description |
|--------------------------|-------------|
| `message:send` | Send a message |
| `typing:start` / `typing:stop` | Typing indicators |

| Event (server → client) | Description |
|--------------------------|-------------|
| `message:received` | New incoming message |
| `message:edited` | Message edited |
| `message:deleted` | Message deleted |
| `notification:new` | In-app notification pushed |
| `job:status-update` | Job lifecycle change |
| `user:online` / `user:offline` | Presence |

### Internal (called by other services via HTTP)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/notifications` | Create notification (system events) |
| POST | `/internal/emails` | Send email (triggered by other services) |

---

## Environment Variables

See [.env.example](.env.example). Key variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | Yes (workers) | Required for WORKERS_ENABLED=true |
| `EMAIL_SERVICE_URL` | No | Internal email-service URL |
| `EMAIL_ENABLED` | No | `true` to enable email (default: false in dev) |
| `SMS_SERVICE_URL` | No | Internal sms-service URL |
| `SMS_ENABLED` | No | `true` to enable SMS (default: false in dev) |
| `FCM_ENABLED` | No | `true` to enable Firebase push notifications |
| `FIREBASE_PROJECT_ID` | If FCM_ENABLED | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | If FCM_ENABLED | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | If FCM_ENABLED | Base64-encoded Firebase private key |

### Firebase FCM Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → your project → Project Settings → Service Accounts
2. Click **Generate new private key** — download the JSON file
3. Base64-encode the entire JSON file:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("path/to/firebase-key.json"))
   ```
4. Set `FIREBASE_PRIVATE_KEY` to the base64 output

---

## Running Locally

```powershell
pnpm install
Copy-Item .env.example .env
# Edit .env — set DATABASE_URL
# For push notifications: add Firebase credentials
pnpm start:dev
```

Service starts on `http://localhost:3007`.

In local dev, FCM, email, and SMS are disabled by default — in-app notifications work without any credentials.

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── notifications/       # Notification CRUD and delivery
│   ├── messages/            # Messaging between users
│   ├── attachments/         # File attachment handling
│   └── preferences/         # User notification preferences
├── channels/
│   ├── email/               # Email channel adapter
│   ├── sms/                 # SMS channel adapter
│   ├── push/                # FCM push notification adapter
│   └── in-app/              # In-app notification handler
├── common/
├── config/
├── redis/
├── bullmq/
└── workers/
```

---

## Background Jobs (BullMQ)

When `WORKERS_ENABLED=true`:

| Queue | Jobs |
|-------|------|
| `comms.notification` | Multi-channel delivery per notification |
| `comms.email` | Email sending with retry logic |
| `comms.sms` | SMS sending with retry logic |
| `comms.push` | FCM batch push delivery |
| `comms.cleanup` | Archive old delivered notifications |

---

## Tests

```powershell
pnpm test
pnpm test:cov
pnpm test:e2e
```
