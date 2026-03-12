import { Controller, Post, Get, Body, Param, Query, Inject, LoggerService, ParseIntPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MessageService } from './services/message.service';
import { AttachmentService } from './services/attachment.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

@Controller('messages')
export class MessagingController {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    private readonly messageService: MessageService,
    private readonly attachmentService: AttachmentService,
  ) {}

  @Post()
  async createMessage(@Body() createMessageDto: CreateMessageDto) {
    this.logger.log('POST /messages - Create message', 'MessagingController');
    const message = await this.messageService.createMessage(
      createMessageDto.jobId,
      createMessageDto.senderId,
      createMessageDto.message,
    );
    return { message };
  }

  @Get(':id')
  async getMessage(@Param('id') id: string) {
    this.logger.log(`GET /messages/${id} - Get message`, 'MessagingController');
    const message = await this.messageService.getMessageById(id);
    return { message };
  }

  @Get('jobs/:jobId/messages')
  async getMessagesForJob(
    @Param('jobId') jobId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    this.logger.log(`GET /messages/jobs/${jobId}/messages - Get conversation`, 'MessagingController');
    const result = await this.messageService.getMessagesForJob(jobId, page, limit);
    return result;
  }

  @Post('attachments')
  async createAttachment(@Body() createAttachmentDto: CreateAttachmentDto) {
    this.logger.log('POST /messages/attachments - Create attachment', 'MessagingController');
    const attachment = await this.attachmentService.createAttachment(
      createAttachmentDto.entityType,
      createAttachmentDto.entityId,
      createAttachmentDto.fileUrl,
    );
    return { attachment };
  }

  @Get('attachments/:id')
  async getAttachment(@Param('id') id: string) {
    this.logger.log(`GET /messages/attachments/${id} - Get attachment`, 'MessagingController');
    const attachment = await this.attachmentService.getAttachmentById(id);
    return { attachment };
  }

  @Get('attachments/:entityType/:entityId')
  async getAttachmentsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    this.logger.log(`GET /messages/attachments/${entityType}/${entityId} - Get attachments`, 'MessagingController');
    const attachments = await this.attachmentService.getAttachmentsByEntity(entityType, entityId);
    return { attachments };
  }
}
