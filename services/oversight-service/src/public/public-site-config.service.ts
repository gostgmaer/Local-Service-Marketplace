import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { SystemSettingRepository } from "../admin/repositories/system-setting.repository";

type SiteConfigPayload = Record<string, string | number | boolean>;

interface SiteConfigCacheEntry {
  fingerprint: string;
  etag: string;
  config: SiteConfigPayload;
}

@Injectable()
export class PublicSiteConfigService {
  private cache: SiteConfigCacheEntry | null = null;
  private lastFingerprintCheckAt = 0;
  private readonly FINGERPRINT_CHECK_INTERVAL_MS = 5000;

  private readonly siteConfigKeys = [
    // Contact & branding
    "support_email",
    "contact_phone",
    "contact_address",
    // Upload limits
    "max_file_upload_size_mb",
    "allowed_file_types",
    // Pricing
    "gst_rate",
    "platform_fee_percentage",
    "default_currency",
    // Pagination
    "default_page_limit",
    // Maintenance
    "maintenance_mode",
    "maintenance_message",
    // Registration & auth
    "registration_enabled",
    "provider_registration_enabled",
    "guest_requests_enabled",
    // Limits & policies
    "max_active_requests_per_customer",
    "max_proposal_count",
    "max_services_per_provider",
    "request_expiry_days",
    "job_auto_complete_days",
    "dispute_window_days",
    "refund_window_days",
    "review_submission_window_days",
    "min_review_length",
    // Legal
    "terms_version",
    "privacy_version",
    // Realtime
    "realtime_enabled",
    // Timezone
    "default_timezone",
    // Feature flags
    "notifications_enabled",
    "in_app_notifications_enabled",
    "push_notifications_enabled",
    "email_notifications_enabled",
    "sms_notifications_enabled",
    "messaging_enabled",
    "whatsapp_enabled",
    "notification_preferences_enabled",
    "device_tracking_enabled",
  ];

  constructor(
    private readonly systemSettingRepository: SystemSettingRepository,
  ) {}

  async getSiteConfig(): Promise<{ config: SiteConfigPayload; etag: string }> {
    const now = Date.now();
    if (
      this.cache &&
      now - this.lastFingerprintCheckAt < this.FINGERPRINT_CHECK_INTERVAL_MS
    ) {
      return { config: this.cache.config, etag: this.cache.etag };
    }

    const fingerprint = await this.systemSettingRepository.getSettingsFingerprint(
      this.siteConfigKeys,
    );
    this.lastFingerprintCheckAt = now;

    if (this.cache && this.cache.fingerprint === fingerprint) {
      return { config: this.cache.config, etag: this.cache.etag };
    }

    const settings = await this.systemSettingRepository.getSettingsByKeys(
      this.siteConfigKeys,
    );
    const values = new Map<string, string>();
    for (const setting of settings) {
      values.set(setting.key, setting.value);
    }

    const config: SiteConfigPayload = {
      // Contact & branding
      supportEmail: this.get(values, "support_email", "support@marketplace.com"),
      contactPhone: this.get(values, "contact_phone", ""),
      contactAddress: this.get(values, "contact_address", ""),
      // Upload limits
      maxFileUploadSizeMb: this.getInt(values, "max_file_upload_size_mb", 10),
      allowedFileTypes: this.get(
        values,
        "allowed_file_types",
        "image/jpeg,image/png,image/webp,application/pdf",
      ),
      // Pricing
      gstRate: this.getFloat(values, "gst_rate", 18),
      platformFeePercentage: this.getFloat(
        values,
        "platform_fee_percentage",
        15,
      ),
      currency: this.get(values, "default_currency", "INR"),
      // Pagination
      defaultPageLimit: this.getInt(values, "default_page_limit", 20),
      // Maintenance
      maintenanceMode: this.get(values, "maintenance_mode", "false") === "true",
      maintenanceMessage: this.get(values, "maintenance_message", ""),
      // Registration & auth
      registrationEnabled:
        this.get(values, "registration_enabled", "true") === "true",
      providerRegistrationEnabled:
        this.get(values, "provider_registration_enabled", "true") === "true",
      guestRequestsEnabled:
        this.get(values, "guest_requests_enabled", "true") === "true",
      // Limits & policies
      maxActiveRequestsPerCustomer: this.getInt(
        values,
        "max_active_requests_per_customer",
        10,
      ),
      maxProposalCount: this.getInt(values, "max_proposal_count", 10),
      maxServicesPerProvider: this.getInt(values, "max_services_per_provider", 10),
      requestExpiryDays: this.getInt(values, "request_expiry_days", 30),
      jobAutoCompleteDays: this.getInt(values, "job_auto_complete_days", 7),
      disputeWindowDays: this.getInt(values, "dispute_window_days", 30),
      refundWindowDays: this.getInt(values, "refund_window_days", 30),
      reviewSubmissionWindowDays: this.getInt(
        values,
        "review_submission_window_days",
        90,
      ),
      minReviewLength: this.getInt(values, "min_review_length", 10),
      // Legal
      termsVersion: this.get(values, "terms_version", "1.0"),
      privacyVersion: this.get(values, "privacy_version", "1.0"),
      // Realtime
      realtimeEnabled: this.get(values, "realtime_enabled", "true") === "true",
      // Timezone
      defaultTimezone: this.get(values, "default_timezone", "Asia/Kolkata"),
      // Feature flags
      notificationsEnabled:
        this.get(values, "notifications_enabled", "false") === "true",
      inAppNotificationsEnabled:
        this.get(values, "in_app_notifications_enabled", "false") === "true",
      pushNotificationsEnabled:
        this.get(values, "push_notifications_enabled", "false") === "true",
      emailNotificationsEnabled:
        this.get(values, "email_notifications_enabled", "true") === "true",
      smsNotificationsEnabled:
        this.get(values, "sms_notifications_enabled", "false") === "true",
      messagingEnabled: this.get(values, "messaging_enabled", "false") === "true",
      whatsappEnabled: this.get(values, "whatsapp_enabled", "false") === "true",
      notificationPreferencesEnabled:
        this.get(values, "notification_preferences_enabled", "false") === "true",
      deviceTrackingEnabled:
        this.get(values, "device_tracking_enabled", "false") === "true",
    };

    const etag = this.computeEtag(config);
    this.cache = { fingerprint, etag, config };
    return { config, etag };
  }

  invalidateSiteConfigCache(): void {
    this.cache = null;
    this.lastFingerprintCheckAt = 0;
  }

  private get(
    values: Map<string, string>,
    key: string,
    fallback: string,
  ): string {
    return values.get(key) ?? fallback;
  }

  private getInt(
    values: Map<string, string>,
    key: string,
    fallback: number,
  ): number {
    const parsed = parseInt(this.get(values, key, String(fallback)), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private getFloat(
    values: Map<string, string>,
    key: string,
    fallback: number,
  ): number {
    const parsed = parseFloat(this.get(values, key, String(fallback)));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private computeEtag(config: SiteConfigPayload): string {
    const hash = crypto
      .createHash("sha1")
      .update(JSON.stringify(config))
      .digest("hex");
    return `"${hash}"`;
  }
}
