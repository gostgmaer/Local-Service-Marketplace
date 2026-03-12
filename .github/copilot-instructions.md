# Copilot Instructions

This repository contains a **microservices-based Local Service Marketplace platform**.

All AI-generated code must follow the architecture and service boundaries defined in the documentation.

Important documentation:

docs/ARCHITECTURE.md
docs/MICROSERVICE_BOUNDARY_MAP.md
docs/API_SPECIFICATION.md
docs/IMPLEMENTATION_GUIDE.md
database/schema.sql

---

# Architecture Principles

The platform is built using a **microservices architecture**.

Rules:

* Each service must be independent
* Each service owns its database tables
* Services communicate via HTTP APIs or events
* Never perform cross-service database joins
* Use pagination for large queries
* Infrastructure layers (Redis, Kafka) must be optional

---

# Technology Stack

Frontend

Next.js

Backend Framework

NestJS

Database

PostgreSQL

Cache / Queue

Redis

Event Streaming

Kafka

Containerization

Docker

Orchestration

Kubernetes

---

# Backend Framework Rules

All Node.js services must use **NestJS**.

Project structure must follow NestJS module architecture.

Example structure:

```text
src/

modules/
controllers/
services/
repositories/
dto/
entities/

main.ts
app.module.ts
```

Controllers handle HTTP requests.

Services contain business logic.

Repositories handle database queries.

---

# Microservices

Core services in the platform:

auth-service
user-service
provider-service
request-service
proposal-service
job-service
payment-service
notification-service
review-service
messaging-service
admin-service
analytics-service
infrastructure-service

Each service must:

* run as a separate container
* expose REST APIs
* own its database tables
* follow layered architecture

---

# Service Boundaries

Auth Service owns

users
sessions
email_verification_tokens
password_reset_tokens
login_attempts
social_accounts
user_devices

User Service owns

providers
provider_services
provider_availability
favorites
locations

Request Service owns

service_requests
service_categories
service_request_search

Proposal Service owns

proposals

Job Service owns

jobs

Payment Service owns

payments
refunds
payment_webhooks
coupons
coupon_usage

Review Service owns

reviews

Messaging Service owns

messages
attachments

Notification Service owns

notifications
notification_deliveries

Admin Service owns

admin_actions
disputes
audit_logs
system_settings

Analytics Service owns

user_activity_logs
daily_metrics

Infrastructure Service owns

events
background_jobs
rate_limits
feature_flags

---

# API Design Rules

All APIs must follow REST conventions.

Example endpoints:

POST /requests
GET /requests
GET /requests/{id}
PATCH /requests/{id}

Responses must be JSON.

All list endpoints must support pagination.

Example:

GET /requests?limit=20&cursor=xyz

---

# Database Rules

Primary keys must use UUID.

Never join tables across services.

Example of invalid query:

SELECT *
FROM service_requests
JOIN payments

Instead call the Payment Service API.

---

# Validation

Use DTO validation with class-validator.

Example DTO:

```typescript
export class CreateRequestDto {
  description: string
  categoryId: string
  budget: number
}
```

---

# Background Jobs

Heavy tasks must run in worker services.

Examples:

send emails
process analytics
deliver notifications
retry failed payments

Workers should consume tasks from Redis queues.

---

# Event System

When event streaming is enabled, services communicate through events.

Example events:

request_created
proposal_submitted
job_started
payment_completed
review_submitted

Events must also be stored in the events table.

---

# Security Requirements

Passwords must be hashed using bcrypt.

Authentication must use JWT tokens.

Sensitive actions must be logged.

Login attempts must be tracked.

Rate limiting must be implemented.

---

# Logging

All services must implement structured logging.

Log fields should include:

timestamp
service_name
request_id
user_id
action

---

# Performance Rules

Always paginate queries.

Limit large responses.

Cache frequently accessed data.

Avoid expensive joins.

Move heavy tasks to workers.

---

# Code Generation Guidelines

When generating code:

Follow NestJS module structure.

Respect service boundaries.

Do not modify database schema unless migrations are requested.

Reuse existing utilities and patterns.

Include validation, error handling, and logging.

---

End of Copilot Instructions
