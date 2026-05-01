import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppContextDto } from "../dto/app-context.dto";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { v4 as uuidv4 } from "uuid";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class EmailClient {
  private readonly httpClient: AxiosInstance;
  private readonly notificationServiceUrl: string;
  private readonly notificationApiKey: string;
  private readonly tenantId: string;
  private readonly emailEnabled: boolean;

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

      const idempotencyKey = uuidv4();
      const appName =
        options.appContext?.applicationName || "LocalServiceMarketplace";
      const appUrl = options.appContext?.appUrl || "";
      const ctaPath = options.appContext?.ctaPath;

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
            "x-app-name": appName,
            "x-app-url": appUrl,
            ...(ctaPath ? { "x-path": ctaPath } : {}),
            "x-idempotency-key": idempotencyKey,
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

      const idempotencyKey = uuidv4();
      const appName = appContext?.applicationName || "LocalServiceMarketplace";
      const appUrl = appContext?.appUrl || "";
      const ctaPath = appContext?.ctaPath;

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
            "x-app-name": appName,
            "x-app-url": appUrl,
            ...(ctaPath ? { "x-path": ctaPath } : {}),
            "x-idempotency-key": idempotencyKey,
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
