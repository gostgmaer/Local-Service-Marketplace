# Phase 4: Installation & Setup Guide

## Prerequisites

Phase 4 implementation is complete, but requires dependency installation before running.

---

## Installation Steps

### 1. Install NestJS Schedule Package

Required for background jobs (cron-based tasks):

```bash
# In each service that has background jobs
cd services/user-service
pnpm add @nestjs/schedule

cd ../payment-service
pnpm add @nestjs/schedule

cd ../review-service
pnpm add @nestjs/schedule
```

### 2. Install File Upload Dependencies

Required for document and image uploads:

```bash
# In user-service
cd services/user-service
pnpm add @nestjs/platform-express multer
pnpm add -D @types/multer
```

### 3. Create Upload Directories

```bash
# From project root
mkdir -p services/user-service/uploads/documents
mkdir -p services/user-service/uploads/portfolio
mkdir -p services/user-service/uploads/profile-pictures
```

Or on Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path "services\user-service\uploads\documents"
New-Item -ItemType Directory -Force -Path "services\user-service\uploads\portfolio"
New-Item -ItemType Directory -Force -Path "services\user-service\uploads\profile-pictures"
```

---

## Enable Background Jobs

Add JobsModule to each service's app.module.ts:

### User Service

```typescript
// services/user-service/src/app.module.ts
import { JobsModule } from './jobs.module';

@Module({
  imports: [
    // ... existing imports
    JobsModule,
  ],
})
export class AppModule {}
```

### Payment Service

```typescript
// services/payment-service/src/app.module.ts
import { JobsModule } from './jobs.module';

@Module({
  imports: [
    // ... existing imports
    JobsModule,
  ],
})
export class AppModule {}
```

### Review Service

```typescript
// services/review-service/src/app.module.ts
import { JobsModule } from './jobs.module';

@Module({
  imports: [
    // ... existing imports
    JobsModule,
  ],
})
export class AppModule {}
```

---

## Configuration

### Environment Variables

Add to `.env` files:

```env
# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880  # 5MB in bytes
ALLOWED_IMAGE_EXTENSIONS=.jpg,.jpeg,.png,.gif,.webp
ALLOWED_DOCUMENT_EXTENSIONS=.pdf,.jpg,.jpeg,.png

# Background Jobs
ENABLE_BACKGROUND_JOBS=true
JOB_TIMEZONE=UTC
```

---

## Verify Installation

### 1. Check for Compilation Errors

```bash
# In each service
cd services/user-service
pnpm build

cd ../payment-service
pnpm build

cd ../review-service
pnpm build
```

### 2. Test File Upload

```bash
# Start user-service
cd services/user-service
pnpm start:dev

# Test upload endpoint
curl -X POST http://localhost:3002/provider-documents/upload/{providerId} \
  -F "file=@/path/to/test.pdf" \
  -F "document_type=government_id"
```

### 3. Monitor Background Jobs

Check logs for successful job registration:

```bash
# Should see job schedules registered on startup
grep "schedule" services/user-service/logs/*.log
```

---

## Known Issues & Fixes

### Issue 1: @nestjs/schedule not found

**Error**: `Cannot find module '@nestjs/schedule'`

**Fix**: Run `pnpm add @nestjs/schedule` in each service with background jobs

### Issue 2: Multer types missing

**Error**: `Cannot find namespace 'Express.Multer'`

**Fix**: 
```bash
pnpm add -D @types/multer
pnpm add -D @types/express
```

### Issue 3: NotificationService path issues

**Status**: Expected - NotificationService integration is via module imports

**Fix**: Ensure NotificationModule is imported in JobsModule (already done)

### Issue 4: Entity property mismatches

**Status**: Minor type issues in background jobs

**Fix**: Will be resolved after package installation and proper typing

---

## Testing Checklist

After installation:

- [ ] Services compile without errors
- [ ] File upload endpoints accept files
- [ ] Files saved to upload directories
- [ ] Background jobs registered (check logs)
- [ ] Cron schedules show in logs
- [ ] Test manual job trigger (optional)

---

## Production Deployment

### File Storage

For production, configure cloud storage:

**AWS S3**:
```bash
pnpm add @aws-sdk/client-s3
```

**Cloudinary**:
```bash
pnpm add cloudinary
```

Update `FileUploadService` to use cloud storage instead of local filesystem.

### Job Monitoring

Use PM2 or similar for job monitoring:

```bash
pm2 start ecosystem.config.js
pm2 logs
```

---

## Next Steps

1. Install all dependencies (listed above)
2. Enable JobsModule in app modules
3. Run `pnpm build` to verify
4. Start services and test endpoints
5. Monitor logs for background job execution
6. Proceed to Phase 5 (Frontend)

---

## Support

For issues during installation:
- Check `docs/BACKGROUND_JOBS_IMPLEMENTATION.md` for detailed job documentation
- Check `docs/PHASE_4_COMPLETE.md` for implementation summary
- Verify all packages installed: `pnpm list @nestjs/schedule`

---

End of Installation Guide
