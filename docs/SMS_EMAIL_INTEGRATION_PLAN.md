# SMS & Email Microservices Integration Plan

## Overview

This document outlines the integration of **SMS Delivery Service** and **Email Microservice** into the Local Service Marketplace platform.

---

## 1. Architecture Design

### Current Notification Flow
```
Notification Service (NestJS)
    ↓
Stores in PostgreSQL (notifications table)
    ↓
Sends email via Nodemailer (inline)
```

### New Architecture (With SMS & Email Microservices)
```
┌─────────────────────────────────────────────────────────┐
│              Application Services                       │
│  (auth, user, request, proposal, job, payment, etc.)   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│            Notification Service (Orchestrator)          │
│  • Decides: email, SMS, push, or in-app                │
│  • Stores notification logs in PostgreSQL              │
│  • Routes to appropriate delivery service              │
└─────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Email Service│  │  SMS Service │  │  Push Service│
│ (Node.js)    │  │  (Node.js)   │  │  (Future)    │
│              │  │              │  │              │
│ • Nodemailer │  │ • Twilio     │  │ • FCM/APNS   │
│ • Templates  │  │ • AWS SNS    │  │              │
│ • Queue      │  │ • Vonage     │  │              │
│ • Retry      │  │ • 20+ more   │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
        ↓                ↓                ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ MongoDB      │  │ MongoDB      │  │   Redis      │
│ • Email logs │  │ • SMS logs   │  │ • Rate limit │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 2. Service Responsibilities

### Notification Service (Orchestrator)
- **Port**: 3008
- **Database**: PostgreSQL (notifications, notification_deliveries tables)
- **Responsibilities**:
  - Create notification records
  - Determine delivery channels (email, SMS, push, in-app)
  - Route to Email/SMS services via HTTP or Kafka
  - Track delivery status
  - Handle notification preferences

### Email Microservice
- **Port**: 4000 (new)
- **Database**: MongoDB (email_logs collection)
- **Tech Stack**: Node.js, Express, Nodemailer, Kafka (optional)
- **Responsibilities**:
  - Send transactional emails
  - Send bulk/campaign emails
  - Template management (EJS, Handlebars)
  - Email queue with retry logic
  - Delivery tracking
  - Always enabled (EMAIL_ENABLED=true by default)

### SMS Microservice
- **Port**: 5000 (new)
- **Database**: MongoDB (sms_logs, otp_store collections)
- **Tech Stack**: Node.js, Express, Multiple SMS Providers
- **Responsibilities**:
  - Send SMS via 20+ providers
  - OTP generation and validation
  - SMS campaigns
  - Template management
  - Delivery tracking
  - Provider failover
  - Conditionally enabled (SMS_ENABLED env variable)

---

## 3. Communication Methods

### Option 1: HTTP (Recommended for MVP)
```
Notification Service → HTTP POST → Email/SMS Service
```

**Pros**: Simple, synchronous, easy debugging
**Cons**: Blocking, no retry if service is down

### Option 2: Kafka (Production Scale)
```
Notification Service → Kafka Topic → Email/SMS Service (Consumer)
```

**Pros**: Asynchronous, reliable, scalable, auto-retry
**Cons**: Requires Kafka infrastructure

### Implementation Strategy
- **Start with HTTP** (Phase 1)
- **Add Kafka support** when EVENT_BUS_ENABLED=true (Phase 2)

---

## 4. Database Schema Changes

### Notification Service (PostgreSQL)

**Update `notification_deliveries` table**:

```sql
ALTER TABLE notification_deliveries
ADD COLUMN delivery_method VARCHAR(50); -- 'email', 'sms', 'push', 'in_app'

ALTER TABLE notification_deliveries
ADD COLUMN external_message_id VARCHAR(255); -- ID from Email/SMS service

