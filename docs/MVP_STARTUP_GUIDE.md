# MVP Startup Guide - Minimal Services Configuration

This guide shows you how to start **only the essential services** for your MVP launch without Redis, Kafka, messaging, or unnecessary notification features.

---

## 🎯 What's Enabled for MVP?

### ✅ **ENABLED (Essential Services)**
- **Database:** PostgreSQL
- **API Gateway:** Entry point for all requests
- **Auth Service:** User authentication & authorization
- **User Service:** User & provider profiles
- **Request Service:** Service requests management
- **Proposal Service:** Provider proposals
- **Job Service:** Job management
- **Payment Service:** Payment processing
- **Review Service:** Reviews & ratings
- **Admin Service:** Platform administration (including contact form)
- **Notification Service:** Email & SMS notifications ONLY
- **Email Service:** Transactional emails

### ❌ **DISABLED (Optional Services)**
- ❌ **Analytics Service:** Use Google Analytics instead (not needed for MVP)
- ❌ **Infrastructure Service:** Use external tools for monitoring (not needed for MVP)
- ❌ **Messaging Service:** Real-time chat (not needed yet)
- ❌ **SMS Service:** Optional (enable only if using SMS)
- ❌ **Redis:** Cache layer (not needed for MVP)
- ❌ **Kafka:** Event streaming (not needed for MVP)
- ❌ **In-app notifications:** (not needed yet)
- ❌ **Push notifications:** (not needed yet)
- ❌ **Device tracking:** (not needed yet)
- ❌ **Notification preferences:** (not needed yet)

---

## 🚀 Quick Start - MVP Configuration

### 1. Start Core Services Only

```bash
# Start Docker Desktop first (manually)

# Start only essential services (no Redis, Kafka, Messaging, or Infrastructure)
docker-compose up -d postgres
docker-compose up -d auth-service user-service request-service proposal-service job-service
docker-compose up -d payment-service review-service admin-service notification-service
docker-compose up -d email-service analytics-service api-gateway

# Or start all with one command (excludes optional services)
docker-compose up -d
```

**Note:** Services with `profiles` (messaging, infrastructure, redis, kafka) will NOT start unless you explicitly include those profiles.

---

## 📋 Services That Will Start (11 services)

```
✅ postgres (database)
✅ api-gateway (port 3500)
✅ auth-service (port 3001)
✅ user-service (port 3002)
✅ request-service (port 3003)
✅ proposal-service (port 3004)
✅ job-service (port 3005)
✅ payment-service (port 3006)
✅ notification-service (port 3008)
✅ review-service (port 3009)
✅ admin-service (port 3010)
✅ email-service (port 3500)
```

---

## 🔧 Environment Variables - MVP Configuration

All services are already configured with these defaults in `docker-compose.yml`:

```env
# Infrastructure (DISABLED)
CACHE_ENABLED=false
EVENT_BUS_ENABLED=false
WORKERS_ENABLED=false
BACKGROUND_JOBS_ENABLED=false

# Optional Services (DISABLED)
ANALYTICS_ENABLED=false
INFRASTRUCTURE_ENABLED=false

# Notification Features (DISABLED)
IN_APP_NOTIFICATIONS_ENABLED=false
PUSH_NOTIFICATIONS_ENABLED=false
NOTIFICATION_PREFERENCES_ENABLED=false
DEVICE_TRACKING_ENABLED=false

# Notification Channels (ENABLED)
EMAIL_ENABLED=true
SMS_ENABLED=false  # Set to true if using SMS

# Security (ENABLED)
RATE_LIMITING_ENABLED=true
FEATURE_FLAGS_ENABLED=true
```

**You don't need to change anything!** The defaults are already set for MVP.

---

## 🛑 Services That WON'T Start (Without Profiles)

These services have Docker profiles and will NOT start by default:

```
❌ analytics-service (profile: analytics, full)
❌ messaging-service (profile: messaging, full)
❌ infrastructure-service (profile: infrastructure, scaling, full)
❌ redis (profile: scaling, cache)
❌ kafka (profile: scaling, events)
❌ zookeeper (profile: scaling, events)
```

