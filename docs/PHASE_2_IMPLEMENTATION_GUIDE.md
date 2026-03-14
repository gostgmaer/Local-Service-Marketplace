# Phase 2: DTOs & Validation Implementation Guide
**Estimated Time**: 12-16 hours  
**Priority**: 🟡 MEDIUM  
**Dependencies**: Phase 1 must be completed

---

## 📋 Overview

Update all DTOs (Data Transfer Objects) to include validation for new fields and ensure data consistency across services.

**Total DTOs to Update**: 26+ files

---

## Task 2.1: Auth Service DTOs (2 hours)

### Files to Update:

1. **Update Profile DTO**

**File**: `services/auth-service/src/modules/auth/dto/update-profile.dto.ts`

```typescript
import { IsOptional, IsString, IsEnum, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()  // ✅ NEW
  @IsUrl()
  profile_picture_url?: string;

  @IsOptional()  // ✅ NEW
  @IsString()
  timezone?: string;

  @IsOptional()  // ✅ NEW
  @IsEnum(['en', 'es', 'fr', 'de', 'zh', 'ar', 'hi'])
  language?: string;
}
```

2. **Create Upload Profile Picture DTO**

**File**: `services/auth-service/src/modules/auth/dto/upload-profile-picture.dto.ts`

```typescript
import { IsString, IsUrl } from 'class-validator';

export class UploadProfilePictureDto {
  @IsUrl()
  url: string;
}

// Or if using file upload:
export class ProfilePictureFileDto {
  file: Express.Multer.File;
}
```

3. **Create Phone Verification DTO**

**File**: `services/auth-service/src/modules/auth/dto/verify-phone.dto.ts`

```typescript
import { IsString, Length } from 'class-validator';

export class VerifyPhoneDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
```

---

## Task 2.2: User Service DTOs (2 hours)

### 1. Update Provider DTO

**File**: `services/user-service/src/modules/user/dto/update-provider.dto.ts`

```typescript
import { 
  IsOptional, IsString, IsNumber, IsArray, 
  IsEnum, IsUrl, Min, Max, ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';

class CertificationDto {
  @IsString()
  name: string;

  @IsString()
  issuer: string;

  @IsString()
  issue_date: string;

  @IsOptional()
  @IsString()
  expiry_date?: string;

  @IsOptional()
  @IsUrl()
  certificate_url?: string;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  business_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()  // ✅ NEW
  @IsUrl()
  profile_picture_url?: string;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(0)
  @Max(50)
  years_of_experience?: number;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(1)
  @Max(500)
  service_area_radius?: number;

  @IsOptional()  // ✅ NEW
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications?: CertificationDto[];
}
```

### 2. Create Verification Status DTO

**File**: `services/user-service/src/modules/user/dto/update-verification.dto.ts`

```typescript
import { IsEnum } from 'class-validator';

export class UpdateVerificationStatusDto {
  @IsEnum(['pending', 'verified', 'rejected'])
  status: 'pending' | 'verified' | 'rejected';
}
```

---

## Task 2.3: Request Service DTOs (2 hours)

### 1. Update Create Request DTO

**File**: `services/request-service/src/modules/request/dto/create-request.dto.ts`

```typescript
import { 
  IsString, IsNumber, IsOptional, IsArray, 
  IsEnum, IsDateString, Min, ArrayMaxSize, IsUrl 
} from 'class-validator';

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
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()  // ✅ NEW
  @IsDateString()
  preferred_date?: string;

  @IsOptional()  // ✅ NEW
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  urgency?: 'low' | 'medium' | 'high' | 'urgent';

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

### 2. Create Filter DTO

**File**: `services/request-service/src/modules/request/dto/filter-requests.dto.ts`

```typescript
import { IsOptional, IsEnum, IsNumber, Min } from 'class-validator';

