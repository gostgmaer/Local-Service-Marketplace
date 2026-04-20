import { Controller, Get } from "@nestjs/common";
import { SystemSettingService } from "../admin/services/system-setting.service";

/**
 * Public (unauthenticated) endpoints exposed by the oversight-service.
 * Used by api-gateway and other internal services that cannot pass admin JWT.
 */
@Controller("public")
export class PublicController {
  constructor(private readonly systemSettingService: SystemSettingService) {}

  /**
   * Returns the current maintenance mode status.
   * Called by the api-gateway middleware with a 60-second TTL cache.
   * No authentication required.
   */
  @Get("maintenance-status")
  async getMaintenanceStatus() {
    const [modeResult, msgResult] = await Promise.allSettled([
      this.systemSettingService.getSettingByKey("maintenance_mode"),
      this.systemSettingService.getSettingByKey("maintenance_message"),
    ]);

    const maintenanceMode =
      modeResult.status === "fulfilled" && modeResult.value?.value === "true";
    const maintenanceMessage =
      msgResult.status === "fulfilled" ? (msgResult.value?.value ?? "") : "";

    return {
      maintenance_mode: maintenanceMode,
      maintenance_message: maintenanceMessage,
    };
  }

  /**
   * Returns rate-limit configuration values for the api-gateway.
   * Called by the gateway RateLimitConfigService with a 60-second TTL cache.
   * No authentication required.
   */
  @Get("rate-limit-config")
  async getRateLimitConfig() {
    const keys = [
      "rate_limit_max_requests",
      "auth_rate_limit_max_requests",
      "rate_limit_window_ms",
    ];
    const results = await Promise.allSettled(
      keys.map((k) => this.systemSettingService.getSettingByKey(k)),
    );

    const getValue = (i: number, fallback: string) =>
      results[i].status === "fulfilled"
        ? ((results[i] as PromiseFulfilledResult<any>).value?.value ?? fallback)
        : fallback;

    return {
      rate_limit_max_requests: parseInt(getValue(0, "500"), 10) || 500,
      auth_rate_limit_max_requests: parseInt(getValue(1, "10"), 10) || 10,
      rate_limit_window_ms: parseInt(getValue(2, "60000"), 10) || 60000,
    };
  }

  /**
   * Returns publicly-needed site-wide configuration values in one call.
   * Used by the Next.js frontend (server-side fetch + client hook) so that
   * contact info, upload limits, GST rate, platform fee, etc. are always
   * driven from the database rather than hardcoded in the UI.
   * No authentication required.
   */
  @Get("site-config")
  async getSiteConfig() {
    const keys = [
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
    ];

    const results = await Promise.allSettled(
      keys.map((k) => this.systemSettingService.getSettingByKey(k)),
    );

    const get = (i: number, fallback: string) =>
      results[i].status === "fulfilled"
        ? ((results[i] as PromiseFulfilledResult<any>).value?.value ?? fallback)
        : fallback;

    let idx = 0;
    return {
      // Contact & branding
      supportEmail: get(idx++, "support@marketplace.com"),
      contactPhone: get(idx++, ""),
      contactAddress: get(idx++, ""),
      // Upload limits
      maxFileUploadSizeMb: parseInt(get(idx++, "10"), 10) || 10,
      allowedFileTypes: get(idx++, "image/jpeg,image/png,image/webp,application/pdf"),
      // Pricing
      gstRate: parseFloat(get(idx++, "18")) || 18,
      platformFeePercentage: parseFloat(get(idx++, "15")) || 15,
      currency: get(idx++, "INR"),
      // Pagination
      defaultPageLimit: parseInt(get(idx++, "20"), 10) || 20,
      // Maintenance
      maintenanceMode: get(idx++, "false") === "true",
      maintenanceMessage: get(idx++, ""),
      // Registration & auth
      registrationEnabled: get(idx++, "true") === "true",
      providerRegistrationEnabled: get(idx++, "true") === "true",
      guestRequestsEnabled: get(idx++, "true") === "true",
      // Limits & policies
      maxActiveRequestsPerCustomer: parseInt(get(idx++, "10"), 10) || 10,
      maxProposalCount: parseInt(get(idx++, "10"), 10) || 10,
      maxServicesPerProvider: parseInt(get(idx++, "10"), 10) || 10,
      requestExpiryDays: parseInt(get(idx++, "30"), 10) || 30,
      jobAutoCompleteDays: parseInt(get(idx++, "7"), 10) || 7,
      disputeWindowDays: parseInt(get(idx++, "30"), 10) || 30,
      refundWindowDays: parseInt(get(idx++, "30"), 10) || 30,
      reviewSubmissionWindowDays: parseInt(get(idx++, "90"), 10) || 90,
      minReviewLength: parseInt(get(idx++, "10"), 10) || 10,
      // Legal
      termsVersion: get(idx++, "1.0"),
      privacyVersion: get(idx++, "1.0"),
      // Realtime
      realtimeEnabled: get(idx++, "true") === "true",
      // Timezone
      defaultTimezone: get(idx++, "Asia/Kolkata"),
    };
  }
}
