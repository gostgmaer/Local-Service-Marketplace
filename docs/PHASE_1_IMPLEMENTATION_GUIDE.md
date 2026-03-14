# Phase-Wise Implementation Guide
## Database Schema Updates Implementation

**Total Estimated Time**: 128-163 hours (3-4 weeks)  
**Last Updated**: March 14, 2026

---

## 📋 Overview

This guide provides step-by-step instructions to implement all 67 new columns and 7 new tables added to the database schema.

**Current Status**: Database ✅ | Backend ❌ | Frontend ❌

---

# PHASE 1: Core Entity Updates (Week 1)
**Estimated Time**: 16-20 hours  
**Priority**: 🔴 CRITICAL  
**Focus**: Update existing entities with new columns

---

## Task 1.1: Update User Entity (2 hours)

### Files to Modify:
1. `services/auth-service/src/modules/auth/entities/user.entity.ts`
2. `services/auth-service/src/modules/auth/dto/signup.dto.ts`
3. `services/auth-service/src/modules/auth/dto/auth-response.dto.ts`
4. `services/auth-service/src/modules/auth/repositories/user.repository.ts`

### Step 1: Update User Entity

**File**: `services/auth-service/src/modules/auth/entities/user.entity.ts`

```typescript
export class User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  password_hash?: string;
  role: string;
  email_verified: boolean;
  phone_verified: boolean;              // ✅ NEW
  profile_picture_url?: string;         // ✅ NEW
  timezone: string;                      // ✅ NEW (default: 'UTC')
  language: string;                      // ✅ NEW (default: 'en')
  last_login_at?: Date;                  // ✅ NEW
  status: string;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}
```

### Step 2: Update Signup DTO

**File**: `services/auth-service/src/modules/auth/dto/signup.dto.ts`

```typescript
import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(['customer', 'provider', 'admin'])
  role: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()  // ✅ NEW
  @IsString()
  timezone?: string;

  @IsOptional()  // ✅ NEW
  @IsString()
  language?: string;
}
```

### Step 3: Update Auth Response DTO

**File**: `services/auth-service/src/modules/auth/dto/auth-response.dto.ts`

```typescript
export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
    email_verified: boolean;
    phone_verified: boolean;           // ✅ NEW
    profile_picture_url?: string;      // ✅ NEW
    timezone: string;                   // ✅ NEW
    language: string;                   // ✅ NEW
    last_login_at?: Date;               // ✅ NEW
  };
}
```

### Step 4: Update User Repository

**File**: `services/auth-service/src/modules/auth/repositories/user.repository.ts`

```typescript
async create(
  email: string, 
  passwordHash: string, 
  role: string, 
  phone?: string, 
  name?: string,
  timezone?: string,    // ✅ NEW
  language?: string     // ✅ NEW
): Promise<User> {
  const query = `
    INSERT INTO users (
      email, password_hash, role, phone, name, 
      timezone, language, phone_verified, email_verified
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, false, false)
    RETURNING *
  `;
  
  const values = [
    email, 
    passwordHash, 
    role, 
    phone, 
    name,
    timezone || 'UTC',    // ✅ NEW
    language || 'en'      // ✅ NEW
  ];
  
  const result = await this.pool.query(query, values);
  return result.rows[0];
}

// ✅ NEW METHOD: Update profile picture
async updateProfilePicture(userId: string, url: string): Promise<User> {
  const query = `
    UPDATE users 
    SET profile_picture_url = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  const result = await this.pool.query(query, [url, userId]);
  return result.rows[0];
}

// ✅ NEW METHOD: Update timezone
async updateTimezone(userId: string, timezone: string): Promise<User> {
  const query = `
    UPDATE users 
    SET timezone = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  const result = await this.pool.query(query, [timezone, userId]);
  return result.rows[0];
}

// ✅ NEW METHOD: Update language
async updateLanguage(userId: string, language: string): Promise<User> {
  const query = `
    UPDATE users 
    SET language = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  const result = await this.pool.query(query, [language, userId]);
  return result.rows[0];
}

