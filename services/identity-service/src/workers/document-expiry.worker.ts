import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Inject, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { UserRepository } from "../modules/auth/repositories/user.repository";
import { ProviderDocumentRepository } from "../modules/user/repositories/provider-document.repository";
import { NotificationClient } from "../common/notification/notification.client";
import { DEFAULT_JOB_OPTIONS } from "../bullmq/bullmq-default-options";

export interface DocumentExpiryCheckData {
  warningDays?: number;
}

@Processor("identity.document", {
  concurrency: 1,
})
export class DocumentExpiryWorker extends WorkerHost implements OnModuleInit {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @InjectQueue("identity.document") private readonly documentQueue: Queue,
    private readonly userRepository: UserRepository,
    private readonly providerDocumentRepository: ProviderDocumentRepository,
    private readonly notificationClient: NotificationClient,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Replace @Cron(EVERY_DAY_AT_9AM) from DocumentExpiryJob
    await this.documentQueue.add(
      "check-document-expiry",
      { warningDays: 30 },
      { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "0 9 * * *" } },
    );

    // Replace @Cron(EVERY_DAY_AT_1AM) — expire overdue documents
    await this.documentQueue.add(
      "expire-overdue-documents",
      {},
      { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "0 1 * * *" } },
    );

    this.logger.info("Document expiry repeatable jobs registered", {
      context: "DocumentExpiryWorker",
    });
  }

  async process(job: Job<any, any, string>): Promise<any> {
    try {
      switch (job.name) {
        case "check-document-expiry":
          return this.handleCheckDocumentExpiry(job.data);
        case "expire-overdue-documents":
          return this.handleExpireOverdueDocuments();
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error: any) {
      const err = error as Error;
      this.logger.error(`Job "${job.name}/${job.id}" threw: ${err.message}`, {
        context: "DocumentExpiryWorker",
        stack: err.stack,
      });
      throw error;
    }
  }

  private async handleCheckDocumentExpiry(
    data: DocumentExpiryCheckData,
  ): Promise<void> {
    const warningDays = data.warningDays ?? 30;
    this.logger.info(`Checking documents expiring within ${warningDays} days`, {
      context: "DocumentExpiryWorker",
    });

    const expiringDocs =
      await this.providerDocumentRepository.getExpiringDocuments(warningDays);

    this.logger.info(
      `Found ${expiringDocs.length} document(s) expiring within ${warningDays} days`,
      { context: "DocumentExpiryWorker" },
    );

    for (const doc of expiringDocs) {
      const docRow = doc as any;
      if (!docRow.user_id) continue;
      const user = await this.userRepository.findById(docRow.user_id).catch(() => null);
      if (!user?.email) continue;

      const expiryStr = new Date(doc.expires_at).toLocaleDateString("en-IN");
      await this.notificationClient
        .sendEmail({
          to: user.email,
          template: "MESSAGE_RECEIVED",
          variables: {
            recipientName: user.name || user.email.split("@")[0],
            senderName: "LocalServices",
            messagePreview: `Your document "${doc.document_type}" (ID: ${doc.id.slice(0, 8)}) will expire on ${expiryStr}. Please re-upload it before it expires to keep your provider profile active.`,
            replyUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/provider/documents`,
          },
        })
        .catch((err: Error) => {
          this.logger.warn(
            `Failed to send document expiry email for doc ${doc.id}: ${err.message}`,
            { context: "DocumentExpiryWorker" },
          );
        });
    }

    this.logger.info(
      `Document expiry check complete — notified ${expiringDocs.length} providers`,
      { context: "DocumentExpiryWorker" },
    );
  }

  private async handleExpireOverdueDocuments(): Promise<void> {
    this.logger.info("Expiring overdue documents", {
      context: "DocumentExpiryWorker",
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Worker lifecycle hooks
  // ─────────────────────────────────────────────────────────────────

  @OnWorkerEvent("active")
  onActive(job: Job): void {
    this.logger.info(
      `Job "${job.name}/${job.id}" started (attempt ${job.attemptsMade + 1})`,
      { context: "DocumentExpiryWorker" },
    );
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job): void {
    this.logger.info(`Job "${job.name}/${job.id}" completed`, {
      context: "DocumentExpiryWorker",
    });
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Job "${job?.name ?? "unknown"}/${job?.id ?? "?"}" failed (attempt ${job?.attemptsMade ?? 0}): ${error.message}`,
      { context: "DocumentExpiryWorker", stack: error.stack },
    );
  }

  @OnWorkerEvent("error")
  onError(error: Error): void {
    this.logger.error(`Worker error: ${error.message}`, {
      context: "DocumentExpiryWorker",
      stack: error.stack,
    });
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string): void {
    this.logger.warn(`Job ${jobId} stalled and will be requeued`, {
      context: "DocumentExpiryWorker",
    });
  }
}
