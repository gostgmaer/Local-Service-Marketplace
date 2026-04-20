import { BadRequestException } from "@nestjs/common";
import { FeatureFlagService } from "./feature-flag.service";
import { NotificationRepository } from "../repositories/notification.repository";

/** Build a mock NotificationRepository where getSystemSetting returns the provided map. */
function makeRepo(
  overrides: Record<string, string> = {},
): jest.Mocked<Pick<NotificationRepository, "getSystemSetting">> {
  const defaults: Record<string, string> = {
    email_notifications_enabled: "true",
    sms_notifications_enabled: "false",
    whatsapp_enabled: "false",
    in_app_notifications_enabled: "false",
    push_notifications_enabled: "false",
    notification_preferences_enabled: "false",
    device_tracking_enabled: "false",
    ...overrides,
  };

  return {
    getSystemSetting: jest.fn(async (key: string, def: string) =>
      defaults[key] ?? def,
    ),
  };
}

async function createService(
  overrides: Record<string, string> = {},
): Promise<FeatureFlagService> {
  const repo = makeRepo(overrides) as unknown as NotificationRepository;
  const svc = new FeatureFlagService(repo);
  await svc.onModuleInit();
  return svc;
}

describe("FeatureFlagService", () => {
  afterEach(() => jest.clearAllMocks());

  describe("defaults (all flags at DB defaults)", () => {
    it("should enable email and disable all others by default", async () => {
      const svc = await createService();
      expect(svc.emailEnabled).toBe(true);
      expect(svc.smsEnabled).toBe(false);
      expect(svc.whatsappEnabled).toBe(false);
      expect(svc.inAppNotificationsEnabled).toBe(false);
      expect(svc.pushNotificationsEnabled).toBe(false);
      expect(svc.notificationPreferencesEnabled).toBe(false);
      expect(svc.deviceTrackingEnabled).toBe(false);
    });
  });

  describe("DB-controlled overrides", () => {
    it("should disable email when DB returns false", async () => {
      const svc = await createService({ email_notifications_enabled: "false" });
      expect(svc.emailEnabled).toBe(false);
    });

    it("should enable SMS when DB returns true", async () => {
      const svc = await createService({ sms_notifications_enabled: "true" });
      expect(svc.smsEnabled).toBe(true);
    });

    it("should enable whatsapp when DB returns true", async () => {
      const svc = await createService({ whatsapp_enabled: "true" });
      expect(svc.whatsappEnabled).toBe(true);
    });

    it("should enable all flags when DB returns true for all", async () => {
      const svc = await createService({
        email_notifications_enabled: "true",
        sms_notifications_enabled: "true",
        whatsapp_enabled: "true",
        in_app_notifications_enabled: "true",
        push_notifications_enabled: "true",
        notification_preferences_enabled: "true",
        device_tracking_enabled: "true",
      });
      expect(svc.emailEnabled).toBe(true);
      expect(svc.smsEnabled).toBe(true);
      expect(svc.whatsappEnabled).toBe(true);
      expect(svc.inAppNotificationsEnabled).toBe(true);
      expect(svc.pushNotificationsEnabled).toBe(true);
      expect(svc.notificationPreferencesEnabled).toBe(true);
      expect(svc.deviceTrackingEnabled).toBe(true);
    });
  });

  describe("isFeatureEnabled", () => {
    it("should return true for email (enabled by default)", async () => {
      const svc = await createService();
      expect(svc.isFeatureEnabled("email")).toBe(true);
    });

    it("should return false for disabled features", async () => {
      const svc = await createService();
      expect(svc.isFeatureEnabled("sms")).toBe(false);
      expect(svc.isFeatureEnabled("whatsapp")).toBe(false);
      expect(svc.isFeatureEnabled("push")).toBe(false);
      expect(svc.isFeatureEnabled("in_app")).toBe(false);
      expect(svc.isFeatureEnabled("preferences")).toBe(false);
      expect(svc.isFeatureEnabled("device_tracking")).toBe(false);
    });

    it("should return false for unknown feature keys", async () => {
      const svc = await createService();
      expect(svc.isFeatureEnabled("unknown_feature")).toBe(false);
    });

    it("should return true for sms when enabled", async () => {
      const svc = await createService({ sms_notifications_enabled: "true" });
      expect(svc.isFeatureEnabled("sms")).toBe(true);
    });
  });

  describe("getEnabledChannels", () => {
    it("should return only email by default", async () => {
      const svc = await createService();
      expect(svc.getEnabledChannels()).toEqual(["email"]);
    });

    it("should list all enabled channels", async () => {
      const svc = await createService({
        sms_notifications_enabled: "true",
        whatsapp_enabled: "true",
        push_notifications_enabled: "true",
        in_app_notifications_enabled: "true",
      });
      const channels = svc.getEnabledChannels();
      expect(channels).toContain("email");
      expect(channels).toContain("sms");
      expect(channels).toContain("whatsapp");
      expect(channels).toContain("push");
      expect(channels).toContain("in_app");
    });

    it("should not include disabled channels", async () => {
      const svc = await createService();
      const channels = svc.getEnabledChannels();
      expect(channels).not.toContain("sms");
      expect(channels).not.toContain("push");
    });
  });

  describe("checkFeatureOrThrow", () => {
    it("should not throw when feature is enabled", async () => {
      const svc = await createService();
      expect(() => svc.checkFeatureOrThrow("email", "Email")).not.toThrow();
    });

    it("should throw BadRequestException when feature is disabled", async () => {
      const svc = await createService();
      expect(() => svc.checkFeatureOrThrow("sms", "SMS")).toThrow(
        BadRequestException,
      );
    });

    it("should include feature name in error message", async () => {
      const svc = await createService();
      expect(() =>
        svc.checkFeatureOrThrow("push", "Push notifications"),
      ).toThrow(/Push notifications is disabled/);
    });
  });

  describe("fail-open on DB error", () => {
    it("should retain last-known flags if refresh throws", async () => {
      // First init succeeds with email=true
      const svc = await createService();
      expect(svc.emailEnabled).toBe(true);

      // Simulate DB going down — calling refresh() again should not crash
      const repo = (svc as any).notificationRepo as jest.Mocked<NotificationRepository>;
      repo.getSystemSetting.mockRejectedValueOnce(new Error("DB down"));
      await expect((svc as any).refresh()).resolves.toBeUndefined();

      // Flags should still be the last-known values
      expect(svc.emailEnabled).toBe(true);
    });
  });

  describe("onModuleDestroy", () => {
    it("should clear the refresh timer", async () => {
      const svc = await createService();
      expect(() => svc.onModuleDestroy()).not.toThrow();
    });
  });
});