ALTER TABLE notification_deliveries
ADD COLUMN provider VARCHAR(50); -- 'smtp', 'twilio', 'aws_sns', etc.
```

### Email Service (MongoDB)

**Collection**: `email_logs`

```javascript
{
  _id: ObjectId,
  message_id: String, // Unique identifier
  tenant_id: String, // For multi-tenancy (optional)
  to: String,
  from: String,
  subject: String,
  template: String,
  variables: Object,
  status: String, // 'pending', 'sent', 'failed', 'bounced'
  provider: String, // 'gmail', 'sendgrid', etc.
  error: String,
  sent_at: Date,
  created_at: Date,
  updated_at: Date,
  metadata: Object, // notification_id, user_id, etc.
}
```

### SMS Service (MongoDB)

**Collection**: `sms_logs`

```javascript
{
  _id: ObjectId,
  message_id: String,
  phone: String, // Normalized format +[country][number]
  message: String,
  template_id: ObjectId,
  provider: String, // 'twilio', 'aws_sns', 'vonage', etc.
  status: String, // 'pending', 'sent', 'delivered', 'failed'
  delivery_status: String,
  cost: Number,
  error: String,
  sent_at: Date,
  delivered_at: Date,
  created_at: Date,
  metadata: Object,
}
```

**Collection**: `otp_store`

```javascript
{
  _id: ObjectId,
  phone: String,
  otp: String,
  purpose: String, // 'login', 'registration', 'verification'
  expires_at: Date,
  verified: Boolean,
  attempts: Number,
  created_at: Date,
}
```

---

## 5. Environment Variables

### Root `.env` (Feature Flags)

```env
# Email & SMS Feature Flags
EMAIL_ENABLED=true  # Always enabled
SMS_ENABLED=false   # Disabled by default (cost reasons)

# Email Service
EMAIL_SERVICE_URL=http://email-service:4000
EMAIL_SERVICE_API_KEY=your-secure-api-key

# SMS Service  
SMS_SERVICE_URL=http://sms-service:5000
SMS_SERVICE_API_KEY=your-secure-api-key

# Kafka (if using)
KAFKA_BROKERS=kafka:9092
KAFKA_EMAIL_TOPIC=email.notifications
KAFKA_SMS_TOPIC=sms.notifications
```

### Email Service `.env`

```env
NODE_ENV=production
PORT=4000
API_KEY=your-secure-api-key

# MongoDB
MONGODB_URI=mongodb://mongo:27017/email_service
MONGODB_DB_NAME=email_service

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Kafka (Optional)
KAFKA_ENABLED=false
KAFKA_BROKERS=kafka:9092
KAFKA_GROUP_ID=email-service-consumer
KAFKA_TOPIC=email.notifications

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Queue Configuration
QUEUE_ENABLED=true
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY_MS=5000
```

### SMS Service `.env`

```env
NODE_ENV=production
PORT=5000
API_KEY=your-secure-api-key

# MongoDB
MONGODB_URI=mongodb://mongo:27017/sms_service
MONGODB_DB_NAME=sms_service

# Redis (for rate limiting & OTP caching)
REDIS_URL=redis://redis:6379
REDIS_ENABLED=true

# SMS Providers (Configure at least one)
# Twilio
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890

# AWS SNS
AWS_SNS_ENABLED=false
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Vonage (Nexmo)
VONAGE_ENABLED=false
VONAGE_API_KEY=your-api-key
VONAGE_API_SECRET=your-api-secret
VONAGE_FROM_NUMBER=YourBrand

# Default Provider (fallback)
DEFAULT_SMS_PROVIDER=twilio

# Provider Failover (comma-separated)
SMS_PROVIDER_PRIORITY=twilio,aws_sns,vonage

# OTP Configuration
OTP_LENGTH=6
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=3