// ✅ NEW METHOD: Mark phone as verified
async verifyPhone(userId: string): Promise<User> {
  const query = `
    UPDATE users 
    SET phone_verified = true, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  const result = await this.pool.query(query, [userId]);
  return result.rows[0];
}
```

### Step 5: Update Auth Service

**File**: `services/auth-service/src/modules/auth/services/auth.service.ts`

Update the `signup` method:

```typescript
async signup(signupDto: SignupDto, ipAddress?: string): Promise<AuthResponseDto> {
  const { email, password, role, phone, name, timezone, language } = signupDto;

  this.logger.info('Signup attempt', { context: 'AuthService', email, role, name });

  // Check if user already exists
  const existingUser = await this.userRepo.findByEmail(email);
  if (existingUser) {
    throw new ConflictException('User with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, this.saltRounds);

  // Create user with new fields
  const user = await this.userRepo.create(
    email, 
    passwordHash, 
    role, 
    phone, 
    name,
    timezone,    // ✅ NEW
    language     // ✅ NEW
  );

  // ... rest of the method
}
```

---

## Task 1.2: Update Provider Entity (2 hours)

### Files to Modify:
1. `services/user-service/src/modules/user/entities/provider.entity.ts`
2. `services/user-service/src/modules/user/dto/create-provider.dto.ts`
3. `services/user-service/src/modules/user/dto/update-provider.dto.ts`
4. `services/user-service/src/modules/user/repositories/provider.repository.ts`

### Step 1: Update Provider Entity

**File**: `services/user-service/src/modules/user/entities/provider.entity.ts`

```typescript
export class Provider {
  id: string;
  user_id: string;
  business_name: string;
  description?: string;
  profile_picture_url?: string;              // ✅ NEW
  rating?: number;
  total_jobs_completed: number;              // ✅ NEW
  years_of_experience?: number;              // ✅ NEW
  service_area_radius?: number;              // ✅ NEW
  response_time_avg?: number;                // ✅ NEW
  verification_status: string;               // ✅ NEW ('pending', 'verified', 'rejected')
  certifications?: any;                      // ✅ NEW (JSONB)
  created_at: Date;
  deleted_at?: Date;
}
```

### Step 2: Update Create Provider DTO

**File**: `services/user-service/src/modules/user/dto/create-provider.dto.ts`

```typescript
import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  business_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()  // ✅ NEW
  @IsString()
  profile_picture_url?: string;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(0)
  years_of_experience?: number;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(1)
  @Max(500)
  service_area_radius?: number;

  @IsOptional()  // ✅ NEW
  certifications?: {
    name: string;
    issuer: string;
    issue_date: string;
    expiry_date?: string;
    certificate_url?: string;
  }[];
}
```

### Step 3: Update Provider Repository

**File**: `services/user-service/src/modules/user/repositories/provider.repository.ts`

```typescript
async createProvider(userId: string, data: CreateProviderDto): Promise<Provider> {
  const query = `
    INSERT INTO providers (
      user_id, business_name, description, profile_picture_url,
      years_of_experience, service_area_radius, certifications,
      verification_status, total_jobs_completed
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0)
    RETURNING *
  `;

  const values = [
    userId,
    data.business_name,
    data.description,
    data.profile_picture_url,
    data.years_of_experience,
    data.service_area_radius,
    data.certifications ? JSON.stringify(data.certifications) : null
  ];

  const result = await this.pool.query(query, values);
  return result.rows[0];
}

// ✅ NEW METHOD: Update verification status
async updateVerificationStatus(
  providerId: string, 
  status: 'pending' | 'verified' | 'rejected'
): Promise<Provider> {
  const query = `
    UPDATE providers 
    SET verification_status = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await this.pool.query(query, [status, providerId]);
  return result.rows[0];
}

// ✅ NEW METHOD: Get verified providers only
async getVerifiedProviders(limit: number = 20): Promise<Provider[]> {
  const query = `
    SELECT * FROM providers
    WHERE verification_status = 'verified' 
      AND deleted_at IS NULL
    ORDER BY total_jobs_completed DESC, rating DESC
    LIMIT $1
  `;
  const result = await this.pool.query(query, [limit]);
  return result.rows;
}
```

---

## Task 1.3: Update Service Request Entity (2 hours)

### Files to Modify:
1. `services/request-service/src/modules/request/entities/service-request.entity.ts`
2. `services/request-service/src/modules/request/dto/create-request.dto.ts`
3. `services/request-service/src/modules/request/repositories/request.repository.ts`

### Step 1: Update ServiceRequest Entity

**File**: `services/request-service/src/modules/request/entities/service-request.entity.ts`

```typescript
export class ServiceRequest {
  id: string;
  user_id: string;
  category_id: string;
  location_id?: string;
  location?: Location;
  description: string;
  budget: number;
  images?: string[];                    // ✅ NEW (JSONB)
  preferred_date?: Date;                // ✅ NEW
  urgency: string;                      // ✅ NEW ('low', 'medium', 'high', 'urgent')
  expiry_date?: Date;                   // ✅ NEW
  view_count: number;                   // ✅ NEW
  status: string;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}
