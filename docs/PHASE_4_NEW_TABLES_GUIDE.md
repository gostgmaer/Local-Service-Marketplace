# Phase 4: New Tables Implementation Guide
**Estimated Time**: 40-50 hours  
**Priority**: 🔴 CRITICAL  
**Dependencies**: Phase 1-3 must be completed

---

## 📋 Overview

Implement 7 new database tables with full CRUD operations, validation, and business logic.

**New Tables**:
1. ✅ provider_documents (Document verification system)
2. ✅ provider_portfolio (Portfolio showcase)
3. ✅ notification_preferences (Granular notification control)
4. ✅ saved_payment_methods (Tokenized payment storage)
5. ✅ pricing_plans (Subscription tiers)
6. ✅ subscriptions (Provider subscriptions)
7. ✅ provider_review_aggregates (Cached review statistics)

---

# Table 1: Provider Documents (8-10 hours)

**Service**: user-service  
**Priority**: 🔴 CRITICAL (required for provider verification)

---

## Step 1: Create Entity (30 mins)

**File**: `services/user-service/src/modules/provider-documents/entities/provider-document.entity.ts`

```typescript
export class ProviderDocument {
  id: string;
  provider_id: string;
  document_type: 'license' | 'insurance' | 'certification' | 'id_proof' | 'other';
  document_url: string;
  document_number?: string;
  issue_date?: Date;
  expiry_date?: Date;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_by?: string;
  verified_at?: Date;
  rejection_reason?: string;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}
```

---

## Step 2: Create DTOs (1 hour)

**File**: `services/user-service/src/modules/provider-documents/dto/upload-document.dto.ts`

```typescript
import { IsString, IsEnum, IsOptional, IsDateString, IsUrl } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  provider_id: string;

  @IsEnum(['license', 'insurance', 'certification', 'id_proof', 'other'])
  document_type: 'license' | 'insurance' | 'certification' | 'id_proof' | 'other';

  @IsUrl()
  document_url: string;

  @IsOptional()
  @IsString()
  document_number?: string;

  @IsOptional()
  @IsDateString()
  issue_date?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}
```

**File**: `services/user-service/src/modules/provider-documents/dto/verify-document.dto.ts`

```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class VerifyDocumentDto {
  @IsEnum(['verified', 'rejected'])
  verification_status: 'verified' | 'rejected';

  @IsString()
  verified_by: string;

  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
```

---

## Step 3: Create Repository (2 hours)

