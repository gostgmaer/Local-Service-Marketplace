import { Controller, Get, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { SystemSettingService } from "../admin/services/system-setting.service";
import { PublicSiteConfigService } from "./public-site-config.service";

/**
 * Public (unauthenticated) endpoints exposed by the oversight-service.
 * Used by api-gateway and other internal services that cannot pass admin JWT.
 */
@Controller("public")
export class PublicController {
  constructor(
    private readonly systemSettingService: SystemSettingService,
    private readonly publicSiteConfigService: PublicSiteConfigService,
  ) {}

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
  async getSiteConfig(@Req() req: Request, @Res() res: Response) {
    const { config, etag } = await this.publicSiteConfigService.getSiteConfig();

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");

    if (this.ifNoneMatchContains(req.headers["if-none-match"], etag)) {
      return res.status(304).end();
    }

    return res.status(200).json(config);
  }

  private ifNoneMatchContains(
    headerValue: string | string[] | undefined,
    etag: string,
  ): boolean {
    if (!headerValue) return false;

    const values = Array.isArray(headerValue)
      ? headerValue
      : headerValue.split(",").map((v) => v.trim());

    return values.includes(etag) || values.includes("*");
  }
}
