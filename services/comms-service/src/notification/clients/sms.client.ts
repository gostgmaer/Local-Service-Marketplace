import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class SmsClient {
  private readonly httpClient: AxiosInstance;
  private readonly notificationServiceUrl: string;
  private readonly notificationApiKey: string;
  private readonly tenantId: string;
  private readonly smsEnabled: boolean;

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
    this.smsEnabled =
      this.configService.get<string>("SMS_ENABLED", "false") === "true";

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
      `SmsClient initialized - URL: ${this.notificationServiceUrl}, Enabled: ${this.smsEnabled}`,
      "SmsClient",
    );
  }

  async sendSms(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.smsEnabled) {
      this.logger.warn(
        "SMS service is disabled. Skipping SMS send.",
        "SmsClient",
      );
      return { success: false, error: "SMS service disabled" };
    }

    try {
      this.logger.log(`Sending SMS to ${phone}`, "SmsClient");

      const response = await this.httpClient.post("/v1/sms/send", {
        to: phone,
        message,
        messageType: "TRANSACTIONAL",
      });

      this.logger.log(`SMS sent successfully to ${phone}`, "SmsClient");
      return { success: true, messageId: response.data?.data?.messageId };
    } catch (error: any) {
      this.logger.error(
        `Failed to send SMS to ${phone}: ${error.message}`,
        error.stack,
        "SmsClient",
      );
      return { success: false, error: error.message };
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.smsEnabled) {
      return false;
    }

    try {
      await this.httpClient.get("/v1/health");
      return true;
    } catch (error: any) {
      this.logger.error(
        `Notification service health check failed: ${error.message}`,
        "SmsClient",
      );
      return false;
    }
  }
}
