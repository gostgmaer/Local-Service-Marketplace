import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import {
  MessageRepository,
  PaginatedMessages,
} from "../repositories/message.repository";
import { Message } from "../entities/message.entity";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";
import { EmailClient } from "../../notification/clients/email.client";
import { UserClient } from "../../common/user/user.client";
import { NotificationPreferencesService } from "../../notification/services/notification-preferences.service";
import { NotificationService } from "../../notification/services/notification.service";
import { UpdatesService } from "../../updates/updates.service";

@Injectable()
export class MessageService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly messageRepository: MessageRepository,
    private readonly emailClient: EmailClient,
    private readonly userClient: UserClient,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly notificationService: NotificationService,
    private readonly updatesService: UpdatesService,
  ) {}

  async createMessage(
    jobId: string,
    senderId: string,
    message: string,
  ): Promise<Message> {
    this.logger.log(
      `Creating message for job ${jobId} from sender ${senderId}`,
      "MessageService",
    );

    // Strip HTML tags to prevent stored XSS — messages are plain text only
    const sanitizedMessage = message
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();

    if (!sanitizedMessage) {
      throw new BadRequestException('Message content cannot be empty after sanitization');
    }

    const newMessage = await this.messageRepository.createMessage(
      jobId,
      senderId,
      sanitizedMessage,
    );
    this.logger.log(
      `Message created successfully: ${newMessage.id}`,
      "MessageService",
    );

    // Notify the other participant: always in-app, email only if offline and they have message_alerts enabled
    this.messageRepository
      .getJobRecipientId(newMessage.job_id, senderId)
      .then(async (recipientId) => {
        if (!recipientId) return;

        // Broadcast real-time event to both participants
        this.updatesService.broadcast({
          entityType: "message",
          entityId: newMessage.id,
          action: "created",
          userId: senderId,
          relatedIds: { jobId: newMessage.job_id },
          rooms: [`user:${senderId}`, `user:${recipientId}`],
        });

        // Check notification preferences before sending any alert
        const alertsEnabled =
          await this.notificationPreferencesService.checkNotificationEnabled(
            recipientId,
            "message_alerts",
          );
        if (!alertsEnabled) return;

        // Create in-app notification — this also fires the `notification:created`
        // WebSocket event which increments the badge and shows a toast on the frontend.
        // Email is only sent when the recipient has no active WebSocket connection.
        const isOnline = this.updatesService.isUserOnline(recipientId);
        const preview =
          sanitizedMessage.length > 80
            ? `${sanitizedMessage.substring(0, 77)}...`
            : sanitizedMessage;
        await this.notificationService.createNotification(
          recipientId,
          "message",
          `New message: ${preview}`,
          { sendEmail: !isOnline },
        );
      })
      .catch((err: any) => {
        this.logger.warn(
          `Failed to send new message notification: ${err.message}`,
          "MessageService",
        );
      });

    return newMessage;
  }

  async getMessageById(
    id: string,
    requestingUserId?: string,
  ): Promise<Message> {
    this.logger.log(`Fetching message ${id}`, "MessageService");
    const message = await this.messageRepository.getMessageById(id);
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (requestingUserId) {
      const isParticipant = await this.messageRepository.isJobParticipant(
        message.job_id,
        requestingUserId,
      );
      if (!isParticipant) {
        throw new ForbiddenException(
          "You are not authorized to view this message",
        );
      }
    }
    return message;
  }

  async getMessagesForJob(
    jobId: string,
    user: any,
    page: number = 1,
    limit: number = 20,
    sortOrder?: string,
  ): Promise<PaginatedMessages> {
    this.logger.log(
      `Fetching messages for job ${jobId} for user ${user.userId} (page ${page}, limit ${limit})`,
      "MessageService",
    );

    // RBAC: Verify user is participant or has manage permission
    if (!user.permissions?.includes("messages.manage")) {
      const { rows: conversations } = await this.messageRepository.getUserConversations(
        user.userId,
        100,
        0,
      );
      const isParticipant = conversations.some((c) => c.job_id === jobId);

      if (!isParticipant) {
        throw new ForbiddenException(
          "You are not authorized to view messages for this job",
        );
      }
    }

    return this.messageRepository.getMessagesForJob(jobId, page, limit, sortOrder);
  }

  async getUserConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ rows: any[]; total: number }> {
    this.logger.log(
      `Fetching conversations for user ${userId}`,
      "MessageService",
    );
    return this.messageRepository.getUserConversations(userId, limit, offset);
  }

  async markMessageAsRead(id: string, userId?: string): Promise<Message> {
    this.logger.log(`Marking message ${id} as read`, "MessageService");
    const message = await this.messageRepository.getMessageById(id);
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (userId) {
      const isParticipant = await this.messageRepository.isJobParticipant(
        message.job_id,
        userId,
      );
      if (!isParticipant) {
        throw new ForbiddenException(
          "You are not authorized to mark this message as read",
        );
      }
    }
    return this.messageRepository.markAsRead(message.id);
  }
  async updateMessage(id: string, newMessage: string): Promise<Message> {
    this.logger.log(`Updating message ${id}`, "MessageService");
    const message = await this.messageRepository.editMessage(id, newMessage);
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    return message;
  }
  async deleteMessage(id: string): Promise<void> {
    this.logger.log(`Deleting message ${id}`, "MessageService");
    const message = await this.getMessageById(id);
    await this.messageRepository.deleteMessage(message.id);
    this.logger.log(`Message ${id} deleted successfully`, "MessageService");
  }
}
