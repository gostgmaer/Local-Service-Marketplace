import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './services/notification.service';
import { EmailWorkerService } from './services/email-worker.service';
import { PushWorkerService } from './services/push-worker.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationDeliveryRepository } from './repositories/notification-delivery.repository';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailWorkerService,
    PushWorkerService,
    NotificationRepository,
    NotificationDeliveryRepository,
  ],
  exports: [NotificationService, EmailWorkerService, PushWorkerService],
})
export class NotificationModule {}