---

## 📊 Service Dependencies - MVP

```
Frontend → API Gateway → All Services → PostgreSQL
                              ↓
                     Email Service (for notifications)
```

**No Redis or Kafka needed!**

---

## ⚙️ Environment Variable Reference

### Notification Service Feature Flags

```env
# Email/SMS Channels
EMAIL_ENABLED=true              # ✅ Keep enabled
SMS_ENABLED=false               # ⚪ Enable if using Twilio/SMS

# Advanced Features (Disable for MVP)
IN_APP_NOTIFICATIONS_ENABLED=false    # ❌ In-app notification bell
PUSH_NOTIFICATIONS_ENABLED=false      # ❌ Mobile push notifications
NOTIFICATION_PREFERENCES_ENABLED=false # ❌ User notification settings
DEVICE_TRACKING_ENABLED=false         # ❌ Track user devices
```

### Infrastructure Service Feature Flags

```env
CACHE_ENABLED=false                   # ❌ Redis cache
EVENT_BUS_ENABLED=false               # ❌ Kafka events
BACKGROUND_JOBS_ENABLED=false         # ❌ Job queue
RATE_LIMITING_ENABLED=true            # ✅ API rate limiting
FEATURE_FLAGS_ENABLED=true            # ✅ Feature toggles
```

---

## 🔓 Optional Services - How to Enable Later

### Enable Analytics Service

```bash
# Start analytics service
docker-compose --profile analytics up -d analytics-service

# Or include in full stack
docker-compose --profile full up -d
```

### Enable Messaging (Chat)

```bash
# Start messaging service
docker-compose --profile messaging up -d messaging-service

# Or include in full stack
docker-compose --profile full up -d
```

### Enable Infrastructure Service

```bash
# Start infrastructure service
docker-compose --profile infrastructure up -d infrastructure-service

# Or with scaling features
docker-compose --profile scaling up -d
```

### Enable Redis Cache

```bash
# Start Redis
docker-compose --profile cache up -d redis

# Update services to enable cache
# Set CACHE_ENABLED=true in docker-compose.yml or .env
docker-compose restart auth-service user-service request-service
```

### Enable Kafka Event Streaming

```bash
# Start Kafka & Zookeeper
docker-compose --profile events up -d zookeeper kafka

# Update services to enable events
# Set EVENT_BUS_ENABLED=true in docker-compose.yml or .env
docker-compose restart all-services
```

### Enable All Features (Full Stack)

```bash
# Start everything including optional services
docker-compose --profile full --profile cache --profile events up -d
```

---

## 📝 Verify Services Running

```bash
# Check running containers
docker ps --filter "name=marketplace" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check service health
curl http://localhost:3500/health/services

# Check individual services
curl http://localhost:3001/health  # auth-service
curl http://localhost:3002/health  # user-service
curl http://localhost:3008/health  # notification-service
curl http://localhost:3010/health  # admin-service
```

---

## 🧪 Test Contact Form End-to-End

```bash
# 1. Start services
docker-compose up -d

# 2. Wait for services to be ready (30 seconds)
Start-Sleep -Seconds 30

# 3. Test contact form API
curl -X POST http://localhost:3500/api/v1/admin/contact `
  -H "Content-Type: application/json" `
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test Contact Form",
    "message": "This is a test message from the MVP setup."
  }'

# 4. Check database
docker exec -it marketplace-postgres psql -U postgres -d marketplace -c "SELECT id, name, email, subject, status, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5;"
```

---

## 🎛️ Feature Toggle Matrix

