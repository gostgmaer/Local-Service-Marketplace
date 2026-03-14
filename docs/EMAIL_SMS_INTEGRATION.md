# Email & SMS Integration via Notification Service

## Architecture Overview

This platform uses a **centralized notification service** to handle all email and SMS communications. This architecture provides:

✅ **No Redis/Kafka Required** - Works with simple HTTP API calls  
✅ **Optional Event Bus** - Can add Kafka later for async processing  
✅ **Service Isolation** - Services don't directly call email/SMS services  
✅ **Centralized Management** - All notifications tracked in one place  

## Service Flow

```
┌─────────────────┐
│  Auth Service   │
│  User Service   │
│ Request Service │──┐
│ Payment Service │  │
│  Other Services │  │
└─────────────────┘  │
                     │ HTTP API calls
                     ▼
              ┌──────────────────┐
              │ Notification     │
              │ Service          │
              │ (Port 3008)      │
              └──────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
  ┌─────────────┐         ┌─────────────┐
  │ Email       │         │ SMS         │
  │ Service     │         │ Service     │
  │ (Port 3000) │         │ (Port 3000) │
  └─────────────┘         └─────────────┘
```

## How It Works

### 1. **Services Call Notification Service**
Instead of calling email-service or sms-service directly, services call:
- `POST /notifications/send` - Universal endpoint (email/SMS/both)
- `POST /notifications/email/send` - Email-specific
- `POST /notifications/sms/send` - SMS-specific
- `POST /notifications/otp/send` - OTP via SMS
- `POST /notifications/otp/verify` - Verify OTP

### 2. **Notification Service Routes Internally**
Notification service has HTTP clients that call:
- **email-service** for emails
- **sms-service** for SMS/OTP

### 3. **No Infrastructure Dependencies**
- Works immediately with HTTP calls
- No Redis required (queues optional)
- No Kafka required (event bus optional)
- Can add later for async processing

---

## Integration Examples

### Example 1: Send OTP (Auth Service)

**Current Implementation** (auth-service/src/modules/auth/clients/sms.client.ts):

```typescript
// SmsClient now calls notification-service instead of sms-service
constructor(private configService: ConfigService) {
  const notificationServiceUrl = this.configService.get<string>(
    'NOTIFICATION_SERVICE_URL',
    'http://notification-service:3008'
  );
  
  this.client = axios.create({
    baseURL: notificationServiceUrl,
    timeout: 15000,
  });
}

async sendOtp(phone: string, purpose: string = 'login') {
  // Calls: POST http://notification-service:3008/notifications/otp/send
  const response = await this.client.post('/notifications/otp/send', {
    phone,
    purpose,
  });
  return response.data;
}
```

### Example 2: Send Welcome Email

```typescript
// From any service
import axios from 'axios';

const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3008';

await axios.post(`${notificationServiceUrl}/notifications/email/send`, {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome', // Uses marketplace templates
  variables: {
    name: 'John Doe',
    dashboardUrl: 'https://example.com/dashboard'
  }
});
```

### Example 3: Send SMS Notification

```typescript
await axios.post(`${notificationServiceUrl}/notifications/sms/send`, {
  phone: '+1234567890',
  message: 'Your appointment is confirmed for tomorrow at 2 PM',
  purpose: 'notification'
});
```

### Example 4: Send Both Email & SMS

```typescript
await axios.post(`${notificationServiceUrl}/notifications/send`, {
  recipient: 'user@example.com', // or phone number
  channel: 'both', // 'email' | 'sms' | 'both'
  subject: 'Payment Received',
  message: 'Your payment of $50 has been processed.',
  template: 'paymentReceived',
  variables: {
    amount: 50,
    transactionId: 'TXN123'
  }
});
```

---

## Configuration

### Notification Service (.env)

```env
PORT=3008

# Email Service Integration
EMAIL_SERVICE_URL=http://email-service:3000
EMAIL_ENABLED=true

# SMS Service Integration
SMS_SERVICE_URL=http://sms-service:3000
SMS_ENABLED=false
SMS_API_KEY=your-api-key-here
```

### Auth Service (.env)

```env
# Notification Service URL (for OTP)
NOTIFICATION_SERVICE_URL=http://notification-service:3008
SMS_ENABLED=false
```

### Other Services

Any service that needs to send notifications should configure:

```env
NOTIFICATION_SERVICE_URL=http://notification-service:3008
```

---

## API Endpoints

### Notification Service

#### **POST /notifications/send**
Universal notification endpoint

**Request:**
```json
{
  "recipient": "user@example.com",
  "channel": "email",
  "subject": "Order Confirmation",
  "message": "Your order has been confirmed.",
  "template": "orderConfirmation",
  "variables": {
    "orderId": "123",
    "amount": 99.99
  }
}
```

