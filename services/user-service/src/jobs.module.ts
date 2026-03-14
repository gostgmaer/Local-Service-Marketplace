import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DocumentExpiryJob } from './modules/user/jobs/document-expiry.job';
import { ProviderDocumentRepository } from './modules/user/repositories/provider-document.repository';
import { NotificationModule } from './common/notification/notification.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationModule
  ],
  providers: [
    DocumentExpiryJob,
    ProviderDocumentRepository
  ],
  exports: [DocumentExpiryJob]
})
export class JobsModule {}
