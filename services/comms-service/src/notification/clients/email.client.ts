import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppContextDto } from "../dto/app-context.dto";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { v4 as uuidv4 } from "uuid";
import axios, { AxiosInstance } from "axios";

const TEMPLATE_PATH_DEFAULTS: Record<string, string> = {
  AUTO_RENEWAL_REMINDER: "/billing/subscriptions",
  BILLING_INFO_UPDATED: "/billing",
  CONTACT_CONFIRMATION: "/contact",
  EMAIL_VERIFIED: "/verify-email",
  MAGIC_LINK: "/auth/magic-link",
  MARKETPLACE_EMAIL_VERIFICATION: "/verify-email",
  MARKETPLACE_JOB_ASSIGNED: "/dashboard/jobs",
  MARKETPLACE_NEW_REQUEST: "/dashboard/requests",
  MARKETPLACE_PASSWORD_RESET: "/reset-password",
  MARKETPLACE_PAYMENT_RECEIVED: "/dashboard/payments",
  MARKETPLACE_PROPOSAL_RECEIVED: "/dashboard/proposals",
  MARKETPLACE_PROVIDER_APPROVED: "/dashboard/provider",
  MARKETPLACE_PROVIDER_REJECTED: "/dashboard/provider",
  MARKETPLACE_WELCOME: "/dashboard",
  MESSAGE_RECEIVED: "/dashboard/messages",
  NOTIFICATION_DIGEST: "/dashboard/notifications",
  ORDER_CANCELLED: "/dashboard/orders",
  ORDER_DELIVERED: "/dashboard/orders",
  otpEmailTemplate: "/auth/otp",
  PASSWORD_CHANGED: "/settings/security",
  PAYMENT_FAILED: "/dashboard/payments",
  PAYMENT_REFUNDED: "/dashboard/payments",
  PAYMENT_SUCCESS: "/dashboard/payments",
  REVIEW_REMINDER: "/dashboard/reviews",
  SUBSCRIPTION_CANCELLED: "/billing/subscriptions",
  SUBSCRIPTION_RENEWED: "/billing/subscriptions",
  SUBSCRIPTION_STARTED: "/billing/subscriptions",
  USER_BANNED: "/account/status",
  USER_DELETED: "/account",
  USER_REINSTATED: "/account/status",
  USER_SUSPENDED: "/account/status",
  USER_WELCOME: "/dashboard",
};

@Injectable()
export class EmailClient {
  private readonly httpClient: AxiosInstance;
  private readonly notificationServiceUrl: string;
  private readonly notificationApiKey: string;
  private readonly tenantId: string;
  private readonly emailEnabled: boolean;
  private readonly defaultAppName: string;
  private readonly defaultAppUrl: string;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this.notificationServiceUrl = this.configService.get<string>(
      "NOTIFICATION_SERVICE_URL",
      "http://notification-service:4000",
    );
    this.notificationApiKey = this.configService.get<string>(
      "NOTIFICATION_API_KEY",
      "",
    );
    this.tenantId = this.configService.get<string>(
      "DEFAULT_TENANT_ID",
      "default",
    );
    this.emailEnabled =
      this.configService.get<string>("EMAIL_ENABLED", "true") === "true";
    this.defaultAppName = this.configService.get<string>(
      "APPLICATION_NAME",
      "LocalServiceMarketplace",
    );
    this.defaultAppUrl =
      this.configService.get<string>("APP_URL") ||
      this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");