**Response:**
```json
{
  "success": true,
  "email": {
    "success": true,
    "messageId": "abc123"
  }
}
```

#### **POST /notifications/email/send**
Send email directly

**Request:**
```json
{
  "to": "user@example.com",
  "subject": "Welcome!",
  "message": "Welcome to our platform",
  "template": "welcome",
  "variables": {
    "name": "John"
  }
}
```

#### **POST /notifications/sms/send**
Send SMS directly

**Request:**
```json
{
  "phone": "+1234567890",
  "message": "Your code is 123456",
  "purpose": "otp"
}
```

#### **POST /notifications/otp/send**
Send OTP via SMS

**Request:**
```json
{
  "phone": "+1234567890",
  "purpose": "login"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresAt": "2026-03-13T12:00:00Z"
}
```

#### **POST /notifications/otp/verify**
Verify OTP

**Request:**
```json
{
  "phone": "+1234567890",
  "code": "123456",
  "purpose": "login"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "message": "OTP verified successfully"
}
```

---

## Automated Business Event Notifications

The platform now sends **automatic email notifications** for key marketplace events:

### Implemented Notifications

| Event | Recipient | Template | Trigger |
|-------|-----------|----------|---------|
| **Proposal Submitted** | Customer | `newRequest` | When provider submits proposal |
| **Proposal Accepted** | Provider | `jobAssigned` | When customer accepts proposal |
| **Job Created** | Provider | `jobAssigned` | When job is assigned to provider |
| **Job Completed** | Customer | `paymentReceived` | When provider completes job |
| **OTP Requested** | User | SMS | When user requests phone login |

### How It Works

Each service (proposal-service, job-service, etc.) has a **NotificationClient** that automatically sends notifications when business events occur:

```typescript
// Example: proposal-service automatically sends email when proposal is created
await this.notificationClient.sendEmail({
  to: customerEmail,
  template: 'newRequest',
  variables: {
    providerName: 'John Doe',
    serviceName: 'Home Cleaning',
    price: 100,
    proposalUrl: 'https://example.com/proposals/123'
  }
});
```

### Adding Notifications to Other Services

To add automated notifications to any service:

1. **Copy NotificationClient to your service:**
   ```bash
   # Copy from proposal-service or job-service
   cp services/proposal-service/src/common/notification/* \
      services/your-service/src/common/notification/
   ```

2. **Add dependencies:**
   ```json
   // package.json
   {
     "dependencies": {
       "axios": "^1.6.0"
     }
   }
   ```

3. **Configure environment:**
   ```env
   # .env
   NOTIFICATION_SERVICE_URL=http://notification-service:3008
   EMAIL_ENABLED=true
   SMS_ENABLED=false
   ```

4. **Import NotificationModule:**
   ```typescript
   // app.module.ts
   import { NotificationModule } from './common/notification/notification.module';
   
   @Module({
     imports: [
       // ... other modules
       NotificationModule,
     ],
   })
   export class AppModule {}
   ```

5. **Inject and use NotificationClient:**
   ```typescript
   // your.service.ts
   import { NotificationClient } from '../../../common/notification/notification.client';
   
   @Injectable()
   export class YourService {
     constructor(
       private readonly notificationClient: NotificationClient,
     ) {}
     
     async someBusinessMethod() {
       // Business logic...
       
       // Send notification (non-blocking)
       this.notificationClient.sendEmail({
         to: 'user@example.com',
         template: 'templateName',
         variables: { key: 'value' }
       }).catch(err => {
         this.logger.warn(`Notification failed: ${err.message}`);
       });
     }
   }
   ```

### Available Email Templates

All templates are available in `marketplaceTemplates`:

- **welcome** - Welcome new users
- **emailVerification** - Email verification link
- **passwordReset** - Password reset link
- **newRequest** - New service request for providers
- **proposalReceived** - New proposal for customers
- **jobAssigned** - Job assigned to provider
- **paymentReceived** - Payment confirmation

### Notification Client API

```typescript
// Send email with template
await notificationClient.sendEmail({
  to: 'user@example.com',
  template: 'jobAssigned',
  variables: {
    customerName: 'John',
    serviceName: 'Plumbing',
    price: 150
  }
});

// Send SMS
await notificationClient.sendSms({
  phone: '+1234567890',
  message: 'Your service request has been accepted!',
  purpose: 'notification'
});

// Send both email and SMS
await notificationClient.sendBoth(
  { to: 'user@example.com', template: 'jobAssigned', variables: {...} },
  { phone: '+1234567890', message: 'Job assigned!' }
);

// Check if enabled
if (notificationClient.isEmailEnabled()) {
  // send email
}
```