export class FilterRequestsDto {
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  urgency?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsEnum(['open', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  min_budget?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_budget?: number;

  @IsOptional()
  category_id?: string;
}
```

---

## Task 2.4: Proposal Service DTOs (1.5 hours)

**File**: `services/proposal-service/src/modules/proposal/dto/create-proposal.dto.ts`

```typescript
import { 
  IsString, IsNumber, IsOptional, 
  IsDateString, Min 
} from 'class-validator';

export class CreateProposalDto {
  @IsString()
  request_id: string;

  @IsString()
  provider_id: string;

  @IsNumber()
  @Min(1)
  price: number;

  @IsString()
  message: string;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(1)
  estimated_hours?: number;

  @IsOptional()  // ✅ NEW
  @IsDateString()
  start_date?: string;

  @IsOptional()  // ✅ NEW
  @IsDateString()
  completion_date?: string;
}
```

**File**: `services/proposal-service/src/modules/proposal/dto/reject-proposal.dto.ts`

```typescript
import { IsString } from 'class-validator';

export class RejectProposalDto {
  @IsString()
  reason: string;
}
```

---

## Task 2.5: Job Service DTOs (1.5 hours)

### 1. Update Create Job DTO

**File**: `services/job-service/src/modules/job/dto/create-job.dto.ts`

```typescript
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateJobDto {
  @IsString()
  request_id: string;

  @IsString()
  provider_id: string;

  @IsString()  // ✅ NEW
  customer_id: string;

  @IsOptional()
  @IsString()
  proposal_id?: string;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(1)
  actual_amount?: number;
}
```

### 2. Create Cancel Job DTO

**File**: `services/job-service/src/modules/job/dto/cancel-job.dto.ts`

```typescript
import { IsString, IsEnum } from 'class-validator';

export class CancelJobDto {
  @IsEnum(['customer', 'provider', 'admin'])
  cancelled_by: 'customer' | 'provider' | 'admin';

  @IsString()
  reason: string;
}
```

---

## Task 2.6: Payment Service DTOs (2 hours)

### 1. Update Create Payment DTO

**File**: `services/payment-service/src/payment/dto/create-payment.dto.ts`

```typescript
import { 
  IsString, IsNumber, IsEnum, 
  IsOptional, Min 
} from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  job_id: string;

  @IsString()
  user_id: string;

  @IsString()  // ✅ NEW
  provider_id: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(['USD', 'EUR', 'GBP', 'INR'])
  currency: string;

  @IsOptional()  // ✅ NEW
  @IsEnum(['card', 'bank_transfer', 'wallet', 'cash'])
  payment_method?: 'card' | 'bank_transfer' | 'wallet' | 'cash';
}
```

### 2. Response DTOs with Fee Breakdown

**File**: `services/payment-service/src/payment/dto/payment-response.dto.ts`

```typescript
export class PaymentResponseDto {
  id: string;
  job_id: string;
  user_id: string;
  provider_id: string;
  amount: number;
  platform_fee: number;           // ✅ NEW
  provider_amount: number;        // ✅ NEW
  currency: string;
  payment_method?: string;        // ✅ NEW
  status: string;
  transaction_id?: string;
  failed_reason?: string;         // ✅ NEW
  created_at: string;
}
```

---

## Task 2.7: Review Service DTOs (1.5 hours)

### 1. Update Create Review DTO

**File**: `services/review-service/src/modules/review/dto/create-review.dto.ts`

```typescript
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  job_id: string;

  @IsString()
  user_id: string;

  @IsString()
  provider_id: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  comment: string;
}
```

### 2. Create Review Response DTO

**File**: `services/review-service/src/modules/review/dto/respond-review.dto.ts`

```typescript
import { IsString } from 'class-validator';

export class RespondReviewDto {
  @IsString()
  response: string;
}
```

### 3. Mark Helpful DTO

**File**: `services/review-service/src/modules/review/dto/mark-helpful.dto.ts`

```typescript
import { IsUUID } from 'class-validator';

export class MarkHelpfulDto {
  @IsUUID()
  review_id: string;
}
```

---

## Task 2.8: Messaging Service DTOs (1.5 hours)

### 1. Update Create Message DTO

**File**: `services/messaging-service/src/modules/messaging/dto/create-message.dto.ts`

```typescript
import { IsString, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  job_id: string;

  @IsString()
  sender_id: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  attachment_url?: string;
}
```

### 2. Create Mark Read DTO

**File**: `services/messaging-service/src/modules/messaging/dto/mark-read.dto.ts`

```typescript
import { IsArray, IsUUID } from 'class-validator';