```

### Step 2: Update Create Request DTO

**File**: `services/request-service/src/modules/request/dto/create-request.dto.ts`

```typescript
import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsDateString, Min } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  user_id: string;

  @IsString()
  category_id: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  budget: number;

  @IsOptional()  // ✅ NEW
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()  // ✅ NEW
  @IsDateString()
  preferred_date?: string;

  @IsOptional()  // ✅ NEW
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  urgency?: string;

  @IsOptional()  // ✅ NEW
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  location?: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}
```

### Step 3: Update Request Repository

**File**: `services/request-service/src/modules/request/repositories/request.repository.ts`

```typescript
async createRequest(data: any): Promise<ServiceRequest> {
  const query = `
    INSERT INTO service_requests (
      user_id, category_id, location_id, description, budget,
      images, preferred_date, urgency, expiry_date, status, view_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', 0)
    RETURNING *
  `;

  const values = [
    data.user_id,
    data.category_id,
    data.location_id,
    data.description,
    data.budget,
    data.images ? JSON.stringify(data.images) : null,  // ✅ NEW
    data.preferred_date,                                // ✅ NEW
    data.urgency || 'medium',                           // ✅ NEW
    data.expiry_date                                    // ✅ NEW
  ];

  const result = await this.pool.query(query, values);
  return result.rows[0];
}

// ✅ NEW METHOD: Increment view count
async incrementViewCount(requestId: string): Promise<void> {
  const query = `
    UPDATE service_requests 
    SET view_count = view_count + 1
    WHERE id = $1
  `;
  await this.pool.query(query, [requestId]);
}

// ✅ NEW METHOD: Get urgent requests
async getUrgentRequests(limit: number = 20): Promise<ServiceRequest[]> {
  const query = `
    SELECT * FROM service_requests
    WHERE urgency IN ('high', 'urgent')
      AND status = 'open'
      AND deleted_at IS NULL
    ORDER BY 
      CASE urgency 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
      END,
      created_at DESC
    LIMIT $1
  `;
  const result = await this.pool.query(query, [limit]);
  return result.rows;
}
```

---

## Task 1.4: Update Proposal Entity (1.5 hours)

### Files to Modify:
1. `services/proposal-service/src/modules/proposal/entities/proposal.entity.ts`
2. `services/proposal-service/src/modules/proposal/dto/create-proposal.dto.ts`
3. `services/proposal-service/src/modules/proposal/repositories/proposal.repository.ts`

### Implementation:

**File**: `services/proposal-service/src/modules/proposal/entities/proposal.entity.ts`

```typescript
export class Proposal {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  message: string;
  estimated_hours?: number;              // ✅ NEW
  start_date?: Date;                     // ✅ NEW
  completion_date?: Date;                // ✅ NEW
  rejected_reason?: string;              // ✅ NEW
  status: string;
  created_at: Date;
  updated_at?: Date;
}
```

**Update Repository**:

```typescript
async createProposal(data: CreateProposalDto): Promise<Proposal> {
  const query = `
    INSERT INTO proposals (
      request_id, provider_id, price, message,
      estimated_hours, start_date, completion_date, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
    RETURNING *
  `;

  const values = [
    data.request_id,
    data.provider_id,
    data.price,
    data.message,
    data.estimated_hours,      // ✅ NEW
    data.start_date,           // ✅ NEW
    data.completion_date       // ✅ NEW
  ];

  const result = await this.pool.query(query, values);
  return result.rows[0];
}