### Important Notes

1. **Non-Blocking** - Notifications never throw errors. They log warnings if they fail.
2. **Production Ready** - Fetch real user data from user-service instead of placeholders.
3. **Template Variables** - Each template expects specific variables (see email templates).
4. **URL Configuration** - Set `FRONTEND_URL` environment variable for links in emails.

---

## Email Templates

### Available Marketplace Templates

Located in: `services/email-service/src/templates/emailTemplate.js`

```javascript
const { marketplaceTemplates } = require('./templates/emailTemplate');

// Available templates:
marketplaceTemplates.welcome
marketplaceTemplates.emailVerification
marketplaceTemplates.passwordReset
marketplaceTemplates.newRequest
marketplaceTemplates.proposalReceived
marketplaceTemplates.jobAssigned
marketplaceTemplates.paymentReceived
```

### Using Templates

```typescript
// Example: Send welcome email
await axios.post(`${notificationServiceUrl}/notifications/email/send`, {
  to: 'user@example.com',
  template: 'welcome',
  variables: {
    name: 'John Doe',
    dashboardUrl: 'https://example.com/dashboard'
  }
});
```

---

## Infrastructure Options

### Option 1: Direct HTTP (Default)
- No Redis/Kafka required
- Immediate delivery
- Simple deployment
- Good for: Development, small deployments

### Option 2: With Redis Queue (Optional)
- Async processing
- Retry failed deliveries
- Better for high volume
- Good for: Production with retry needs

### Option 3: With Kafka Event Bus (Optional)
- Event-driven architecture
- Full audit trail
- Distributed processing
- Good for: Large-scale production

**The system works perfectly with Option 1 (Direct HTTP) and can be upgraded later.**

---

## Service Integration Checklist

To integrate any service with notifications:

1. **Add environment variable:**
   ```env
   NOTIFICATION_SERVICE_URL=http://notification-service:3008
   ```

2. **Install axios:**
   ```bash
   npm install axios
   ```

3. **Create HTTP client or use axios directly**

4. **Call notification endpoints instead of email/SMS services**

---

## Testing

### Test OTP Flow

```bash
# 1. Send OTP
curl -X POST http://localhost:3008/notifications/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "purpose": "login"
  }'

# 2. Check SMS service logs for OTP code (mock mode)
docker-compose logs sms-service

# 3. Verify OTP
curl -X POST http://localhost:3008/notifications/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "code": "123456",
    "purpose": "login"
  }'
```

### Test Email

```bash
curl -X POST http://localhost:3008/notifications/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "template": "welcome",
    "variables": {
      "name": "Test User"
    }
  }'
```

---

## Benefits of This Architecture

✅ **Simplified Integration** - Services just call one endpoint  
✅ **No Event Bus Required** - Works with HTTP immediately  
✅ **Centralized Tracking** - All notifications logged in one place  
✅ **Easy Testing** - Mock notification service in tests  
✅ **Future-Proof** - Can add Redis/Kafka later without changing service code  
✅ **Single Responsibility** - Each service does one thing well  

---

## Migration Path

If you want to add async processing later:

1. **Enable Redis** (already configured in notification-service)
   ```env
   REDIS_ENABLED=true
   REDIS_HOST=redis
   REDIS_PORT=6379
   ```

2. **Notification service automatically uses queues** when Redis is available

3. **No changes needed in other services** - they still call HTTP endpoints

---

## Troubleshooting

### OTP Not Sending

1. Check SMS_ENABLED in notification-service:
   ```env
   SMS_ENABLED=true
   ```

2. Check notification-service logs:
   ```bash
   docker-compose logs notification-service
   ```

3. Check sms-service is running:
   ```bash
   docker-compose ps sms-service
   ```

### Email Not Sending

1. Check EMAIL_ENABLED in notification-service:
   ```env
   EMAIL_ENABLED=true
   ```

2. Check email-service is running:
   ```bash
   docker-compose ps email-service
   ```

3. Check SMTP configuration in email-service

---

## Next Steps

1. ✅ Notification service implemented
2. ✅ Auth service integrated (OTP)
3. ⏳ Add email notifications to other services
4. ⏳ Test end-to-end flows
5. ⏳ Enable SMS provider (Twilio/AWS SNS) for production
6. ⏳ Enable email provider (SendGrid/SES) for production

---

## Summary

**You can now send emails and SMS through notification-service with simple HTTP calls. No Redis, Kafka, or complex infrastructure needed!**

```typescript
// That's it! This is all you need:
await axios.post('http://notification-service:3008/notifications/otp/send', {
  phone: '+1234567890',
  purpose: 'login'
});
```
