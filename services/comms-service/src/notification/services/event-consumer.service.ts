import {
  Injectable,
  Inject,
  LoggerService,
  OnModuleInit,
} from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { KafkaService } from "../../kafka/kafka.service";
import { NotificationService } from "./notification.service";
import { UpdatesService } from "../../updates/updates.service";

/**
 * Events that are critical enough to warrant an email fallback when the
 * recipient is not currently online. All other events are in-app only.
 */
const CRITICAL_EMAIL_EVENTS = new Set([
  "proposal_submitted",
  "proposal_accepted",
]);

@Injectable()
export class EventConsumerService implements OnModuleInit {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly kafkaService: KafkaService,
    private readonly notificationService: NotificationService,
    private readonly updatesService: UpdatesService,
  ) {}

  async onModuleInit() {
    if (this.kafkaService.isKafkaEnabled()) {
      this.logger.log("Starting Kafka event consumer", "EventConsumerService");
      await this.kafkaService.startConsuming(this.handleEvent.bind(this));
    }
  }

  /**
   * Helper that creates a notification and conditionally queues an email.
   * Email is only sent for CRITICAL_EMAIL_EVENTS and only when the recipient
   * does not have an active WebSocket connection (i.e. they are offline).
   */
  private async notify(
    userId: string,
    type: string,
    message: string,
    eventType: string,
  ): Promise<void> {
    const isCritical = CRITICAL_EMAIL_EVENTS.has(eventType);
    const isOnline = this.updatesService.isUserOnline(userId);
    await this.notificationService.createNotification(userId, type, message, {
      sendEmail: isCritical && !isOnline,
    });
  }

  private async handleEvent(event: any): Promise<void> {
    // Normalize: oversight uses `event` field, others use `eventType`
    const eventType = event.eventType || event.event;
    this.logger.log(
      `Processing event: ${eventType}`,
      "EventConsumerService",
    );

    try {
      switch (eventType) {
        case "request_created":
          await this.handleRequestCreated(event);
          break;
        case "proposal_submitted":
          await this.handleProposalSubmitted(event);
          break;
        case "proposal_accepted":
          await this.handleProposalAccepted(event);
          break;
        case "proposal_rejected":
          await this.handleProposalRejected(event);
          break;
        case "job_created":
          await this.handleJobCreated(event);
          break;
        case "job_started":
          await this.handleJobStarted(event);
          break;
        case "job_completed":
          await this.handleJobCompleted(event);
          break;
        case "job_cancelled":
          await this.handleJobCancelled(event);
          break;
        case "payment_completed":
          await this.handlePaymentCompleted(event);
          break;
        case "payment_failed":
          await this.handlePaymentFailed(event);
          break;
        case "payment_confirmation_needed":
          await this.handlePaymentCompleted(event);
          break;
        case "review_submitted":
          await this.handleReviewSubmitted(event);
          break;
        case "dispute_status_changed":
          await this.handleDisputeStatusChanged(event);
          break;
        default:
          this.logger.log(
            `Unhandled event type: ${eventType}`,
            "EventConsumerService",
          );
      }
    } catch (error: any) {
      this.logger.error(
        `Error handling event ${eventType}: ${error.message}`,
        error.stack,
        "EventConsumerService",
      );
    }
  }

  private async handleRequestCreated(event: any): Promise<void> {
    const ref = event.data.requestDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    await this.notify(
      event.data.userId,
      "request",
      `Your service request has been created successfully${refSuffix}`,
      "request_created",
    );
  }

  private async handleProposalSubmitted(event: any): Promise<void> {
    const requestRef = event.data.requestDisplayId || "";
    const proposalRef =
      event.data.proposalDisplayId || event.data.displayId || "";
    const refParts = [
      requestRef && `Request: ${requestRef}`,
      proposalRef && `Proposal: ${proposalRef}`,
    ].filter(Boolean);
    const refSuffix = refParts.length ? ` (${refParts.join(", ")})` : "";
    const recipientId = event.data.customerId || event.data.userId;
    await this.notify(
      recipientId,
      "proposal",
      `A provider has submitted a proposal for your request${refSuffix}`,
      "proposal_submitted",
    );
  }

  private async handleProposalAccepted(event: any): Promise<void> {
    const jobRef = event.data.jobDisplayId || "";
    const proposalRef =
      event.data.proposalDisplayId || event.data.displayId || "";
    const refParts = [
      proposalRef && `Proposal: ${proposalRef}`,
      jobRef && `Job: ${jobRef}`,
    ].filter(Boolean);
    const refSuffix = refParts.length ? ` (${refParts.join(", ")})` : "";
    await this.notify(
      event.data.providerId,
      "proposal",
      `Your proposal has been accepted${refSuffix}`,
      "proposal_accepted",
    );
  }

  private async handleProposalRejected(event: any): Promise<void> {
    const requestRef = event.data.requestDisplayId || "";
    const proposalRef =
      event.data.proposalDisplayId || event.data.displayId || "";
    const refParts = [
      proposalRef && `Proposal: ${proposalRef}`,
      requestRef && `Request: ${requestRef}`,
    ].filter(Boolean);
    const refSuffix = refParts.length ? ` (${refParts.join(", ")})` : "";
    await this.notify(
      event.data.providerId,
      "proposal",
      `Your proposal was not selected for this request${refSuffix}`,
      "proposal_rejected",
    );
  }

  private async handleJobCreated(event: any): Promise<void> {
    const ref = event.data.jobDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    await this.notify(
      event.data.providerId,
      "job",
      `A new job has been assigned to you${refSuffix}`,
      "job_created",
    );
  }

  private async handleJobStarted(event: any): Promise<void> {
    const ref = event.data.jobDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    await this.notify(
      event.data.userId,
      "job",
      `The provider has started working on your job${refSuffix}`,
      "job_started",
    );
  }

  private async handleJobCompleted(event: any): Promise<void> {
    const ref = event.data.jobDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    await this.notify(
      event.data.userId,
      "job",
      `Your job has been completed${refSuffix}`,
      "job_completed",
    );
  }

  private async handleJobCancelled(event: any): Promise<void> {
    const ref = event.data.jobDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    await this.notify(
      event.data.providerId,
      "job",
      `A job assigned to you has been cancelled${refSuffix}`,
      "job_cancelled",
    );
    if (event.data.userId) {
      await this.notify(
        event.data.userId,
        "job",
        `Your job has been cancelled${refSuffix}`,
        "job_cancelled",
      );
    }
  }

  private async handlePaymentCompleted(event: any): Promise<void> {
    // Payment emails are already sent by payment-service directly.
    // EventConsumer is responsible for the in-app notification only.
    const ref = event.data.paymentDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    await this.notify(
      event.data.userId,
      "payment",
      `Payment of ₹${event.data.amount} ${event.data.currency ?? "INR"} completed successfully${refSuffix}`,
      "payment_completed",
    );
  }

  private async handlePaymentFailed(event: any): Promise<void> {
    // Payment emails are already sent by payment-service directly.
    // EventConsumer is responsible for the in-app notification only.
    const ref = event.data.paymentDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    const amount = event.data.amount
      ? `₹${event.data.amount} ${event.data.currency ?? "INR"}`
      : "your payment";
    await this.notify(
      event.data.userId,
      "payment",
      `Payment failed: ${amount} could not be processed${refSuffix}. Please retry or contact support.`,
      "payment_failed",
    );
  }

  private async handleReviewSubmitted(event: any): Promise<void> {
    if (!event.data.providerId) return;
    const ref = event.data.reviewDisplayId || event.data.displayId || "";
    const refSuffix = ref ? ` (Ref: ${ref})` : "";
    await this.notify(
      event.data.providerId,
      "review",
      `A customer has submitted a review for your service${refSuffix}`,
      "review_submitted",
    );
  }

  private async handleDisputeStatusChanged(event: any): Promise<void> {
    if (!event.opened_by) return;
    const disputeId = event.dispute_id;
    const newStatus = event.new_status;
    const resolution = event.resolution;
    const resolutionSuffix = resolution ? ` (${resolution})` : "";
    await this.notify(
      event.opened_by,
      "dispute",
      `Your dispute #${disputeId} has been updated to "${newStatus}"${resolutionSuffix}`,
      "dispute_status_changed",
    );
  }
}