**File**: `services/user-service/src/modules/provider-documents/repositories/provider-document.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { ProviderDocument } from '../entities/provider-document.entity';
import { UploadDocumentDto } from '../dto/upload-document.dto';

@Injectable()
export class ProviderDocumentRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: UploadDocumentDto): Promise<ProviderDocument> {
    const query = `
      INSERT INTO provider_documents (
        provider_id, document_type, document_url, document_number,
        issue_date, expiry_date, verification_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `;

    const values = [
      data.provider_id,
      data.document_type,
      data.document_url,
      data.document_number,
      data.issue_date,
      data.expiry_date
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findById(documentId: string): Promise<ProviderDocument | null> {
    const query = `
      SELECT * FROM provider_documents
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.pool.query(query, [documentId]);
    return result.rows[0] || null;
  }

  async findByProvider(providerId: string): Promise<ProviderDocument[]> {
    const query = `
      SELECT * FROM provider_documents
      WHERE provider_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [providerId]);
    return result.rows;
  }

  async verify(
    documentId: string,
    status: 'verified' | 'rejected',
    verifiedBy: string,
    rejectionReason?: string
  ): Promise<ProviderDocument> {
    const query = `
      UPDATE provider_documents
      SET verification_status = $1,
          verified_by = $2,
          verified_at = NOW(),
          rejection_reason = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      status,
      verifiedBy,
      rejectionReason,
      documentId
    ]);
    return result.rows[0];
  }

  async getPendingDocuments(limit: number = 20): Promise<ProviderDocument[]> {
    const query = `
      SELECT pd.*, p.business_name, p.user_id
      FROM provider_documents pd
      JOIN providers p ON pd.provider_id = p.id
      WHERE pd.verification_status = 'pending'
        AND pd.deleted_at IS NULL
      ORDER BY pd.created_at ASC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getExpiredDocuments(): Promise<ProviderDocument[]> {
    const query = `
      SELECT * FROM provider_documents
      WHERE expiry_date IS NOT NULL
        AND expiry_date < NOW()
        AND verification_status = 'verified'
        AND deleted_at IS NULL
      ORDER BY expiry_date ASC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getExpiringDocuments(days: number = 30): Promise<ProviderDocument[]> {
    const query = `
      SELECT pd.*, p.business_name, p.user_id
      FROM provider_documents pd
      JOIN providers p ON pd.provider_id = p.id
      WHERE pd.expiry_date IS NOT NULL
        AND pd.expiry_date > NOW()
        AND pd.expiry_date <= NOW() + INTERVAL '${days} days'
        AND pd.verification_status = 'verified'
        AND pd.deleted_at IS NULL
      ORDER BY pd.expiry_date ASC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async delete(documentId: string): Promise<void> {
    const query = `
      UPDATE provider_documents
      SET deleted_at = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [documentId]);
  }
}
```

---

## Step 4: Create Service (2 hours)

**File**: `services/user-service/src/modules/provider-documents/services/provider-document.service.ts`

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProviderDocumentRepository } from '../repositories/provider-document.repository';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { VerifyDocumentDto } from '../dto/verify-document.dto';

@Injectable()
export class ProviderDocumentService {
  constructor(
    private readonly documentRepo: ProviderDocumentRepository
  ) {}

  async uploadDocument(data: UploadDocumentDto) {
    // Validate provider exists
    // ... validation logic

    return this.documentRepo.create(data);
  }

  async getProviderDocuments(providerId: string, requestingUserId: string) {
    // Check if requesting user is the provider owner or admin
    // ... authorization logic

    return this.documentRepo.findByProvider(providerId);
  }

  async verifyDocument(
    documentId: string,
    verifyDto: VerifyDocumentDto,
    adminId: string
  ) {
    const document = await this.documentRepo.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.documentRepo.verify(
      documentId,
      verifyDto.verification_status,
      adminId,
      verifyDto.rejection_reason
    );
  }

  async getPendingDocuments() {
    return this.documentRepo.getPendingDocuments();
  }

  async getExpiringDocuments(days: number = 30) {
    return this.documentRepo.getExpiringDocuments(days);
  }

  async deleteDocument(documentId: string, userId: string) {
    const document = await this.documentRepo.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Verify ownership
    // ... authorization logic

    return this.documentRepo.delete(documentId);
  }
}
```

---

## Step 5: Create Controller (1.5 hours)

**File**: `services/user-service/src/modules/provider-documents/controllers/provider-document.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req
} from '@nestjs/common';
import { ProviderDocumentService } from '../services/provider-document.service';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { VerifyDocumentDto } from '../dto/verify-document.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('provider-documents')
@UseGuards(JwtAuthGuard)
export class ProviderDocumentController {
  constructor(private readonly documentService: ProviderDocumentService) {}

  @Post()
  @Roles('provider')
  @UseGuards(RolesGuard)
  async uploadDocument(@Body() dto: UploadDocumentDto, @Req() req) {
    // Ensure user can only upload for their own provider profile
    return this.documentService.uploadDocument(dto);
  }

  @Get('provider/:providerId')
  async getProviderDocuments(
    @Param('providerId') providerId: string,
    @Req() req
  ) {
    return this.documentService.getProviderDocuments(
      providerId,
      req.user.id
    );
  }

  @Patch(':documentId/verify')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async verifyDocument(
    @Param('documentId') documentId: string,
    @Body() dto: VerifyDocumentDto,
    @Req() req
  ) {
    return this.documentService.verifyDocument(
      documentId,
      dto,
      req.user.id
    );
  }

  @Get('pending')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async getPendingDocuments() {
    return this.documentService.getPendingDocuments();
  }

  @Get('expiring')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async getExpiringDocuments(@Query('days') days?: number) {
    return this.documentService.getExpiringDocuments(days ? +days : 30);
  }

  @Delete(':documentId')
  async deleteDocument(@Param('documentId') documentId: string, @Req() req) {
    return this.documentService.deleteDocument(documentId, req.user.id);
  }
}
```