# Kafka (Optional)
KAFKA_ENABLED=false
KAFKA_BROKERS=kafka:9092
KAFKA_GROUP_ID=sms-service-consumer
KAFKA_TOPIC=sms.notifications
```

---

## 6. Docker Compose Integration

### Add Services to `docker-compose.yml`

```yaml
services:
  # ... existing services ...

  # Email Microservice
  email-service:
    build: ./services/email-service
    container_name: email-service
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 4000
      API_KEY: ${EMAIL_SERVICE_API_KEY}
      MONGODB_URI: mongodb://mongo:27017/email_service
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      KAFKA_ENABLED: ${EVENT_BUS_ENABLED:-false}
      KAFKA_BROKERS: ${KAFKA_BROKERS:-kafka:9092}
    depends_on:
      - mongo-email
    networks:
      - marketplace-network
    volumes:
      - ./services/email-service:/app
      - /app/node_modules
    profiles:
      - email
      - full

  # MongoDB for Email Service
  mongo-email:
    image: mongo:7
    container_name: mongo-email
    ports:
      - "27018:27017"
    environment:
      MONGO_INITDB_DATABASE: email_service
    volumes:
      - mongo-email-data:/data/db
    networks:
      - marketplace-network
    profiles:
      - email
      - full

  # SMS Microservice
  sms-service:
    build: ./services/sms-service
    container_name: sms-service
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 5000
      API_KEY: ${SMS_SERVICE_API_KEY}
      MONGODB_URI: mongodb://mongo:27017/sms_service
      REDIS_URL: redis://redis:6379
      TWILIO_ENABLED: ${TWILIO_ENABLED:-true}
      TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID}
      TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN}
      TWILIO_FROM_NUMBER: ${TWILIO_FROM_NUMBER}
      DEFAULT_SMS_PROVIDER: ${DEFAULT_SMS_PROVIDER:-twilio}
      KAFKA_ENABLED: ${EVENT_BUS_ENABLED:-false}
      KAFKA_BROKERS: ${KAFKA_BROKERS:-kafka:9092}
    depends_on:
      - mongo-sms
      - redis
    networks:
      - marketplace-network
    volumes:
      - ./services/sms-service:/app
      - /app/node_modules
    profiles:
      - sms
      - full
    # Only start if SMS_ENABLED=true
    deploy:
      replicas: ${SMS_ENABLED:-0}

  # MongoDB for SMS Service
  mongo-sms:
    image: mongo:7
    container_name: mongo-sms
    ports:
      - "27019:27017"
    environment:
      MONGO_INITDB_DATABASE: sms_service
    volumes:
      - mongo-sms-data:/data/db
    networks:
      - marketplace-network
    profiles:
      - sms
      - full

volumes:
  mongo-email-data:
  mongo-sms-data:
```

---

## 7. API Specifications

### Email Service API

**Base URL**: `http://localhost:4000`

#### Send Email (Single)
```http
POST /api/email/send
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Welcome to Marketplace",
  "template": "welcome",
  "variables": {
    "name": "John Doe",
    "verification_link": "https://..."
  },
  "metadata": {
    "notification_id": "uuid",
    "user_id": "uuid"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message_id": "msg_123abc",
  "status": "sent"
}
```

#### Send Bulk Email
```http
POST /api/email/bulk
Authorization: Bearer {API_KEY}

{
  "recipients": [
    {
      "to": "user1@example.com",
      "variables": { "name": "User 1" }
    },
    {
      "to": "user2@example.com",
      "variables": { "name": "User 2" }
    }
  ],
  "subject": "New Feature Alert",
  "template": "feature_announcement"
}
```

#### Get Email Status
```http
GET /api/email/status/:message_id
Authorization: Bearer {API_KEY}
```

---

### SMS Service API

**Base URL**: `http://localhost:5000`

#### Send SMS (Single)
```http
POST /api/sms/send
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "phone": "+1234567890",
  "message": "Your OTP is 123456",
  "provider": "twilio",
  "metadata": {
    "notification_id": "uuid",
    "user_id": "uuid"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message_id": "sms_456def",
  "provider": "twilio",
  "status": "sent",
  "cost": 0.0075
}
```

#### Send OTP
```http
POST /api/sms/otp/send
Authorization: Bearer {API_KEY}

{
  "phone": "+1234567890",
  "purpose": "login"
}
```

**Response**:
```json
{
  "success": true,
  "message_id": "sms_789ghi",
  "expires_at": "2026-03-13T10:15:00Z"
}
```

#### Verify OTP
```http
POST /api/sms/otp/verify
Authorization: Bearer {API_KEY}

{
  "phone": "+1234567890",
  "otp": "123456",
  "purpose": "login"
}
```

**Response**:
```json
{
  "success": true,
  "valid": true
}
```

---

## 8. Notification Service Integration

### Update Notification Service

**File**: `services/notification-service/src/notification/services/notification.service.ts`

