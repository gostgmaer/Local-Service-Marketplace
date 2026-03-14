import { Controller, Post, Get, Body, Param, Query, Inject, LoggerService, Headers } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PaymentService } from './services/payment.service';
import { RefundService } from './services/refund.service';
import { WebhookService } from './services/webhook.service';
import { CouponService } from './services/coupon.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Controller('payments')
export class PaymentController {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService,
    private readonly webhookService: WebhookService,
    private readonly couponService: CouponService,
  ) {}

  @Post()
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Headers('x-user-id') userId: string,
  ) {
    this.logger.log('POST /payments - Create payment', 'PaymentController');
    const payment = await this.paymentService.createPayment(
      createPaymentDto.job_id,
      createPaymentDto.amount,
      createPaymentDto.currency,
      userId,
      createPaymentDto.provider_id,
      createPaymentDto.coupon_code,
    );
    return { payment };
  }

  @Get('my')
  async getMyPayments(@Query('user_id') userId: string) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    this.logger.log(`GET /payments/my - Get payments for user ${userId}`, 'PaymentController');
    const payments = await this.paymentService.getPaymentsByUser(userId);
    return payments;
  }

  @Get(':id')
  async getPayment(@Param('id') id: string) {
    this.logger.log(`GET /payments/${id} - Get payment`, 'PaymentController');
    const payment = await this.paymentService.getPaymentById(id);
    return payment;
  }

  @Get('job/:jobId')
  async getPaymentsByJobId(@Param('jobId') jobId: string) {
    this.logger.log(`GET /payments/job/${jobId} - Get payments by job`, 'PaymentController');
    const payments = await this.paymentService.getPaymentsByJobId(jobId);
    return payments;
  }

  @Post(':id/refund')
  async refundPayment(
    @Param('id') paymentId: string,
    @Body() refundPaymentDto: RefundPaymentDto,
  ) {
    this.logger.log(`POST /payments/${paymentId}/refund - Refund payment`, 'PaymentController');
    const refund = await this.refundService.createRefund(paymentId, refundPaymentDto.amount);
    return refund;
  }

  @Get(':id/refunds')
  async getRefundsByPaymentId(@Param('id') paymentId: string) {
    this.logger.log(`GET /payments/${paymentId}/refunds - Get refunds`, 'PaymentController');
    const refunds = await this.refundService.getRefundsByPaymentId(paymentId);
    return refunds;
  }

  @Post('webhook')
  async handleWebhook(@Body() webhookPayloadDto: WebhookPayloadDto) {
    this.logger.log('POST /payments/webhook - Handle webhook', 'PaymentController');
    const webhook = await this.webhookService.handleWebhook(
      webhookPayloadDto.gateway,
      webhookPayloadDto.payload,
    );
    return webhook;
  }

  @Get('webhooks/unprocessed')
  async getUnprocessedWebhooks() {
    this.logger.log('GET /payments/webhooks/unprocessed - Get unprocessed webhooks', 'PaymentController');
    const webhooks = await this.webhookService.getUnprocessedWebhooks();
    return webhooks;
  }

  @Post('coupons/validate')
  async validateCoupon(@Body() validateCouponDto: ValidateCouponDto) {
    this.logger.log('POST /payments/coupons/validate - Validate coupon', 'PaymentController');
    const coupon = await this.couponService.validateCoupon(validateCouponDto.couponCode);
    return { coupon };
  }
}
