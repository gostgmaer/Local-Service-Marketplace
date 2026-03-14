# Quick Reference Guide - Schema Enhancements
**Last Updated**: March 14, 2026

This is a condensed reference for developers implementing the schema enhancements.

---

## 📊 At a Glance

**Database**: ✅ Ready (67 columns + 7 tables)  
**Backend**: ❌ 0% implemented  
**Frontend**: ❌ 0% implemented  
**Work Required**: 128-163 hours (3-4 weeks)

---

## 🔥 Quick Implementation Path

### Day 1-3: Update Entities (16-20h)
Update these files first:

```typescript
// 1. User entity - Add 6 fields
services/auth-service/src/modules/auth/entities/user.entity.ts
+ profile_picture_url?: string
+ timezone: string (default: 'UTC')
+ language: string (default: 'en')
+ phone_verified: boolean
+ last_login_at?: Date

// 2. Provider entity - Add 8 fields
services/user-service/src/modules/user/entities/provider.entity.ts
+ verification_status: string
+ certifications?: any
+ years_of_experience?: number
+ service_area_radius?: number
+ response_time_avg?: number
+ total_jobs_completed: number
+ profile_picture_url?: string

// 3. ServiceRequest entity - Add 5 fields
services/request-service/src/modules/request/entities/service-request.entity.ts
+ images?: string[]
+ preferred_date?: Date
+ urgency: string
+ expiry_date?: Date
+ view_count: number

// 4-9. Repeat for Proposal, Job, Payment, Review, Message, Coupon
// See PHASE_1 guide for details
```

### Day 4-5: DTOs & Validation (12-16h)
Add validation decorators:

```typescript
// Example DTO update
export class UpdateProfileDto {
  @IsOptional()
  @IsUrl()
  profile_picture_url?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(['en', 'es', 'fr', 'de', 'zh'])
  language?: string;
}
```

### Week 2: New Tables (40-50h)
Implement in priority order:

1. **provider_documents** (8-10h) - CRITICAL
2. **saved_payment_methods** (6-8h) - CRITICAL
3. **notification_preferences** (4-6h) - HIGH
4. **provider_portfolio** (6-8h) - MEDIUM
5. **pricing_plans** (5-7h) - DEFER if needed
6. **subscriptions** (7-9h) - DEFER if needed
7. **provider_review_aggregates** (3-4h) - AUTO (triggers)

### Week 3: Frontend (30-40h)
Build UI components:

```typescript
// Priority components:
1. ProfilePictureUpload.tsx
2. SettingsForm.tsx (timezone/language)
3. PhoneVerification.tsx
4. ImageUploader.tsx (requests)
5. VerificationBadge.tsx
6. DocumentUpload.tsx

// See PHASE_5 guide for code
```

### Week 4: Testing & Deploy (20-25h)
- Write unit tests
- Run integration tests
- Load test with k6
- Deploy to production

---

## 📝 New Columns Quick Reference

### users table (6 new columns)
```sql
profile_picture_url VARCHAR(500)
timezone VARCHAR(50) DEFAULT 'UTC'
language VARCHAR(10) DEFAULT 'en'
phone_verified BOOLEAN DEFAULT FALSE
last_login_at TIMESTAMP
-- deleted_at already exists
```

### providers table (8 new columns)
```sql
verification_status VARCHAR(20) DEFAULT 'pending'
certifications JSONB
years_of_experience INTEGER
service_area_radius INTEGER
response_time_avg INTEGER
total_jobs_completed INTEGER DEFAULT 0
profile_picture_url VARCHAR(500)
-- deleted_at already exists
```

### service_requests table (5 new columns)
```sql
images JSONB
preferred_date TIMESTAMP
urgency VARCHAR(20) DEFAULT 'medium'
expiry_date TIMESTAMP
view_count INTEGER DEFAULT 0
```

### proposals table (4 new columns)
```sql
estimated_hours INTEGER
start_date DATE
completion_date DATE
rejected_reason TEXT
```

### jobs table (4 new columns)
```sql
customer_id UUID -- REQUIRED now
actual_amount INTEGER
cancelled_by VARCHAR(50)
cancellation_reason TEXT
```

### payments table (6 new columns)
```sql
user_id UUID NOT NULL -- was optional
provider_id UUID NOT NULL -- NEW
platform_fee INTEGER NOT NULL -- NEW
provider_amount INTEGER NOT NULL -- NEW
payment_method VARCHAR(50) -- NEW
failed_reason TEXT -- NEW
```

### reviews table (4 new columns)
```sql
response TEXT
response_at TIMESTAMP
helpful_count INTEGER DEFAULT 0
verified_purchase BOOLEAN DEFAULT TRUE
```

### messages table (4 new columns)
```sql
read BOOLEAN DEFAULT FALSE
read_at TIMESTAMP
edited BOOLEAN DEFAULT FALSE
edited_at TIMESTAMP
```

### coupons table (5 new columns)
```sql
max_uses INTEGER
max_uses_per_user INTEGER DEFAULT 1
min_purchase_amount INTEGER
active BOOLEAN DEFAULT TRUE
created_by UUID
```

### sessions table (2 new columns)
```sql
device_type VARCHAR(50)
location VARCHAR(100)
```

### login_attempts table (2 new columns)
```sql
user_agent TEXT
location VARCHAR(100)
```

---

## 🆕 New Tables Quick Reference