---

## Step 6: Create Module (30 mins)

**File**: `services/user-service/src/modules/provider-documents/provider-document.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ProviderDocumentController } from './controllers/provider-document.controller';
import { ProviderDocumentService } from './services/provider-document.service';
import { ProviderDocumentRepository } from './repositories/provider-document.repository';

@Module({
  controllers: [ProviderDocumentController],
  providers: [ProviderDocumentService, ProviderDocumentRepository],
  exports: [ProviderDocumentService]
})
export class ProviderDocumentModule {}
```

**Update app module**:

```typescript
// services/user-service/src/app.module.ts
import { ProviderDocumentModule } from './modules/provider-documents/provider-document.module';

@Module({
  imports: [
    // ... other modules
    ProviderDocumentModule
  ]
})
export class AppModule {}
```

---

## Step 7: File Upload Integration (2 hours)

**Install dependencies**:
```bash
cd services/user-service
pnpm add @nestjs/platform-express multer
pnpm add -D @types/multer
```

**Create upload utility**:

**File**: `services/user-service/src/common/utils/file-upload.util.ts`

```typescript
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

export const documentFileFilter = (req, file, callback) => {
  const allowedTypes = /pdf|jpg|jpeg|png/;
  const ext = extname(file.originalname).toLowerCase();
  const mimeType = allowedTypes.test(file.mimetype);
  const fileExt = allowedTypes.test(ext);

  if (mimeType && fileExt) {
    return callback(null, true);
  }

  callback(new Error('Only PDF and image files are allowed'), false);
};

export const documentStorage = diskStorage({
  destination: './uploads/documents',
  filename: (req, file, callback) => {
    const filename = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, filename);
  }
});
```

**Update controller for file upload**:

```typescript
import { 
  Controller, Post, UploadedFile, UseInterceptors 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { documentStorage, documentFileFilter } from '../../../common/utils/file-upload.util';

@Controller('provider-documents')
export class ProviderDocumentController {
  
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: documentStorage,
      fileFilter: documentFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 } // 5MB
    })
  )
  async uploadDocumentFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: Omit<UploadDocumentDto, 'document_url'>
  ) {
    const documentUrl = `/uploads/documents/${file.filename}`;
    
    return this.documentService.uploadDocument({
      ...dto,
      document_url: documentUrl
    });
  }
}
```

---

## Step 8: Background Job - Expiry Notifications (1 hour)

**File**: `services/user-service/src/jobs/document-expiry.job.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProviderDocumentService } from '../modules/provider-documents/services/provider-document.service';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class DocumentExpiryJob {
  private readonly logger = new Logger(DocumentExpiryJob.name);

  constructor(
    private readonly documentService: ProviderDocumentService,
    private readonly notificationService: NotificationService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringDocuments() {
    this.logger.log('Checking for expiring documents...');

    const expiringDocs = await this.documentService.getExpiringDocuments(30);

    for (const doc of expiringDocs) {
      await this.notificationService.sendNotification({
        user_id: doc.user_id,
        type: 'document_expiring',
        title: 'Document Expiring Soon',
        message: `Your ${doc.document_type} will expire on ${doc.expiry_date}. Please update it.`,
        data: { document_id: doc.id }
      });
    }

    this.logger.log(`Sent ${expiringDocs.length} expiry notifications`);
  }
}
```

---

## ✅ Provider Documents Completion Checklist

- [ ] Entity created
- [ ] DTOs created (2 files)
- [ ] Repository created with 7 methods
- [ ] Service created with business logic
- [ ] Controller created with 6 endpoints
- [ ] Module configured
- [ ] File upload integrated
- [ ] Background job for expiry notifications
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Swagger documentation added

