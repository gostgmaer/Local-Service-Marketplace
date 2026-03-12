import { Controller, Get, Patch, Post, Param, Query, Headers, Inject, LoggerService, ParseIntPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { NotificationService } from './services/notification.service';
import { EmailWorkerService } from './services/email-worker.service';
import { PushWorkerService } from './services/push-worker.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    private readonly notificationService: NotificationService,
    private readonly emailWorker: EmailWorkerService,
    private readonly pushWorker: PushWorkerService,
  ) {}

  @Get()
  async getNotifications(
    @Headers('x-user-id') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
  ) {
    this.logger.log(`GET /notifications - Get notifications for user ${userId}`, 'NotificationController');
    const notifications = await this.notificationService.getNotificationsByUserId(userId, limit);
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    return { notifications, unreadCount };
  }

  @Get(':id')
  async getNotification(@Param('id') id: string) {
    this.logger.log(`GET /notifications/${id} - Get notification`, 'NotificationController');
    const notification = await this.notificationService.getNotificationById(id);
    return { notification };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    this.logger.log(`PATCH /notifications/${id}/read - Mark as read`, 'NotificationController');
    const notification = await this.notificationService.markAsRead(id);
    return { notification };
  }

  // Worker endpoints (in production, these would be called by background job scheduler)
  @Post('workers/process-emails')
  async processEmails() {
    this.logger.log('POST /notifications/workers/process-emails - Process email queue', 'NotificationController');
    await this.emailWorker.processPendingEmails();
    return { message: 'Email processing completed' };
  }

  @Post('workers/process-push')
  async processPush() {
    this.logger.log('POST /notifications/workers/process-push - Process push queue', 'NotificationController');
    await this.pushWorker.processPendingPushNotifications();
    return { message: 'Push notification processing completed' };
  }
}
