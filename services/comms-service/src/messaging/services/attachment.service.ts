import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { AttachmentRepository } from "../repositories/attachment.repository";
import { Attachment } from "../entities/attachment.entity";
import {
  NotFoundException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";

const MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class AttachmentService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly attachmentRepository: AttachmentRepository,
  ) {}

  async createAttachment(
    messageId: string,
    fileId: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
  ): Promise<Attachment> {
    this.logger.log(
      `Creating attachment for message ${messageId}`,
      "AttachmentService",
    );

    // Enforce total attachment size cap per message (50 MB)
    if (fileSize) {
      const existingTotal =
        await this.attachmentRepository.getTotalSizeByMessageId(messageId);
      if (existingTotal + fileSize > MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
        throw new BadRequestException(
          `Total attachment size for this message would exceed the 50 MB limit`,
        );
      }
    }

    const attachment = await this.attachmentRepository.createAttachment(
      messageId,
      fileId,
      fileName,
      fileSize,
      mimeType,
    );
    this.logger.log(
      `Attachment created successfully: ${attachment.id}`,
      "AttachmentService",
    );
    return attachment;
  }

  async getAttachmentById(id: string): Promise<Attachment> {
    this.logger.log(`Fetching attachment ${id}`, "AttachmentService");
    const attachment = await this.attachmentRepository.getAttachmentById(id);
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    return attachment;
  }

  async getAttachmentsByMessageId(messageId: string): Promise<Attachment[]> {
    this.logger.log(
      `Fetching attachments for message ${messageId}`,
      "AttachmentService",
    );
    return this.attachmentRepository.getAttachmentsByMessageId(messageId);
  }

  async deleteAttachment(id: string): Promise<void> {
    this.logger.log(`Deleting attachment ${id}`, "AttachmentService");
    const attachment = await this.getAttachmentById(id);
    await this.attachmentRepository.deleteAttachment(attachment.id);
    this.logger.log(
      `Attachment ${id} deleted successfully`,
      "AttachmentService",
    );
  }
}
