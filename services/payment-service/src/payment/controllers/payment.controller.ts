import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  Headers,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlexibleIdPipe } from "@/common/pipes/flexible-id.pipe";
import { StrictUuidPipe } from "@/common/pipes/strict-uuid.pipe";
import { Response } from "express";
import { PaymentService } from "../services/payment.service";
import { RefundService } from "../services/refund.service";
import { InvoiceService } from "../services/invoice.service";
import { CreatePaymentDto } from "../dto/create-payment.dto";
import { RequestRefundDto } from "@/payment/dto/request-refund.dto";
import { TransactionQueryDto } from "../dto/transaction-query.dto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import {
  PermissionsGuard as RolesGuard,
  RequirePermissions,
} from "@/common/rbac";
import { ForbiddenException } from "@/common/exceptions/http.exceptions";
import { FileServiceClient } from "../../common/file-service.client";
import { paymentReceiptUploadOptions } from "../../common/config/upload.config";
import "multer";

@Controller("payments")
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService,
    private readonly invoiceService: InvoiceService,
    private readonly fileServiceClient: FileServiceClient,
  ) {}

  /**
   * Create a payment for a job
   * POST /payments
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions("payments.create")
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: any,
    @Headers("x-payment-gateway") gatewayHeader?: string,
  ) {
    // Gateway override is restricted to admins — non-admins always use the
    // platform-configured default to prevent routing to weaker or cheaper gateways.
    const isAdmin =
      req.user?.role === "admin" ||
      req.user?.permissions?.includes("payments.manage");
    const gatewayOverride = isAdmin ? gatewayHeader?.toLowerCase() : undefined;

    const payment = await this.paymentService.createPayment(
      createPaymentDto.job_id,
      createPaymentDto.amount,
      createPaymentDto.currency,
      req.user.userId, // user_id from authenticated user
      createPaymentDto.provider_id,
      createPaymentDto.coupon_code,
      gatewayOverride,
      createPaymentDto.payment_method,
    );

    return payment;
  }

  /**
   * Admin stats endpoint
   * GET /payments/stats
   */
  @Get("stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions("payments.manage")
  @HttpCode(HttpStatus.OK)
  async getPaymentStats() {
    return this.paymentService.getPaymentStats();
  }

  /**
   * Get payment by ID
   * GET /payments/:id
   */
  @Get("my")
  @UseGuards(JwtAuthGuard)
  async getMyPayments(
    @Request() req: any,
    @Query() queryDto: TransactionQueryDto,
  ) {
    return this.paymentService.getPaymentsByUserPaginated(
      req.user.userId,
      queryDto,
    );
  }

  @Get("jobs/:jobId")
  @UseGuards(JwtAuthGuard)
  async getPaymentsByJob(
    @Param("jobId", FlexibleIdPipe) jobId: string,
    @Request() req: any,
    @Query() queryDto: TransactionQueryDto,
  ) {
    const isAdmin = req.user.permissions?.includes("payments.manage");
    const canRead = req.user.permissions?.includes("payments.read");

    // Allow admins and any authenticated user with payments.read (customers & providers).
    // Job IDs are UUIDs — a user must already know the job ID to call this endpoint,
    // which means they are legitimately involved in the job.
    if (!isAdmin && !canRead) {
      throw new ForbiddenException(
        "You are not authorized to view payments for this job",
      );
    }

    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    return this.paymentService.getPaymentsByJobIdPaginated(
      jobId,
      limit,
      page,
      queryDto.status,
      queryDto.sortBy,
      queryDto.sortOrder,
    );
  }

  @Get("provider/:providerId/summary")
  @UseGuards(JwtAuthGuard)
  async getProviderEarningsSummary(
    @Param("providerId", FlexibleIdPipe) providerId: string,
    @Request() req: any,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    if (
      !req.user.permissions?.includes("payments.manage") &&
      req.user.providerId !== providerId
    ) {
      throw new ForbiddenException(
        "You can only view your own earnings summary",
      );
    }
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const earnings = await this.paymentService.getProviderEarnings(
      providerId,
      start,
      end,
    );
    return earnings;
  }

  @Get("provider/:providerId/transactions")
  @UseGuards(JwtAuthGuard)
  async getProviderTransactions(
    @Param("providerId", FlexibleIdPipe) providerId: string,
    @Request() req: any,
    @Query() queryDto: TransactionQueryDto,
  ) {
    if (
      !req.user.permissions?.includes("payments.manage") &&
      req.user.providerId !== providerId
    ) {
      throw new ForbiddenException(
        "You can only view your own transaction history",
      );
    }
    return this.paymentService.getProviderTransactions(providerId, queryDto);
  }

  @Get("provider/:providerId/payouts")
  @UseGuards(JwtAuthGuard)
  async getProviderPayouts(
    @Param("providerId", FlexibleIdPipe) providerId: string,
    @Request() req: any,
    @Query() queryDto: TransactionQueryDto,
  ) {
    if (
      !req.user.permissions?.includes("payments.manage") &&
      req.user.providerId !== providerId
    ) {
      throw new ForbiddenException("You can only view your own payout history");
    }
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    return this.paymentService.getProviderPayoutsPaginated(
      providerId,
      limit,
      page,
      queryDto.status,
    );
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getPaymentById(
    @Param("id", FlexibleIdPipe) id: string,
    @Request() req: any,
  ) {
    const payment = await this.paymentService.getPaymentById(id);
    const canManage = req.user.permissions?.includes("payments.manage");
    const canRead = req.user.permissions?.includes("payments.read");
    const isCustomer = payment.user_id === req.user.userId;
    if (!canManage && !canRead && !isCustomer) {
      throw new ForbiddenException(
        "You can only view payments you are involved in",
      );
    }
    return payment;
  }

  /**
   * Get current user's payments (customer view)
   * GET /payments/my
   */
  /**
   * Get payment status
   * GET /payments/:id/status
   */
  @Get(":id/status")
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Param("id", FlexibleIdPipe) id: string,
    @Request() req: any,
  ) {
    const payment = await this.paymentService.getPaymentById(id);
    const canManage = req.user.permissions?.includes("payments.manage");
    const canRead = req.user.permissions?.includes("payments.read");
    const isCustomer = payment.user_id === req.user.userId;
    if (!canManage && !canRead && !isCustomer) {
      throw new ForbiddenException(
        "You can only check the status of payments you are involved in",
      );
    }

    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      transaction_id: payment.transaction_id,
      created_at: payment.created_at,
      paid_at: payment.paid_at,
    };
  }

  /**
   * Request a refund
   * POST /payments/:id/refund
   */
  @Post(":id/refund")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async requestRefund(
    @Param("id", StrictUuidPipe) id: string,
    @Body() requestRefundDto: RequestRefundDto,
    @Request() req: any,
  ) {
    const payment = await this.paymentService.getPaymentById(id);
    if (
      !req.user.permissions?.includes("payments.manage") &&
      payment.user_id !== req.user.userId
    ) {
      throw new ForbiddenException(
        "Only the customer who made this payment can request a refund",
      );
    }
    const refund = await this.refundService.createRefund(
      id,
      requestRefundDto.amount,
    );

    return refund;
  }

  /**
   * Retry a failed payment
   * POST /payments/:id/retry
   */
  @Post(":id/retry")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async retryPayment(
    @Param("id", StrictUuidPipe) id: string,
    @Request() req: any,
  ) {
    return this.paymentService.retryPayment(id, req.user.userId);
  }

  /**
   * Get provider earnings summary
   * GET /payments/provider/:providerId/summary
   */

  /**
   * Get invoice data (JSON)
   * GET /payments/:id/invoice
   */
  @Get(":id/invoice")
  @UseGuards(JwtAuthGuard)
  async getInvoice(
    @Param("id", FlexibleIdPipe) id: string,
    @Request() req: any,
  ) {
    const payment = await this.paymentService.getPaymentById(id);
    const canManage = req.user.permissions?.includes("payments.manage");
    const canRead = req.user.permissions?.includes("payments.read");
    const isCustomer = payment.user_id === req.user.userId;
    if (!canManage && !canRead && !isCustomer) {
      throw new ForbiddenException(
        "You can only view invoices for payments you are involved in",
      );
    }
    const invoice = await this.invoiceService.generateInvoice(
      id,
      req.user.userId,
    );
    return {
      success: true,
      message: "Invoice retrieved successfully",
      data: {
        ...invoice,
        invoice_url: payment.invoice_url ?? null,
      },
    };
  }

  /**
   * Download invoice as HTML (printable)
   * GET /payments/:id/invoice/download
   */
  @Get(":id/invoice/download")
  @UseGuards(JwtAuthGuard)
  async downloadInvoice(
    @Param("id", FlexibleIdPipe) id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const payment = await this.paymentService.getPaymentById(id);
    const canManage = req.user.permissions?.includes("payments.manage");
    const canRead = req.user.permissions?.includes("payments.read");
    const isCustomer = payment.user_id === req.user.userId;
    if (!canManage && !canRead && !isCustomer) {
      throw new ForbiddenException(
        "You can only download invoices for payments you are involved in",
      );
    }

    // If a stored invoice URL already exists, redirect to it
    if (payment.invoice_url) {
      return res.redirect(302, payment.invoice_url);
    }

    // Otherwise generate fresh, upload, store URL, and serve inline
    const storedUrl = await this.invoiceService.generateAndUploadInvoice(
      id,
      req.user.userId,
    );
    if (storedUrl) {
      return res.redirect(302, storedUrl);
    }

    // Fallback: serve HTML directly if file service is unavailable
    const invoice = await this.invoiceService.generateInvoice(
      id,
      req.user.userId,
    );
    const html = this.invoiceService.generateInvoiceHtml(invoice);
    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-${invoice.invoice_number}.html"`,
    );
    res.send(html);
  }

  /**
   * Upload payment receipt document
   * POST /payments/:id/receipt
   */
  @Post(":id/receipt")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("files", paymentReceiptUploadOptions))
  async uploadReceipt(
    @Param("id", StrictUuidPipe) paymentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      paymentId: string;
      uploadedFile: any;
    };
  }> {
    if (!file) {
      throw new BadRequestException("Receipt file is required");
    }

    // Verify payment exists and user is authorized
    const payment = await this.paymentService.getPaymentById(paymentId);
    const isCustomer = payment.user_id === req.user.userId;
    const isProvider = payment.provider_id === req.user.userId;
    const isAdmin = req.user.permissions?.includes("payments.manage");

    if (!isCustomer && !isProvider && !isAdmin) {
      throw new ForbiddenException(
        "You can only upload receipts for payments you are involved in",
      );
    }

    // Upload file to external file service
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const uploadedFile = await this.fileServiceClient.uploadFile(
      file,
      {
        category: "payment-receipt",
        linkedEntityId: paymentId,
        linkedEntityType: "payment",
      },
      req.user.userId,
      req.user.role,
      tenantId,
    );

    return {
      success: true,
      message: "Receipt uploaded successfully",
      data: {
        paymentId,
        uploadedFile,
      },
    };
  }
}
