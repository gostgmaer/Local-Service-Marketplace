# Background Jobs Implementation Guide

## Overview

This document describes the background job system implemented for Phase 4. All jobs use NestJS `@nestjs/schedule` with cron expressions for automatic execution.

---

## Installed Jobs

### 1. Document Expiry Job
**Service**: user-service  
**File**: `services/user-service/src/modules/user/jobs/document-expiry.job.ts`

**Schedules**:
- **9 AM Daily**: Check documents expiring within 30 days, send notifications
- **1 AM Daily**: Check recently expired documents (within 7 days), send urgent notifications

**Notifications Sent**:
- `document_expiring`: Warning 30 days before expiry
- `document_expired`: Urgent notification after expiry

---

### 2. Subscription Expiry Job
**Service**: payment-service  
**File**: `services/payment-service/src/payment/jobs/subscription-expiry.job.ts`

**Schedules**:
- **10 AM Daily**: Check subscriptions expiring within 7 days, send renewal reminders
- **2 AM Daily**: Expire old subscriptions automatically
- **Every 6 Hours**: Send final reminders for subscriptions expiring within 24 hours

**Notifications Sent**:
- `subscription_expiring`: Renewal reminder 7 days before
- `subscription_expiring_urgent`: Final reminder 1 day before

---

### 3. Review Aggregate Refresh Job
**Service**: review-service  
**File**: `services/review-service/src/review/jobs/review-aggregate-refresh.job.ts`

**Schedules**:
- **3 AM Daily**: Full refresh of all provider review aggregates
- **Every 4 Hours**: Quick refresh (placeholder for future optimization)

**Purpose**: Keeps cached review statistics up to date for performance

---

### 4. Payment Method Expiry Job
**Service**: payment-service  
**File**: `services/payment-service/src/payment/jobs/payment-method-expiry.job.ts`

**Schedules**:
- **11 AM Daily**: Check for expiring payment methods (cards)

**Status**: Placeholder implementation - needs batch user processing

---

## File Upload Service

**File**: `services/user-service/src/common/file-upload.service.ts`

**Features**:
- Upload single files (documents, profile pictures)
- Upload multiple files (portfolio images, max 10)
- File type validation (images: jpg/png/gif/webp, documents: pdf/jpg/png)
- File size validation (5MB max)
- Automatic directory creation
- Unique filename generation

**Upload Categories**:
- `document`: Provider verification documents
- `portfolio`: Portfolio showcase images
- `profile`: Profile pictures

---

## Setup Instructions

### 1. Install Dependencies

```bash
# @nestjs/schedule for cron jobs
pnpm add @nestjs/schedule

# @nestjs/platform-express for file uploads (should already be installed)
pnpm add @nestjs/platform-express multer
pnpm add -D @types/multer
```

### 2. Enable Jobs in Main App Module

Add JobsModule to imports in each service's app.module.ts:

```typescript
// user-service/src/app.module.ts
import { JobsModule } from './jobs.module';

@Module({
  imports: [
    // ... other imports
    JobsModule
  ]
})
export class AppModule {}
```

### 3. Configure File Storage

Create upload directories:

```bash
mkdir -p uploads/documents
mkdir -p uploads/portfolio
mkdir -p uploads/profile-pictures
```

For production, configure:
- AWS S3 integration
- Cloudinary for image optimization
- CDN for file delivery

---

## Cron Schedule Reference

```
EVERY_DAY_AT_1AM    = '0 1 * * *'
EVERY_DAY_AT_2AM    = '0 2 * * *'
EVERY_DAY_AT_3AM    = '0 3 * * *'
EVERY_DAY_AT_9AM    = '0 9 * * *'
EVERY_DAY_AT_10AM   = '0 10 * * *'
EVERY_DAY_AT_11AM   = '0 11 * * *'
EVERY_4_HOURS       = '0 */4 * * *'
EVERY_6_HOURS       = '0 */6 * * *'
```

---

## Testing Background Jobs

### Manual Trigger (for testing)

Add manual trigger endpoints in development:

```typescript
// In any controller
@Get('trigger-job/:jobName')
async triggerJob(@Param('jobName') jobName: string) {
  // Manually call job methods for testing
  switch(jobName) {
    case 'document-expiry':
      await this.documentExpiryJob.checkExpiringDocuments();
      break;
    // ... other jobs
  }
  return { success: true };
}
```

### Monitor Job Execution

Check logs for job execution:

```bash
grep "DocumentExpiryJob" logs/user-service.log
grep "SubscriptionExpiryJob" logs/payment-service.log
grep "ReviewAggregateRefreshJob" logs/review-service.log
```

---

## Production Considerations

1. **Job Monitoring**: Use logging or APM tools to monitor job execution
2. **Error Handling**: All jobs have try-catch blocks with error logging
3. **Performance**: Jobs run during off-peak hours (1-3 AM for heavy operations)
4. **Scalability**: Use Redis-backed job queues for horizontal scaling
5. **File Storage**: Migrate to cloud storage (S3, GCS, Azure Blob)

---

## Future Enhancements

- [ ] Redis-backed job queue for distributed systems
- [ ] Job execution dashboards
- [ ] Configurable notification preferences per job
- [ ] Retry logic for failed job executions
- [ ] S3/cloud storage integration
- [ ] Image optimization pipeline
- [ ] Batch processing for large datasets
- [ ] Job execution metrics and analytics

---

## Notification Integration

All jobs integrate with NotificationService to send:
- Email notifications
- SMS alerts (optional)
- Push notifications (optional)
- In-app notifications

Notification types defined:
- `document_expiring`
- `document_expired`
- `subscription_expiring`
- `subscription_expiring_urgent`

---

## File Upload Integration Examples

### Document Upload Controller

```typescript
@Post('upload/:providerId')
@UseInterceptors(FileInterceptor('file'))
async uploadDocument(
  @Param('providerId') providerId: string,
  @UploadedFile() file: any
) {
  const fileUrl = await this.fileUploadService.uploadFile(file, 'document');
  // Save to database...
}
```

### Portfolio Multi-Upload

```typescript
@Post('portfolio/:providerId')
@UseInterceptors(FilesInterceptor('images', 10))
async uploadPortfolio(
  @Param('providerId') providerId: string,
  @UploadedFiles() files: any[]
) {
  const imageUrls = await this.fileUploadService.uploadMultiple(files, 'portfolio');
  // Save to database...
}
```

---

End of Background Jobs Guide