```typescript
import axios from 'axios';

@Injectable()
export class NotificationService {
  private readonly emailServiceUrl = process.env.EMAIL_SERVICE_URL;
  private readonly smsServiceUrl = process.env.SMS_SERVICE_URL;
  private readonly emailEnabled = process.env.EMAIL_ENABLED === 'true';
  private readonly smsEnabled = process.env.SMS_ENABLED === 'true';

  async sendEmailNotification(data: EmailNotificationDto) {
    if (!this.emailEnabled) {
      this.logger.log('Email service is disabled');
      return;
    }

    try {
      const response = await axios.post(
        `${this.emailServiceUrl}/api/email/send`,
        {
          to: data.email,
          subject: data.subject,
          template: data.template,
          variables: data.variables,
          metadata: {
            notification_id: data.notificationId,
            user_id: data.userId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.EMAIL_SERVICE_API_KEY}`,
          },
        },
      );

      // Update notification delivery status
      await this.updateDeliveryStatus({
        notificationId: data.notificationId,
        deliveryMethod: 'email',
        externalMessageId: response.data.message_id,
        status: 'sent',
        provider: 'smtp',
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to send email', error);
      await this.updateDeliveryStatus({
        notificationId: data.notificationId,
        deliveryMethod: 'email',
        status: 'failed',
        error: error.message,
      });
      throw error;
    }
  }

  async sendSMSNotification(data: SMSNotificationDto) {
    if (!this.smsEnabled) {
      this.logger.log('SMS service is disabled');
      return null;
    }

    try {
      const response = await axios.post(
        `${this.smsServiceUrl}/api/sms/send`,
        {
          phone: data.phone,
          message: data.message,
          metadata: {
            notification_id: data.notificationId,
            user_id: data.userId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SMS_SERVICE_API_KEY}`,
          },
        },
      );

      await this.updateDeliveryStatus({
        notificationId: data.notificationId,
        deliveryMethod: 'sms',
        externalMessageId: response.data.message_id,
        status: 'sent',
        provider: response.data.provider,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to send SMS', error);
      await this.updateDeliveryStatus({
        notificationId: data.notificationId,
        deliveryMethod: 'sms',
        status: 'failed',
        error: error.message,
      });
      throw error;
    }
  }

  private async updateDeliveryStatus(data: any) {
    // Update notification_deliveries table
    const query = `
      INSERT INTO notification_deliveries 
      (notification_id, delivery_method, external_message_id, status, provider, error)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await this.pool.query(query, [
      data.notificationId,
      data.deliveryMethod,
      data.externalMessageId,
      data.status,
      data.provider,
      data.error,
    ]);
  }
}
```

---

## 9. Smart Start Script Update

Update `start.ps1` to handle Email and SMS services:

```powershell
# ... existing code ...

# Parse EMAIL_ENABLED and SMS_ENABLED
$EMAIL_ENABLED = if ($envContent -match 'EMAIL_ENABLED=(.+)') { $matches[1].Trim() -eq 'true' } else { $true }
$SMS_ENABLED = if ($envContent -match 'SMS_ENABLED=(.+)') { $matches[1].Trim() -eq 'true' } else { $false }

# Build profiles
$profiles = @()
if ($CACHE_ENABLED) { $profiles += "cache" }
if ($EVENT_BUS_ENABLED) { $profiles += "events" }
if ($FRONTEND_ENABLED) { $profiles += "frontend" }
if ($API_GATEWAY_ENABLED) { $profiles += "gateway" }
if ($EMAIL_ENABLED) { $profiles += "email" }
if ($SMS_ENABLED) { $profiles += "sms" }

# Display configuration
Write-Host "`n━━━ Notification Channels ━━━" -ForegroundColor Cyan
Write-Host "  Email:     " -NoNewline
Write-Host $(if ($EMAIL_ENABLED) { "✓ Enabled" } else { "✗ Disabled" }) -ForegroundColor $(if ($EMAIL_ENABLED) { "Green" } else { "Yellow" })
Write-Host "  SMS:       " -NoNewline
Write-Host $(if ($SMS_ENABLED) { "✓ Enabled" } else { "✗ Disabled" }) -ForegroundColor $(if ($SMS_ENABLED) { "Green" } else { "Yellow" })

# Access points
if ($EMAIL_ENABLED) {
    Write-Host "  Email Service:      http://localhost:4000" -ForegroundColor White
}
if ($SMS_ENABLED) {
    Write-Host "  SMS Service:        http://localhost:5000" -ForegroundColor White
}
```

---

## 10. Testing Strategy

### Email Service Testing

```bash
# Test email sending
curl -X POST http://localhost:4000/api/email/send \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "template": "test",
    "variables": {
      "name": "Test User"
    }
  }'
```

### SMS Service Testing

```bash
# Test SMS sending
curl -X POST http://localhost:5000/api/sms/send \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "message": "Test SMS from Marketplace"
  }'

# Test OTP flow
curl -X POST http://localhost:5000/api/sms/otp/send \
  -H "Authorization: Bearer your-api-key" \
  -d '{"phone": "+1234567890", "purpose": "login"}'

