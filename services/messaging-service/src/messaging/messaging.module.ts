import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessageService } from './services/message.service';
import { AttachmentService } from './services/attachment.service';
import { MessageRepository } from './repositories/message.repository';
import { AttachmentRepository } from './repositories/attachment.repository';

@Module({
  controllers: [MessagingController],
  providers: [
    MessageService,
    AttachmentService,
    MessageRepository,
    AttachmentRepository,
  ],
  exports: [MessageService, AttachmentService],
})
export class MessagingModule {}
