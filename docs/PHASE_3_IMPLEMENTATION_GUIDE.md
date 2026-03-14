# Phase 3: Repository Methods Implementation Guide
**Estimated Time**: 10-12 hours  
**Priority**: 🟡 MEDIUM  
**Dependencies**: Phase 1 & 2 must be completed

---

## 📋 Overview

Update repository methods to handle new columns in SELECT, INSERT, UPDATE queries.

**Total Repositories to Update**: 13 files

---

## Task 3.1: Auth Service Repositories (2 hours)

### File: `services/auth-service/src/modules/auth/repositories/user.repository.ts`

### Method Updates Required:

#### 1. Update `findById` to include new fields

```typescript
async findById(userId: string): Promise<User | null> {
  const query = `
    SELECT 
      id, email, name, phone, password_hash, role, 
      email_verified, phone_verified, 
      profile_picture_url, timezone, language, last_login_at,
      status, created_at, updated_at, deleted_at
    FROM users
    WHERE id = $1 AND deleted_at IS NULL
  `;
  
  const result = await this.pool.query(query, [userId]);
  return result.rows[0] || null;
}
```

#### 2. Update `findByEmail` similarly

```typescript
async findByEmail(email: string): Promise<User | null> {
  const query = `
    SELECT 
      id, email, name, phone, password_hash, role, 
      email_verified, phone_verified,
      profile_picture_url, timezone, language, last_login_at,
      status, created_at, updated_at, deleted_at
    FROM users
    WHERE email = $1 AND deleted_at IS NULL
  `;
  
  const result = await this.pool.query(query, [email]);
  return result.rows[0] || null;
}
```

#### 3. Add new repository methods

```typescript
// Update last login timestamp
async updateLastLogin(userId: string): Promise<void> {
  const query = `
    UPDATE users 
    SET last_login_at = NOW()
    WHERE id = $1
  `;
  await this.pool.query(query, [userId]);
}

// Update profile picture
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

// Update timezone
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

// Update language
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

// Verify phone number
async verifyPhone(userId: string): Promise<User> {
  const query = `
    UPDATE users 
    SET phone_verified = true, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await this.pool.query(query, [userId]);
  return result.rows[0];
}

// Get users by language preference
async getUsersByLanguage(language: string, limit: number = 50): Promise<User[]> {
  const query = `
    SELECT 
      id, email, name, phone, role, email_verified, phone_verified,
      profile_picture_url, timezone, language, last_login_at,
      status, created_at
    FROM users
    WHERE language = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const result = await this.pool.query(query, [language, limit]);
  return result.rows;
}

// Get users by timezone
async getUsersByTimezone(timezone: string, limit: number = 50): Promise<User[]> {
  const query = `
    SELECT 
      id, email, name, phone, role, email_verified, phone_verified,
      profile_picture_url, timezone, language, last_login_at,
      status, created_at
    FROM users
    WHERE timezone = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const result = await this.pool.query(query, [timezone, limit]);
  return result.rows;
}

