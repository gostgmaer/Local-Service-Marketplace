import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { RefundRepository } from "../repositories/refund.repository";
import { PaymentRepository } from "../repositories/payment.repository";
import { Refund } from "../entities/refund.entity";
import {
  NotFoundException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";
import { NotificationClient } from "../../common/notification/notification.client";
import { UserClient } from "../../common/user/user.client";
import { CacheInvalidationService } from "../../common/services/cache-invalidation.service";
import { BroadcastService } from "../../common/services/broadcast.service";

@Injectable()
export class RefundService {
  private readonly workersEnabled = process.env.WORKERS_ENABLED === "true";

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    @InjectQueue("payment.refund") private readonly refundQueue: Queue,
    @InjectQueue("payment.notification")
    private readonly notificationQueue: Queue,
    private readonly refundRepository: RefundRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly notificationClient: NotificationClient,
    private readonly userClient: UserClient,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly broadcastService: BroadcastService,
  ) {}

  async createRefund(paymentId: string, amount?: number): Promise<Refund> {
    this.logger.log(
      `Creating refund for payment ${paymentId}`,
      "RefundService",
    );

    // Verify payment exists
    const payment = await this.paymentRepository.getPaymentById(paymentId);
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    // Check payment status
    if (payment.status !== "completed") {
      throw new BadRequestException("Can only refund completed payments");
    }

    // Enforce refund window: reject if paid_at is older than refund_window_days
    if (payment.paid_at) {
      const windowDaysStr = await this.paymentRepository.getSystemSetting(
        "refund_window_days",
        "30",
      );
      const windowDays = parseInt(windowDaysStr, 10) || 30;
      const ageDays =
        (Date.now() - new Date(payment.paid_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (ageDays > windowDays) {
        throw new BadRequestException(
          `Refunds can only be requested within ${windowDays} day${windowDays === 1 ? "" : "s"} of payment. This payment was made ${Math.floor(ageDays)} day${Math.floor(ageDays) === 1 ? "" : "s"} ago.`,
        );
      }
    }

    // Calculate refund amount
    const refundAmount = amount || payment.amount;

    // Validate refund amount
    if (refundAmount > payment.amount) {
      throw new BadRequestException(
        "Refund amount cannot exceed payment amount",
      );
    }

    // Check if payment is already refunded (atomic check + insert via FOR UPDATE lock)
    const refund = await this.refundRepository.createRefundAtomic(
      paymentId,
      refundAmount,
    );

    // Queue refund processing job for background processing
    await this.refundQueue.add("process-refund", {
      refundId: refund.id,
      paymentId,
      amount: refundAmount,
      reason: "Customer requested refund",
    });

    this.logger.log(
      `Refund created and queued for processing: ${refund.id}`,
      "RefundService",
    );

    // Broadcast refund event to customer and admins
    await this.cacheInvalidation.invalidateEntity("payments");
    this.broadcastService.emit("refund", refund.id, "created", [`user:${payment.user_id}`, "admin"], { paymentId, refundId: refund.id }, payment.user_id);

    // NOTE: The refund notification email is intentionally NOT sent here.
    // It is sent by the refund worker AFTER the gateway confirms the refund,
    // to avoid prematurely telling the user their money is on the way.

    return refund;
  }

  async getRefundById(id: string): Promise<Refund> {
    this.logger.log(`Fetching refund ${id}`, "RefundService");
    const refund = await this.refundRepository.getRefundById(id);
    if (!refund) {
      throw new NotFoundException("Refund not found");
    }
    return refund;
  }

  async getRefundsByPaymentId(paymentId: string): Promise<Refund[]> {
    this.logger.log(
      `Fetching refunds for payment ${paymentId}`,
      "RefundService",
    );
    return this.refundRepository.getRefundsByPaymentId(paymentId);
  }
}
