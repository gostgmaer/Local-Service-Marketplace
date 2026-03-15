# ⚡ PRODUCTION QUICK FIX GUIDE

**Last Updated:** March 15, 2026  
**Status:** NOT PRODUCTION READY ❌  
**Priority:** Fix P0 items IMMEDIATELY

---

## 🚨 P0 CRITICAL BLOCKERS (Fix Today/Tomorrow)

### 1. ADD AUTHENTICATION TO ALL CONTROLLERS (2-3 days)

**Problem:** Anyone can access admin/payment/job endpoints without login

**Quick Fix:**
```typescript
// Add to EVERY controller in these services:
// - request-service
// - proposal-service  
// - payment-service
// - admin-service
// - review-service
// - job-service

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@nestjs/passport';

@UseGuards(JwtAuthGuard)  // ← ADD THIS
@Controller('requests')
export class RequestController { ... }
```

**Files to Edit:**
- `services/request-service/src/controllers/request.controller.ts`
- `services/proposal-service/src/controllers/proposal.controller.ts`
- `services/payment-service/src/controllers/payment.controller.ts`
- `services/admin-service/src/controllers/*.controller.ts` (all)
- `services/review-service/src/controllers/review.controller.ts`
- `services/job-service/src/controllers/job.controller.ts`

---

### 2. GENERATE PRODUCTION SECRETS (1 hour)

**Problem:** Hardcoded "your-secret-key-change-in-production"

**Quick Fix:**
```bash
# Generate strong secrets
openssl rand -base64 32 > jwt_secret.txt
openssl rand -base64 32 > gateway_secret.txt
openssl rand -base64 32 > stripe_webhook_secret.txt

# Update docker-compose.yml
JWT_SECRET=$(cat jwt_secret.txt)
GATEWAY_SECRET=$(cat gateway_secret.txt)

# Store in AWS Secrets Manager or similar
```

**Files to Edit:**
- `docker-compose.yml` - Remove defaults
- `.env.production` - Add real secrets (DON'T commit)
- `.gitignore` - Add `.env.production`

---

### 3. FIX API ROUTE MISMATCHES (1 day)

**Problem:** Frontend calling wrong routes, features broken

**Quick Fix - Option A (Backend):**
```typescript
// payment-service/src/controllers/payment.controller.ts
// ADD this endpoint:
@Get('/jobs/:jobId/payments')
async getJobPayments(@Param('jobId') jobId: string) {
  return this.paymentService.findByJobId(jobId);
}

// messaging-service/src/controllers/message.controller.ts  
// ADD this endpoint:
@Get('/jobs/:jobId/messages')
async getJobMessages(@Param('jobId') jobId: string) {
  return this.messageService.findByJobId(jobId);
}
```

**Quick Fix - Option B (Frontend - Faster):**
```typescript
// frontend/lib/services/payment-service.ts
// CHANGE:
getJobPayments(jobId) {
  return axios.get(`/payments/job/${jobId}`); // ← Fixed route
}

// frontend/lib/services/messaging-service.ts
// CHANGE:
getJobMessages(jobId) {
  return axios.get(`/messages/jobs/${jobId}/messages`); // ← Fixed route
}
```

**Recommendation:** Do Option B (frontend fix) - faster!

---

### 4. REMOVE CROSS-SERVICE DATABASE JOINS (3 days)

**Problem:** Services joining other services' tables directly

**Quick Fix Pattern:**
```typescript
// ❌ WRONG - payment-service querying users table
const payment = await this.paymentRepo.query(`
  SELECT p.*, u.email, u.name
  FROM payments p
  JOIN users u ON p.user_id = u.id
`);

// ✅ CORRECT - Call user-service API
const payment = await this.paymentRepo.findOne(id);
const user = await this.httpService.get(
  `http://user-service:3002/users/${payment.user_id}`
);
return { ...payment, user };
```

**Critical Files:**
- `services/payment-service/src/repositories/payment.repository.ts`
- `services/job-service/src/repositories/job.repository.ts`
- `services/proposal-service/src/repositories/proposal.repository.ts`
- `services/review-service/src/repositories/review.repository.ts`

**Search for:** `JOIN users`, `JOIN service_requests`, `JOIN jobs`, `JOIN proposals`

---

## 🔧 P1 HIGH PRIORITY (Fix This Week)

### 5. ADD ROLE-BASED ACCESS CONTROL (2 days)

**Quick Fix:**
```typescript
// Create: common/decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Create: common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    const request = context.switchToHttp().getRequest();
    return roles.includes(request.user.role);
  }
}

// Use on admin endpoints:
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('admin/users')
getUsers() { ... }
```

---

### 6. FIX DATABASE SCHEMA MISMATCHES (1 day)

**Quick Fixes:**

**Fix #1: favorites.created_at**
```sql
-- Run this migration:
ALTER TABLE favorites 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