### provider_documents
```sql
CREATE TABLE provider_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  document_type VARCHAR(50) NOT NULL,
  document_url VARCHAR(500) NOT NULL,
  document_number VARCHAR(100),
  issue_date DATE,
  expiry_date DATE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### provider_portfolio
```sql
CREATE TABLE provider_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  images JSONB NOT NULL,
  category_id UUID REFERENCES service_categories(id),
  completed_at DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### notification_preferences
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  channel VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  UNIQUE(user_id, channel, event_type)
);
```

### saved_payment_methods
```sql
CREATE TABLE saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  token VARCHAR(500) NOT NULL,
  last_four VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### pricing_plans
```sql
CREATE TABLE pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  billing_cycle VARCHAR(20) NOT NULL,
  features JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  status VARCHAR(20) DEFAULT 'active',
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

### provider_review_aggregates
```sql
CREATE TABLE provider_review_aggregates (
  provider_id UUID PRIMARY KEY REFERENCES providers(id),
  total_reviews INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  rating_1_count INTEGER DEFAULT 0,
  rating_2_count INTEGER DEFAULT 0,
  rating_3_count INTEGER DEFAULT 0,
  rating_4_count INTEGER DEFAULT 0,
  rating_5_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

---

## ⚡ Common Code Patterns

### Repository Pattern - Add New Field
```typescript
// Before
async create(email: string, password: string): Promise<User> {
  const query = `
    INSERT INTO users (email, password_hash)
    VALUES ($1, $2) RETURNING *
  `;
  const result = await this.pool.query(query, [email, password]);
  return result.rows[0];
}

// After
async create(email: string, password: string, timezone?: string, language?: string): Promise<User> {
  const query = `
    INSERT INTO users (email, password_hash, timezone, language)
    VALUES ($1, $2, $3, $4) RETURNING *
  `;
  const result = await this.pool.query(query, [
    email, 
    password, 
    timezone || 'UTC',
    language || 'en'
  ]);
  return result.rows[0];
}
```

### DTO Pattern - Add Validation
```typescript
import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';

export class UpdateDto {
  @IsOptional()
  @IsUrl()
  profile_picture_url?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(['en', 'es', 'fr'])
  language?: string;
}
```

### Frontend Pattern - Update Interface
```typescript
// Before
interface User {
  id: string;
  email: string;
  name?: string;
}

// After
interface User {
  id: string;
  email: string;
  name?: string;
  profile_picture_url?: string;  // NEW
  timezone: string;               // NEW
  language: string;               // NEW
  phone_verified: boolean;        // NEW
  last_login_at?: string;         // NEW
}
```

---

## 🔧 Common Commands

### Database
```bash
# Check schema
psql -U postgres -d marketplace -c "\d users"

# Test query
psql -U postgres -d marketplace -c "SELECT timezone, language FROM users LIMIT 5"

# Backup
pg_dump -U postgres -d marketplace > backup.sql
```

### Backend
```bash
# Build service
cd services/auth-service
pnpm build

# Run tests
pnpm test

# Start service
pnpm start:dev
```

### Frontend
```bash
# Install dependencies
cd frontend/nextjs-app
pnpm install

# Run dev server
pnpm dev

# Build production
pnpm build
```

---

## 🚨 Critical Reminders

1. **Always backup database** before migrations
2. **Test in staging first** before production
3. **Update DTOs** when adding entity fields
4. **Add validation** for all user inputs
5. **Update frontend interfaces** to match backend
6. **Write tests** for all new features
7. **Document API changes** in Swagger
8. **Monitor performance** after deployment
9. **PCI compliance** for payment methods (tokenize!)
10. **File upload security** - validate types, scan malware

---

## 📚 Full Guides

- **Master Roadmap**: [MASTER_IMPLEMENTATION_ROADMAP.md](./MASTER_IMPLEMENTATION_ROADMAP.md)
- **Phase 1 (Entities)**: [PHASE_1_IMPLEMENTATION_GUIDE.md](./PHASE_1_IMPLEMENTATION_GUIDE.md)
- **Phase 2 (DTOs)**: [PHASE_2_IMPLEMENTATION_GUIDE.md](./PHASE_2_IMPLEMENTATION_GUIDE.md)
- **Phase 3 (Repos)**: [PHASE_3_IMPLEMENTATION_GUIDE.md](./PHASE_3_IMPLEMENTATION_GUIDE.md)
- **Phase 4 (Tables)**: [PHASE_4_NEW_TABLES_GUIDE.md](./PHASE_4_NEW_TABLES_GUIDE.md)
- **Phase 5 (Frontend)**: [PHASE_5_FRONTEND_GUIDE.md](./PHASE_5_FRONTEND_GUIDE.md)
- **Phase 6 (Testing)**: [PHASE_6_TESTING_DEPLOYMENT.md](./PHASE_6_TESTING_DEPLOYMENT.md)
- **Gap Report**: [SCHEMA_IMPLEMENTATION_GAP_REPORT.md](./SCHEMA_IMPLEMENTATION_GAP_REPORT.md)

---

## ✅ Progress Tracking

```
Phase 1: Core Entities        [ ] 0/13 entities updated
Phase 2: DTOs & Validation    [ ] 0/26 DTOs updated
Phase 3: Repository Methods   [ ] 0/13 repos updated
Phase 4: New Tables           [ ] 0/7 tables implemented
Phase 5: Frontend Components  [ ] 0/50 components built
Phase 6: Testing & Deployment [ ] 0/6 sections complete
```

**Current Status**: Ready to begin Phase 1

---

**Good luck! Start with Phase 1 and update entities one by one. 🚀**