curl -X POST http://localhost:5000/api/sms/otp/verify \
  -H "Authorization: Bearer your-api-key" \
  -d '{"phone": "+1234567890", "otp": "123456", "purpose": "login"}'
```

---

## 11. Migration Steps

### Phase 1: Email Service (Week 1-2)
1. ✅ Copy reference email-microservice to `services/email-service`
2. ✅ Adapt to marketplace architecture
3. ✅ Add to docker-compose with profile `email`
4. ✅ Update notification-service to call email service
5. ✅ Configure SMTP credentials
6. ✅ Test transactional emails (signup, reset password)
7. ✅ Migrate existing email templates

### Phase 2: SMS Service (Week 3-4)
1. ✅ Copy reference sms-delivery-service to `services/sms-service`
2. ✅ Configure Twilio provider (primary)
3. ✅ Add to docker-compose with profile `sms` and `SMS_ENABLED` check
4. ✅ Update notification-service to call SMS service
5. ✅ Implement OTP flow for auth-service
6. ✅ Test SMS delivery
7. ✅ Add provider failover (AWS SNS backup)

### Phase 3: Enhanced Features (Week 5-6)
1. ✅ Add Kafka support for async messaging
2. ✅ Implement webhook endpoints for delivery status
3. ✅ Add email/SMS analytics dashboard
4. ✅ Implement notification preferences (user settings)
5. ✅ Add bulk email/SMS campaigns
6. ✅ Set up monitoring and alerting

---

## 12. Cost Considerations

### Email Costs
- **Free tier**: Gmail SMTP (100 emails/day)
- **Low volume**: SendGrid (100 emails/day free)
- **Medium volume**: AWS SES ($0.10 per 1,000 emails)
- **High volume**: Mailgun, Postmark ($0.50-$1.00 per 1,000 emails)

**Recommendation**: Start with Gmail SMTP, switch to AWS SES at scale

### SMS Costs
- **Twilio**: ~$0.0075 per SMS (US)
- **AWS SNS**: ~$0.00645 per SMS (US)
- **Vonage**: ~$0.0072 per SMS (US)

**Recommendation**: 
- Keep SMS_ENABLED=false initially
- Enable only for critical notifications (OTP, payment alerts)
- Use email for non-urgent notifications

**Example monthly cost** (1000 users, 5 SMS/month each):
- 5,000 SMS × $0.0075 = **$37.50/month**

---

## 13. Monitoring & Alerting

### Key Metrics

**Email Service**:
- Emails sent/hour
- Delivery rate (sent/total)
- Bounce rate
- Open rate (if tracking enabled)
- Average send time

**SMS Service**:
- SMS sent/hour
- Delivery rate
- Provider failover rate
- Average cost per SMS
- OTP success rate

### Alerting Rules

```yaml
alerts:
  - name: Email delivery rate low
    condition: delivery_rate < 95%
    severity: warning
    
  - name: SMS provider down
    condition: provider_errors > 10 in 5 minutes
    severity: critical
    action: failover to backup provider
    
  - name: High SMS cost
    condition: daily_cost > budget_limit
    severity: warning
    action: pause non-critical SMS
```

---

## Completion Checklist

**Email Service**:
- [ ] Copy reference code to `services/email-service`
- [ ] Configure SMTP credentials
- [ ] Add to docker-compose with profile
- [ ] Update notification-service integration
- [ ] Create email templates
- [ ] Test email delivery
- [ ] Add MongoDB logging

**SMS Service**:
- [ ] Copy reference code to `services/sms-service`
- [ ] Configure Twilio account
- [ ] Add SMS_ENABLED environment variable
- [ ] Implement conditional startup in docker-compose
- [ ] Update notification-service integration
- [ ] Test SMS delivery
- [ ] Implement OTP flow

**Integration**:
- [ ] Update notification-service API client
- [ ] Add delivery status tracking
- [ ] Implement notification preferences
- [ ] Add admin dashboard for logs
- [ ] Set up monitoring
- [ ] Document cost tracking

---

**Estimated Implementation Time**: 
- **Email Service Integration**: 1-2 weeks
- **SMS Service Integration**: 1-2 weeks
- **Enhanced Features**: 1-2 weeks
- **Total**: 4-6 weeks

**Total Development Hours**: 120-180 hours
