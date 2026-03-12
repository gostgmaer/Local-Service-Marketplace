import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './services/payment.service';
import { RefundService } from './services/refund.service';
import { WebhookService } from './services/webhook.service';
import { CouponService } from './services/coupon.service';
import { PaymentRepository } from './repositories/payment.repository';
import { RefundRepository } from './repositories/refund.repository';
import { WebhookRepository } from './repositories/webhook.repository';
import { CouponRepository } from './repositories/coupon.repository';

@Module({
  controllers: [PaymentController],
  providers: [
    PaymentService,
    RefundService,
    WebhookService,
    CouponService,
    PaymentRepository,
    RefundRepository,
    WebhookRepository,
    CouponRepository,
  ],
  exports: [PaymentService, RefundService, WebhookService, CouponService],
})
export class PaymentModule {}