**API Endpoints**:
- POST `/provider-documents/upload` - Upload document with file
- GET `/provider-documents/provider/:id` - Get provider's documents
- PATCH `/provider-documents/:id/verify` - Verify document (admin)
- GET `/provider-documents/pending` - Get pending verifications (admin)
- GET `/provider-documents/expiring` - Get expiring documents (admin)
- DELETE `/provider-documents/:id` - Delete document

---

# Table 2: Provider Portfolio (6-8 hours)

Similar implementation pattern as Provider Documents.

---

## Quick Setup

**Entity**: `services/user-service/src/modules/portfolio/entities/portfolio.entity.ts`

```typescript
export class ProviderPortfolio {
  id: string;
  provider_id: string;
  title: string;
  description?: string;
  images: string[];
  category_id?: string;
  completed_at?: Date;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}
```

**Key Methods**:
- `createPortfolioItem()`
- `getProviderPortfolio(providerId)`
- `updatePortfolioItem()`
- `deletePortfolioItem()`
- `getPortfolioByCategory(categoryId)`

**File Upload**: Multiple images per portfolio item (max 10 images, 5MB each)

---

# Table 3: Notification Preferences (4-6 hours)

**Service**: notification-service  
**Entity**: `notification-preferences.entity.ts`

```typescript
export class NotificationPreference {
  id: string;
  user_id: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  event_type: string; // 'new_proposal', 'job_update', etc.
  enabled: boolean;
  created_at: Date;
  updated_at?: Date;
}
```

**Key Features**:
- Default preferences on user signup
- Bulk update preferences
- Respect preferences in notification delivery
- Analytics per channel

---

# Table 4: Saved Payment Methods (6-8 hours)

**Service**: payment-service  
**Priority**: 🔴 CRITICAL (PCI compliance required)

```typescript
export class SavedPaymentMethod {
  id: string;
  user_id: string;
  type: 'card' | 'bank_account' | 'wallet';
  provider: 'stripe' | 'paypal' | 'razorpay';
  token: string; // Tokenized, never store actual card data
  last_four?: string;
  expiry_month?: number;
  expiry_year?: number;
  is_default: boolean;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}
```

**Security Requirements**:
- Never store actual card numbers
- Use payment gateway tokenization
- Encrypt tokens at rest
- PCI-DSS compliance
- Strong authorization checks

---

# Table 5 & 6: Pricing Plans & Subscriptions (10-12 hours)

**Service**: payment-service  
**Priority**: 🟡 MEDIUM (can defer if needed)

**Pricing Plans Entity**:
```typescript
export class PricingPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  features: any; // JSONB
  is_active: boolean;
  created_at: Date;
  updated_at?: Date;
}
```

**Subscriptions Entity**:
```typescript
export class Subscription {
  id: string;
  provider_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  start_date: Date;
  end_date?: Date;
  auto_renew: boolean;
  created_at: Date;
  updated_at?: Date;
}
```

**Key Features**:
- Subscription lifecycle management
- Auto-renewal handling
- Payment retry logic
- Upgrade/downgrade plans
- Cancellation with refund logic

---

# Table 7: Provider Review Aggregates (3-4 hours)

**Service**: review-service  
**Auto-populated by triggers** (already in database)

```typescript
export class ProviderReviewAggregate {
  provider_id: string;
  total_reviews: number;
  average_rating: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  last_updated: Date;
}
```

**Implementation**:
- Mostly read-only (triggers update it)
- Expose via provider service
- Cache in Redis for performance
- Use for search/filtering

---

## ✅ Phase 4 Overall Completion Checklist

- [ ] Provider Documents module (8 hours)
- [ ] Provider Portfolio module (6 hours)
- [ ] Notification Preferences module (4 hours)
- [ ] Saved Payment Methods module (8 hours)
- [ ] Pricing Plans module (5 hours)
- [ ] Subscriptions module (7 hours)
- [ ] Review Aggregates integration (3 hours)
- [ ] All file uploads secured
- [ ] All PCI compliance requirements met
- [ ] Background jobs configured
- [ ] Full test coverage (unit + integration)
- [ ] Swagger docs complete

**Deliverable**: 7 new tables fully operational with REST APIs

---

**Next**: See PHASE_5_FRONTEND_GUIDE.md for UI implementation