    this.httpClient = axios.create({
      baseURL: this.notificationServiceUrl,
      timeout: this.configService.get<number>("REQUEST_TIMEOUT_MS", 72000),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.notificationApiKey,
        "x-tenant-id": this.tenantId,
      },
    });

    this.logger.log(
      `EmailClient initialized - URL: ${this.notificationServiceUrl}, Enabled: ${this.emailEnabled}`,
      "EmailClient",
    );
  }

  private normalizePath(input?: string | null): string {
    const value = (input || "").trim();

    if (!value) {
      return "/";
    }

    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        const path = `${url.pathname || "/"}${url.search || ""}`;
        return path.startsWith("/") ? path : `/${path}`;
      } catch {
        // Fall through to plain string normalization.
      }
    }

    return value.startsWith("/") ? value : `/${value}`;
  }

  private resolveTemplatePath(
    template?: string,
    variables?: Record<string, any>,
  ): string {
    const linkKeys = [
      "verificationLink",
      "verifyLink",
      "resetLink",
      "magicLink",
      "dashboardUrl",
      "replyUrl",
      "actionUrl",
      "ctaUrl",
    ];

    for (const key of linkKeys) {
      const link = variables?.[key];
      if (typeof link === "string" && link.trim().length > 0) {
        return this.normalizePath(link);
      }
    }

    if (template && TEMPLATE_PATH_DEFAULTS[template]) {
      return TEMPLATE_PATH_DEFAULTS[template];
    }

    return "/notifications";
  }

  private buildEmailDispatchHeaders(
    appContext?: AppContextDto,
    template?: string,
    variables?: Record<string, any>,
  ): Record<string, string> {
    const idempotencyKey = uuidv4();
    const appName =
      (appContext?.applicationName || this.defaultAppName).trim() ||
      "LocalServiceMarketplace";
    const appUrl =
      (appContext?.appUrl || this.defaultAppUrl).trim() ||
      "http://localhost:3000";
    const ctaPath = this.normalizePath(
      appContext?.ctaPath || this.resolveTemplatePath(template, variables),
    );

    return {
      "x-app-name": appName,
      "x-app-url": appUrl,
      "x-path": ctaPath,
      "x-idempotency-key": idempotencyKey,
    };
  }

  async sendEmail(options: {
    to: string;
    subject?: string;
    text?: string;
    html?: string;
    template?: string;
    variables?: Record<string, any>;
    appContext?: AppContextDto;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.emailEnabled) {
      this.logger.warn(
        "Email service is disabled. Skipping email send.",
        "EmailClient",
      );
      return { success: false, error: "Email service disabled" };
    }

    try {
      this.logger.log(`Sending email to ${options.to}`, "EmailClient");
      const dispatchHeaders = this.buildEmailDispatchHeaders(
        options.appContext,
        options.template,
        options.variables,
      );

      const response = await this.httpClient.post(
        "/v1/email/send",
        {
          to: options.to,
          subject: options.subject,
          template: options.template,
          data: {
            ...options.variables,
            timestamp: new Date().toISOString(),
          },
        },
        {
          headers: {
            ...dispatchHeaders,
          },
        },
      );

      this.logger.log(
        `Email sent successfully to ${options.to}`,
        "EmailClient",
      );
      return { success: true, messageId: response.data?.messageId };
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
        error.stack,
        "EmailClient",
      );
      return { success: false, error: error.message };
    }
  }

  async sendTemplateEmail(
    to: string,
    template: string,
    variables: Record<string, any>,
    appContext?: AppContextDto,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.emailEnabled) {
      this.logger.warn(
        "Email service is disabled. Skipping template email send.",
        "EmailClient",
      );
      return { success: false, error: "Email service disabled" };
    }

    try {
      this.logger.log(
        `Sending template email (${template}) to ${to}`,
        "EmailClient",
      );
      const dispatchHeaders = this.buildEmailDispatchHeaders(
        appContext,
        template,
        variables,
      );

      const response = await this.httpClient.post(
        "/v1/email/send",
        {
          to,
          template,
          data: {
            ...variables,
            timestamp: new Date().toISOString(),
          },
        },
        {
          headers: {
            ...dispatchHeaders,
          },
        },
      );

      this.logger.log(
        `Template email sent successfully to ${to}`,
        "EmailClient",
      );
      return { success: true, messageId: response.data?.messageId };
    } catch (error: any) {
      this.logger.error(
        `Failed to send template email to ${to}: ${error.message}`,
        error.stack,
        "EmailClient",
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if notification service is available (email channel)
   */
  async healthCheck(): Promise<boolean> {
    if (!this.emailEnabled) {
      return false;
    }

    try {
      await this.httpClient.get("/v1/health");
      return true;
    } catch (error: any) {
      this.logger.error(
        `Notification service health check failed: ${error.message}`,
        "EmailClient",
      );
      return false;
    }
  }
}