| Feature | MVP | Scale | Full |
|---------|-----|-------|------|
| **PostgreSQL** | ✅ | ✅ | ✅ |
| **Auth/User/Request/Job/Payment** | ✅ | ✅ | ✅ |
| **Email Notifications** | ✅ | ✅ | ✅ |
| **SMS Notifications** | ⚪ | ⚪ | ⚪ |
| **Chat/Messaging** | ❌ | ✅ | ✅ |
| **In-App Notifications** | ❌ | ✅ | ✅ |
| **Push Notifications** | ❌ | ⚪ | ✅ |
| **Redis Cache** | ❌ | ✅ | ✅ |
| **Kafka Events** | ❌ | ⚪ | ✅ |
| **Infrastructure Service** | ❌ | ✅ | ✅ |
| **Background Jobs** | ❌ | ✅ | ✅ |

**Legend:** ✅ Enabled | ❌ Disabled | ⚪ Optional

---

## 📦 Service Count by Configuration

### MVP Configuration (Minimal)
- **Services:** 11 (no analytics, no messaging, no infrastructure, no Redis, no Kafka)
- **Containers:** 11
- **Memory:** ~3-5 GB
- **Startup Time:** ~25-35 seconds

### Scaling Configuration
- **Services:** 14 (+ analytics, + messaging, + infrastructure)
- **Containers:** 15 (+ Redis, no Kafka)
- **Memory:** ~6-8 GB
- **Startup Time:** ~45-60 seconds

### Full Configuration
- **Services:** 14 (all services)
- **Containers:** 17 (+ Redis, + Kafka, + Zookeeper)
- **Memory:** ~8-12 GB
- **Startup Time:** ~60-90 seconds

---

## 🔄 Migration Path

### Stage 1 - MVP (Current)
```bash
docker-compose up -d
# 11 services, no Redis/Kafka, no analytics
```

### Stage 2 - Add Analytics
```bash
docker-compose --profile analytics up -d
# 12 services (+ analytics)
```

### Stage 3 - Add Messaging
```bash
docker-compose --profile messaging up -d
# 13 services (+ messaging)
```

### Stage 4 - Add Caching
```bash
docker-compose --profile cache up -d redis
# Edit docker-compose.yml: CACHE_ENABLED=true
docker-compose restart auth-service user-service request-service
```

### Stage 5 - Add Infrastructure & Events
```bash
docker-compose --profile infrastructure --profile events up -d
# Edit docker-compose.yml: EVENT_BUS_ENABLED=true
docker-compose restart all-services
```

### Stage 6 - Full Production
```bash
docker-compose --profile full --profile cache --profile events up -d
# All 17 containers running
```

---

## 🚨 Troubleshooting

### Services not starting?
```bash
# Check Docker Desktop is running
docker info

# Check logs
docker-compose logs -f auth-service
docker-compose logs -f notification-service

# Restart specific service
docker-compose restart notification-service
```

### Database connection errors?
```bash
# Check postgres is running
docker ps | grep postgres

# Check database
docker exec -it marketplace-postgres psql -U postgres -c "\l"

# Apply schema if missing
docker exec -i marketplace-postgres psql -U postgres -d marketplace < database/schema.sql
```

### Feature flag not working?
```bash
# Check environment variables
docker exec notification-service env | grep ENABLED

# Restart service to pick up changes
docker-compose restart notification-service
```

---

## 📖 Related Documentation

- [Architecture Guide](./ARCHITECTURE.md)
- [API Specification](./API_SPECIFICATION.md)
- [Contact Form System](./CONTACT_FORM_SYSTEM.md)
- [Docker Optimization](./DOCKER_OPTIMIZATION.md)

---

## ✅ MVP Launch Checklist

- [ ] Docker Desktop running
- [ ] Database schema applied
- [ ] Environment variables configured
- [ ] 11 core services started successfully
- [ ] API Gateway responding (http://localhost:3500/health)
- [ ] Frontend connected (http://localhost:3000)
- [ ] Contact form tested
- [ ] Email notifications working
- [ ] Authentication tested
- [ ] Payment integration configured (Stripe/PayPal keys)
- [ ] Google Analytics configured (instead of analytics-service)

---

**Your MVP is now running with minimal infrastructure!** 🎉

You can add messaging, caching, and event streaming later as your platform grows, without rewriting any code - just enable the feature flags and start the additional services!