export class MarkMessagesReadDto {
  @IsArray()
  @IsUUID('4', { each: true })
  message_ids: string[];
}
```

### 3. Edit Message DTO

**File**: `services/messaging-service/src/modules/messaging/dto/edit-message.dto.ts`

```typescript
import { IsString } from 'class-validator';

export class EditMessageDto {
  @IsString()
  message: string;
}
```

---

## Task 2.9: Coupon DTOs (1 hour)

**File**: `services/payment-service/src/coupon/dto/create-coupon.dto.ts`

```typescript
import { 
  IsString, IsNumber, IsOptional, IsDateString, 
  IsBoolean, Min, Max 
} from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  discount_percent: number;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(1)
  max_uses?: number;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(1)
  max_uses_per_user?: number;

  @IsOptional()  // ✅ NEW
  @IsNumber()
  @Min(1)
  min_purchase_amount?: number;

  @IsOptional()  // ✅ NEW
  @IsBoolean()
  active?: boolean;

  @IsDateString()
  expires_at: string;

  @IsOptional()  // ✅ NEW
  @IsString()
  created_by?: string;
}
```

---

## Task 2.10: Global Validation Pipes (1 hour)

Create reusable validation pipes for common patterns.

**File**: `services/auth-service/src/common/pipes/timezone-validation.pipe.ts`

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class TimezoneValidationPipe implements PipeTransform {
  private readonly validTimezones = [
    'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London',
    'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
    // Add more as needed
  ];

  transform(value: any) {
    if (!value) return 'UTC'; // default

    if (!this.validTimezones.includes(value)) {
      throw new BadRequestException(`Invalid timezone: ${value}`);
    }

    return value;
  }
}
```

**File**: `services/auth-service/src/common/pipes/language-validation.pipe.ts`

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class LanguageValidationPipe implements PipeTransform {
  private readonly validLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ar', 'hi'];

  transform(value: any) {
    if (!value) return 'en'; // default

    if (!this.validLanguages.includes(value)) {
      throw new BadRequestException(`Invalid language: ${value}`);
    }

    return value;
  }
}
```

---

## Task 2.11: Swagger Documentation (2 hours)

Add API documentation for all new fields.

**Example**: `services/auth-service/src/modules/auth/controllers/auth.controller.ts`

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered',
    type: AuthResponseDto 
  })
  async signup(@Body() dto: SignupDto) {
    // implementation
  }

  @Patch('profile/picture')
  @ApiOperation({ summary: 'Update profile picture' })
  @ApiBody({ type: UploadProfilePictureDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile picture updated',
    type: User 
  })
  async updateProfilePicture(
    @Req() req,
    @Body() dto: UploadProfilePictureDto
  ) {
    return this.authService.updateProfilePicture(req.user.id, dto.url);
  }

  @Patch('profile/timezone')
  @ApiOperation({ summary: 'Update user timezone' })
  @ApiResponse({ status: 200, type: User })
  async updateTimezone(
    @Req() req,
    @Body('timezone', TimezoneValidationPipe) timezone: string
  ) {
    return this.authService.updateTimezone(req.user.id, timezone);
  }
}
```

---

## ✅ Phase 2 Completion Checklist

- [ ] All Auth Service DTOs updated (5 files)
- [ ] All User Service DTOs updated (4 files)
- [ ] All Request Service DTOs updated (3 files)
- [ ] All Proposal Service DTOs updated (3 files)
- [ ] All Job Service DTOs updated (2 files)
- [ ] All Payment Service DTOs updated (3 files)
- [ ] All Review Service DTOs updated (3 files)
- [ ] All Messaging Service DTOs updated (3 files)
- [ ] Coupon DTOs updated (1 file)
- [ ] Custom validation pipes created (2 files)
- [ ] Swagger documentation added
- [ ] All DTOs have proper class-validator decorators
- [ ] Error messages are clear and user-friendly

**Validation Tests**:
```bash
# Test each DTO with invalid data
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Password123!",
    "role": "customer",
    "timezone": "INVALID_TZ"
  }'

# Should return: 400 Bad Request - Invalid timezone
```

**Deliverable**: All DTOs support new fields with proper validation

---

**Next**: See PHASE_3_IMPLEMENTATION_GUIDE.md for Repository Updates
