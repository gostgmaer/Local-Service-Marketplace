import {
  Injectable,
  Inject,
  LoggerService,
  OnModuleInit,
} from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { KafkaService } from "../../kafka/kafka.service";
import { RefundService } from "./refund.service";
import { PaymentRepository } from "../repositories/payment.repository";

@Injectable()
export class DisputeEventConsumerService implements OnModuleInit {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly kafkaService: KafkaService,
    private readonly refundService: RefundService,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async onModuleInit() {
    if (this.kafkaService.isKafkaEnabled()) {
      this.logger.log(
        "Starting dispute event consumer for auto-refund pipeline",
        "DisputeEventConsumerService",
      );
      await this.kafkaService.startConsuming(this.handleEvent.bind(this));
    }
  }

  private async handleEvent(event: any): Promise<void> {
    // Oversight uses `event` field; normalize to support both
    const eventType = event.event || event.eventType;

    if (eventType !== "dispute_status_changed") {
      return;
    }

    await this.handleDisputeStatusChanged(event);
  }

  private async handleDisputeStatusChanged(event: any): Promise<void> {
    const { dispute_id, job_id, new_status, resolution } = event;

    // Only auto-refund when dispute is resolved in customer's favor
    if (new_status !== "resolved" || resolution !== "refunded") {
      this.logger.log(
        `Dispute ${dispute_id} status changed to ${new_status} (resolution: ${resolution}) — no auto-refund`,
        "DisputeEventConsumerService",
      );
      return;
    }

    this.logger.log(
      `Dispute ${dispute_id} resolved with refund — initiating auto-refund for job ${job_id}`,
      "DisputeEventConsumerService",
    );

    try {
      const payments = await this.paymentRepository.getPaymentsByJobId(job_id);
      const completedPayment = payments.find(
        (p: any) => p.status === "completed",
      );

      if (!completedPayment) {
        this.logger.warn(
          `No completed payment found for job ${job_id} — cannot auto-refund`,
          "DisputeEventConsumerService",
        );
        return;
      }

      await this.refundService.createRefund(completedPayment.id);

      this.logger.log(
        `Auto-refund initiated for payment ${completedPayment.id} (dispute ${dispute_id})`,
        "DisputeEventConsumerService",
      );
    } catch (error: any) {
      this.logger.error(
        `Auto-refund failed for dispute ${dispute_id}: ${error.message}`,
        error.stack,
        "DisputeEventConsumerService",
      );
    }
  }
}