**Fix #2: nullable fields**
```typescript
// services/user-service/src/entities/location.entity.ts
// CHANGE:
@Column({ nullable: false })  // ❌
user_id: string;

// TO:
@Column({ nullable: true })  // ✅ Matches database
user_id?: string;
```

**Fix #3: Remove duplicate Location entity**
```bash
# Delete this file:
rm services/user-service/src/entities/location.entity.ts
# Keep only: services/request-service/src/entities/location.entity.ts
```

---

### 7. ADD MISSING BACKEND ENDPOINTS (2 days)

**Quick implementations:**

```typescript
// auth-service: GET /auth/profile
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) {
  return this.authService.getProfile(req.user.id);
}

// user-service: GET /providers/:id/services
@Get('providers/:id/services')
getProviderServices(@Param('id') id: string) {
  return this.providerService.getServices(id);
}

// proposal-service: PATCH /proposals/:id
@UseGuards(JwtAuthGuard)
@Patch(':id')
updateProposal(@Param('id') id: string, @Body() dto: UpdateProposalDto) {
  return this.proposalService.update(id, dto);
}

// review-service: GET /jobs/:jobId/review
@Get('jobs/:jobId/review')
getJobReview(@Param('jobId') jobId: string) {
  return this.reviewService.findByJobId(jobId);
}

// messaging-service: PATCH /messages/:id/read
@UseGuards(JwtAuthGuard)
@Patch(':id/read')
markAsRead(@Param('id') id: string) {
  return this.messageService.markAsRead(id);
}
```

---

### 8. FILE UPLOAD VALIDATION (4 hours)

**Quick Fix:**
```typescript
// common/interceptors/file-validation.interceptor.ts
export const imageUploadOptions: MulterOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF allowed'), false);
    }
  },
};

// Use in controllers:
@Post('upload')
@UseInterceptors(FileInterceptor('file', imageUploadOptions))
uploadFile(@UploadedFile() file: Express.Multer.File) { ... }
```

---

## ⚡ FASTEST PATH TO DEPLOYMENT (4 days)

### Day 1 (Critical Security):
- [ ] Add `@UseGuards(JwtAuthGuard)` to 6 services (3 hours)
- [ ] Generate production secrets (1 hour)
- [ ] Update docker-compose.yml with secrets (1 hour)
- [ ] Fix 3 frontend API routes (2 hours)

### Day 2 (Architecture):
- [ ] Remove 5 worst cross-service joins (4 hours)
- [ ] Add RBAC guards to admin endpoints (3 hours)

### Day 3 (Database):
- [ ] Run 3 database migrations (2 hours)
- [ ] Remove duplicate Location entity (1 hour)
- [ ] Add 3 critical missing endpoints (4 hours)

### Day 4 (Polish):
- [ ] Add file upload validation (2 hours)
- [ ] Remove console.log statements (2 hours)
- [ ] Test all critical paths (3 hours)

**After 4 days: 85% production ready ✅**

---

## 🧪 QUICK VALIDATION COMMANDS

```bash
# Check for missing auth guards
grep -r "@Controller" services/ | grep -v "@UseGuards"

# Check for hardcoded secrets
grep -r "your-secret-key" .
grep -r "sk_test_" .

# Check for cross-service joins
grep -r "JOIN users" services/*/src/repositories/
grep -r "JOIN jobs" services/*/src/repositories/

# Check for console.log
grep -r "console.log" services/*/src/

# Run TypeScript checks
cd frontend && npx tsc --noEmit
```

---

## 📊 PROGRESS TRACKER

**Use this checklist:**

### P0 Critical (Must Do):
- [ ] Auth guards on all controllers
- [ ] Production secrets generated
- [ ] API route mismatches fixed
- [ ] Cross-service joins removed

### P1 High (Should Do):
- [ ] RBAC implemented
- [ ] Database mismatches fixed
- [ ] Missing endpoints added
- [ ] File upload validation

### P2 Medium (Nice to Have):
- [ ] Console.log removed
- [ ] Frontend theme fixes
- [ ] Unit tests added
- [ ] API documentation

**When all P0 + P1 done → READY FOR PRODUCTION ✅**

---

## 🆘 EMERGENCY CONTACTS

If blocked on security issues, refer to:
- [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)
- [DATABASE_BACKEND_ALIGNMENT_REPORT.md](DATABASE_BACKEND_ALIGNMENT_REPORT.md)
- [FRONTEND_BACKEND_API_ALIGNMENT_REPORT.md](FRONTEND_BACKEND_API_ALIGNMENT_REPORT.md)

---

**Remember:** DO NOT deploy until P0 items are completed! ⛔