// ✅ NEW METHOD: Reject with reason
async rejectProposal(proposalId: string, reason: string): Promise<Proposal> {
  const query = `
    UPDATE proposals 
    SET status = 'rejected', rejected_reason = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  const result = await this.pool.query(query, [reason, proposalId]);
  return result.rows[0];
}
```

---

## Task 1.5: Update Job Entity (1.5 hours)

**File**: `services/job-service/src/modules/job/entities/job.entity.ts`

```typescript
export class Job {
  id: string;
  request_id: string;
  provider_id: string;
  customer_id: string;                   // ✅ NEW
  proposal_id?: string;
  actual_amount?: number;                // ✅ NEW
  cancelled_by?: string;                 // ✅ NEW
  cancellation_reason?: string;          // ✅ NEW
  status: string;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at?: Date;
}
```

**Update Repository**:

```typescript
async createJob(data: CreateJobDto): Promise<Job> {
  const query = `
    INSERT INTO jobs (
      request_id, provider_id, customer_id, proposal_id, status
    )
    VALUES ($1, $2, $3, $4, 'scheduled')
    RETURNING *
  `;

  const values = [
    data.request_id,
    data.provider_id,
    data.customer_id,      // ✅ NEW
    data.proposal_id
  ];

  const result = await this.pool.query(query, values);
  return result.rows[0];
}

// ✅ NEW METHOD: Cancel job with reason
async cancelJob(
  jobId: string, 
  cancelledBy: string, 
  reason: string
): Promise<Job> {
  const query = `
    UPDATE jobs 
    SET status = 'cancelled', 
        cancelled_by = $1, 
        cancellation_reason = $2,
        updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `;
  const result = await this.pool.query(query, [cancelledBy, reason, jobId]);
  return result.rows[0];
}
```

---

## Task 1.6: Update Payment Entity (2 hours)

**File**: `services/payment-service/src/payment/entities/payment.entity.ts`

```typescript
export class Payment {
  id: string;
  job_id: string;
  user_id: string;                       // ✅ REQUIRED (was optional)
  provider_id: string;                   // ✅ NEW
  amount: number;
  platform_fee: number;                  // ✅ NEW
  provider_amount: number;               // ✅ NEW
  currency: string;
  payment_method?: string;               // ✅ NEW
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id?: string;
  failed_reason?: string;                // ✅ NEW
  created_at: Date;
}
```

**Update Repository**:

```typescript
async createPayment(data: CreatePaymentDto): Promise<Payment> {
  // Calculate platform fee (e.g., 10%)
  const platformFee = Math.floor(data.amount * 0.10);
  const providerAmount = data.amount - platformFee;

  const query = `
    INSERT INTO payments (
      job_id, user_id, provider_id, amount, platform_fee, 
      provider_amount, currency, payment_method, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING *
  `;

  const values = [
    data.job_id,
    data.user_id,
    data.provider_id,     // ✅ NEW
    data.amount,
    platformFee,          // ✅ NEW
    providerAmount,       // ✅ NEW
    data.currency,
    data.payment_method   // ✅ NEW
  ];

  const result = await this.pool.query(query, values);
  return result.rows[0];
}
```

---

## Task 1.7: Update Review, Message, Coupon Entities (2 hours)

Quick updates for remaining entities following the same pattern.

---

## Task 1.8: Update Frontend Interfaces (4 hours)

Update all frontend service interfaces to match backend entities.

**File**: `frontend/nextjs-app/services/auth-service.ts`

```typescript
export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: string;
  email_verified: boolean;
  phone_verified: boolean;           // ✅ NEW
  profile_picture_url?: string;      // ✅ NEW
  timezone: string;                   // ✅ NEW
  language: string;                   // ✅ NEW
  last_login_at?: string;             // ✅ NEW
  status: string;
  created_at: string;
  updated_at?: string;
}
```

Repeat for all service interfaces.

---

## ✅ Phase 1 Completion Checklist

- [ ] User entity updated (6 new fields)
- [ ] Provider entity updated (8 new fields)
- [ ] ServiceRequest entity updated (5 new fields)
- [ ] Proposal entity updated (4 new fields)
- [ ] Job entity updated (4 new fields)
- [ ] Payment entity updated (6 new fields)
- [ ] Review entity updated (4 new fields)
- [ ] Message entity updated (4 new fields)
- [ ] Coupon entity updated (5 new fields)
- [ ] Session entity updated (2 new fields)
- [ ] LoginAttempt entity updated (2 new fields)
- [ ] Token entities updated (1 field each)
- [ ] All frontend interfaces updated
- [ ] All DTOs updated with validation
- [ ] All repositories updated
- [ ] Basic endpoints tested

**Deliverable**: All existing entities support new columns

---

# PHASE 2: DTOs & Validation (Week 1-2)
**Estimated Time**: 12-16 hours  
**Priority**: 🟡 MEDIUM

... (Continue with remaining phases)

---

**Next**: See PHASE_2_IMPLEMENTATION_GUIDE.md for DTOs & Validation