// Get inactive users (haven't logged in for X days)
async getInactiveUsers(days: number = 30, limit: number = 100): Promise<User[]> {
  const query = `
    SELECT 
      id, email, name, phone, role, email_verified,
      profile_picture_url, timezone, language, last_login_at,
      status, created_at
    FROM users
    WHERE last_login_at < NOW() - INTERVAL '${days} days'
      AND deleted_at IS NULL
    ORDER BY last_login_at ASC
    LIMIT $1
  `;
  const result = await this.pool.query(query, [limit]);
  return result.rows;
}
```

#### 4. Update session repository

**File**: `services/auth-service/src/modules/auth/repositories/session.repository.ts`

```typescript
async createSession(
  userId: string,
  refreshToken: string,
  expiresAt: Date,
  userAgent?: string,
  ipAddress?: string,
  deviceType?: string,    // ✅ NEW
  location?: string       // ✅ NEW
): Promise<Session> {
  const query = `
    INSERT INTO sessions (
      user_id, refresh_token, expires_at, 
      user_agent, ip_address, device_type, location
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    userId,
    refreshToken,
    expiresAt,
    userAgent,
    ipAddress,
    deviceType,    // ✅ NEW
    location       // ✅ NEW
  ];

  const result = await this.pool.query(query, values);
  return result.rows[0];
}

// Get sessions by device type
async getSessionsByDeviceType(
  userId: string, 
  deviceType: string
): Promise<Session[]> {
  const query = `
    SELECT * FROM sessions
    WHERE user_id = $1 
      AND device_type = $2
      AND expires_at > NOW()
    ORDER BY created_at DESC
  `;
  const result = await this.pool.query(query, [userId, deviceType]);
  return result.rows;
}

// Get sessions by location
async getSessionsByLocation(
  userId: string, 
  location: string
): Promise<Session[]> {
  const query = `
    SELECT * FROM sessions
    WHERE user_id = $1 
      AND location = $2
      AND expires_at > NOW()
    ORDER BY created_at DESC
  `;
  const result = await this.pool.query(query, [userId, location]);
  return result.rows;
}
```

#### 5. Update login attempts repository

**File**: `services/auth-service/src/modules/auth/repositories/login-attempt.repository.ts`

```typescript
async recordAttempt(
  email: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string,    // ✅ NEW
  location?: string      // ✅ NEW
): Promise<void> {
  const query = `
    INSERT INTO login_attempts (
      email, success, ip_address, user_agent, location, attempted_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
  `;

  await this.pool.query(query, [email, success, ipAddress, userAgent, location]);
}

// Get failed attempts by location
async getFailedAttemptsByLocation(
  location: string, 
  minutes: number = 15
): Promise<number> {
  const query = `
    SELECT COUNT(*) 
    FROM login_attempts
    WHERE location = $1
      AND success = false
      AND attempted_at > NOW() - INTERVAL '${minutes} minutes'
  `;
  const result = await this.pool.query(query, [location]);
  return parseInt(result.rows[0].count);
}

// Get attempts by user agent (detect bot patterns)
async getAttemptsByUserAgent(
  userAgent: string, 
  minutes: number = 60
): Promise<number> {
  const query = `
    SELECT COUNT(*) 
    FROM login_attempts
    WHERE user_agent = $1
      AND attempted_at > NOW() - INTERVAL '${minutes} minutes'
  `;
  const result = await this.pool.query(query, [userAgent]);
  return parseInt(result.rows[0].count);
}
```

---

## Task 3.2: User Service Repositories (2 hours)

### File: `services/user-service/src/modules/user/repositories/provider.repository.ts`

```typescript
async findById(providerId: string): Promise<Provider | null> {
  const query = `
    SELECT 
      id, user_id, business_name, description, 
      profile_picture_url, rating, total_jobs_completed,
      years_of_experience, service_area_radius, response_time_avg,
      verification_status, certifications,
      created_at, deleted_at
    FROM providers
    WHERE id = $1 AND deleted_at IS NULL
  `;
  
  const result = await this.pool.query(query, [providerId]);
  return result.rows[0] || null;
}

async updateProvider(providerId: string, data: UpdateProviderDto): Promise<Provider> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.business_name) {
    updates.push(`business_name = $${paramIndex++}`);
    values.push(data.business_name);
  }

  if (data.description) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }

  if (data.profile_picture_url) {  // ✅ NEW
    updates.push(`profile_picture_url = $${paramIndex++}`);
    values.push(data.profile_picture_url);
  }

  if (data.years_of_experience !== undefined) {  // ✅ NEW
    updates.push(`years_of_experience = $${paramIndex++}`);
    values.push(data.years_of_experience);
  }

  if (data.service_area_radius !== undefined) {  // ✅ NEW
    updates.push(`service_area_radius = $${paramIndex++}`);
    values.push(data.service_area_radius);
  }

  if (data.certifications) {  // ✅ NEW
    updates.push(`certifications = $${paramIndex++}`);
    values.push(JSON.stringify(data.certifications));
  }

  if (updates.length === 0) {
    throw new BadRequestException('No fields to update');
  }

  updates.push('updated_at = NOW()');
  values.push(providerId);

  const query = `
    UPDATE providers 
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await this.pool.query(query, values);
  return result.rows[0];
}

// ✅ NEW: Get verified providers with filters
async getVerifiedProviders(filters: {
  minRating?: number;
  minExperience?: number;
  serviceAreaRadius?: number;
  limit?: number;
}): Promise<Provider[]> {
  const conditions: string[] = ['verification_status = \'verified\'', 'deleted_at IS NULL'];
  const values: any[] = [];
  let paramIndex = 1;

  if (filters.minRating) {
    conditions.push(`rating >= $${paramIndex++}`);
    values.push(filters.minRating);
  }

  if (filters.minExperience) {
    conditions.push(`years_of_experience >= $${paramIndex++}`);
    values.push(filters.minExperience);
  }

  if (filters.serviceAreaRadius) {
    conditions.push(`service_area_radius >= $${paramIndex++}`);
    values.push(filters.serviceAreaRadius);
  }

  const limit = filters.limit || 20;
  values.push(limit);

  const query = `
    SELECT * FROM providers
    WHERE ${conditions.join(' AND ')}
    ORDER BY total_jobs_completed DESC, rating DESC
    LIMIT $${paramIndex}
  `;

  const result = await this.pool.query(query, values);
  return result.rows;
}

// ✅ NEW: Update verification status
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

// ✅ NEW: Get providers by response time
async getProvidersByResponseTime(
  maxResponseTime: number,
  limit: number = 20
): Promise<Provider[]> {
  const query = `
    SELECT * FROM providers
    WHERE response_time_avg <= $1
      AND verification_status = 'verified'
      AND deleted_at IS NULL
    ORDER BY response_time_avg ASC
    LIMIT $2
  `;
  const result = await this.pool.query(query, [maxResponseTime, limit]);
  return result.rows;
}
```

---

## Task 3.3: Request Service Repository (2 hours)

### File: `services/request-service/src/modules/request/repositories/request.repository.ts`

```typescript
async createRequest(data: CreateRequestDto): Promise<ServiceRequest> {
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

// ✅ NEW: Increment view count
async incrementViewCount(requestId: string): Promise<void> {
  const query = `
    UPDATE service_requests 
    SET view_count = view_count + 1
    WHERE id = $1
  `;
  await this.pool.query(query, [requestId]);
}

// ✅ NEW: Get urgent requests
async getUrgentRequests(limit: number = 20): Promise<ServiceRequest[]> {
  const query = `
    SELECT * FROM service_requests
    WHERE urgency IN ('high', 'urgent')
      AND status = 'open'
      AND deleted_at IS NULL
      AND (expiry_date IS NULL OR expiry_date > NOW())
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

// ✅ NEW: Get requests by urgency
async getRequestsByUrgency(
  urgency: 'low' | 'medium' | 'high' | 'urgent',
  limit: number = 20
): Promise<ServiceRequest[]> {
  const query = `
    SELECT * FROM service_requests
    WHERE urgency = $1
      AND status = 'open'
      AND deleted_at IS NULL
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const result = await this.pool.query(query, [urgency, limit]);
  return result.rows;
}

// ✅ NEW: Get requests with images
async getRequestsWithImages(limit: number = 20): Promise<ServiceRequest[]> {
  const query = `
    SELECT * FROM service_requests
    WHERE images IS NOT NULL
      AND jsonb_array_length(images) > 0
      AND status = 'open'
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $1
  `;
  const result = await this.pool.query(query, [limit]);
  return result.rows;
}

// ✅ NEW: Get expiring requests (expiring soon)
async getExpiringRequests(hours: number = 24): Promise<ServiceRequest[]> {
  const query = `
    SELECT * FROM service_requests
    WHERE expiry_date IS NOT NULL
      AND expiry_date > NOW()
      AND expiry_date <= NOW() + INTERVAL '${hours} hours'
      AND status = 'open'
      AND deleted_at IS NULL
    ORDER BY expiry_date ASC
  `;
  const result = await this.pool.query(query);
  return result.rows;
}

// ✅ NEW: Get most viewed requests
async getMostViewedRequests(limit: number = 10): Promise<ServiceRequest[]> {
  const query = `
    SELECT * FROM service_requests
    WHERE status = 'open'
      AND deleted_at IS NULL
    ORDER BY view_count DESC, created_at DESC
    LIMIT $1
  `;
  const result = await this.pool.query(query, [limit]);
  return result.rows;
}
```

---

## Task 3.4: Proposal, Job, Payment Repositories (4 hours)

Follow similar pattern for:

1. **Proposal Repository**: Add rejection reason handling, date range queries
2. **Job Repository**: Add cancellation tracking, actual amount handling
3. **Payment Repository**: Add fee calculations, payment method tracking

### Example: Job Repository

```typescript
// services/job-service/src/modules/job/repositories/job.repository.ts

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

// Get cancellation analytics
async getCancellationStats(
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  const query = `
    SELECT 
      cancelled_by,
      COUNT(*) as count,
      ARRAY_AGG(DISTINCT cancellation_reason) as reasons
    FROM jobs
    WHERE status = 'cancelled'
      AND created_at BETWEEN COALESCE($1, '2020-01-01') AND COALESCE($2, NOW())
    GROUP BY cancelled_by
  `;
  const result = await this.pool.query(query, [startDate, endDate]);
  return result.rows;
}
```

---

## Task 3.5: Review, Message, Coupon Repositories (2 hours)

Similar updates for remaining repositories.

---

## ✅ Phase 3 Completion Checklist

- [ ] User repository fully updated (8 new methods)
- [ ] Session repository updated (2 new methods)
- [ ] Login attempts repository updated (2 new methods)
- [ ] Provider repository fully updated (5 new methods)
- [ ] Request repository fully updated (6 new methods)
- [ ] Proposal repository updated (2 new methods)
- [ ] Job repository updated (3 new methods)
- [ ] Payment repository updated (3 new methods)
- [ ] Review repository updated (3 new methods)
- [ ] Message repository updated (3 new methods)
- [ ] Coupon repository updated (2 new methods)
- [ ] All SELECT queries include new columns
- [ ] All INSERT queries handle new columns
- [ ] All UPDATE queries support new fields
- [ ] Proper NULL handling
- [ ] Performance optimized (indexed columns used in WHERE)

**Testing**:
```typescript
// Test timezone query
const users = await userRepo.getUsersByTimezone('UTC', 10);
console.log(users);

// Test urgent requests
const urgentRequests = await requestRepo.getUrgentRequests(20);
console.log(urgentRequests);

// Test verified providers
const providers = await providerRepo.getVerifiedProviders({
  minRating: 4.5,
  minExperience: 2,
  limit: 10
});
console.log(providers);
```

**Deliverable**: All repositories support new columns with optimized queries

---

**Next**: See PHASE_4_NEW_TABLES_GUIDE.md for implementing 7 new tables
