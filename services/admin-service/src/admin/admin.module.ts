import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UserModerationService } from './services/user-moderation.service';
import { DisputeService } from './services/dispute.service';
import { AuditLogService } from './services/audit-log.service';
import { SystemSettingService } from './services/system-setting.service';
import { AdminActionRepository } from './repositories/admin-action.repository';
import { DisputeRepository } from './repositories/dispute.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { SystemSettingRepository } from './repositories/system-setting.repository';

@Module({
  controllers: [AdminController],
  providers: [
    UserModerationService,
    DisputeService,
    AuditLogService,
    SystemSettingService,
    AdminActionRepository,
    DisputeRepository,
    AuditLogRepository,
    SystemSettingRepository,
  ],
  exports: [
    UserModerationService,
    DisputeService,
    AuditLogService,
    SystemSettingService,
  ],
})
export class AdminModule {}
