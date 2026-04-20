import {
  Injectable,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { NotificationRepository } from "../repositories/notification.repository";

interface FeatureFlags {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  notificationPreferencesEnabled: boolean;
  deviceTrackingEnabled: boolean;
}

/**
 * Reads feature flags from the shared system_settings table via
 * NotificationRepository.getSystemSetting() — the same helper used throughout
 * comms-service. An in-memory cache is refreshed every 60 s so callers stay synchronous.
 */
@Injectable()
export class FeatureFlagService implements OnModuleInit, OnModuleDestroy {
  private flags: FeatureFlags = {
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
    inAppNotificationsEnabled: false,
    pushNotificationsEnabled: false,
    notificationPreferencesEnabled: false,
    deviceTrackingEnabled: false,
  };

  private timer: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 60_000;

  get emailEnabled() {
    return this.flags.emailEnabled;
  }
  get smsEnabled() {
    return this.flags.smsEnabled;
  }
  get whatsappEnabled() {
    return this.flags.whatsappEnabled;
  }
  get inAppNotificationsEnabled() {
    return this.flags.inAppNotificationsEnabled;
  }
  get pushNotificationsEnabled() {
    return this.flags.pushNotificationsEnabled;
  }
  get notificationPreferencesEnabled() {
    return this.flags.notificationPreferencesEnabled;
  }
  get deviceTrackingEnabled() {
    return this.flags.deviceTrackingEnabled;
  }

  constructor(private readonly notificationRepo: NotificationRepository) {}

  async onModuleInit() {
    await this.refresh();
    this.timer = setInterval(() => this.refresh(), this.REFRESH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async refresh(): Promise<void> {
    try {
      const get = (key: string, def: string) =>
        this.notificationRepo.getSystemSetting(key, def);

      const [email, sms, whatsapp, inApp, push, prefs, device] =
        await Promise.all([
          get("email_notifications_enabled", "true"),
          get("sms_notifications_enabled", "false"),
          get("whatsapp_enabled", "false"),
          get("in_app_notifications_enabled", "false"),
          get("push_notifications_enabled", "false"),
          get("notification_preferences_enabled", "false"),
          get("device_tracking_enabled", "false"),
        ]);

      this.flags = {
        emailEnabled: email === "true",
        smsEnabled: sms === "true",
        whatsappEnabled: whatsapp === "true",
        inAppNotificationsEnabled: inApp === "true",
        pushNotificationsEnabled: push === "true",
        notificationPreferencesEnabled: prefs === "true",
        deviceTrackingEnabled: device === "true",
      };
    } catch {
      // Fail-open: keep last known values if DB is temporarily unreachable
    }
  }

  isFeatureEnabled(feature: string): boolean {
    switch (feature) {
      case "email":
        return this.flags.emailEnabled;
      case "sms":
        return this.flags.smsEnabled;
      case "whatsapp":
        return this.flags.whatsappEnabled;
      case "in_app":
        return this.flags.inAppNotificationsEnabled;
      case "push":
        return this.flags.pushNotificationsEnabled;
      case "preferences":
        return this.flags.notificationPreferencesEnabled;
      case "device_tracking":
        return this.flags.deviceTrackingEnabled;
      default:
        return false;
    }
  }

  getEnabledChannels(): string[] {
    const channels: string[] = [];
    if (this.flags.emailEnabled) channels.push("email");
    if (this.flags.smsEnabled) channels.push("sms");
    if (this.flags.whatsappEnabled) channels.push("whatsapp");
    if (this.flags.pushNotificationsEnabled) channels.push("push");
    if (this.flags.inAppNotificationsEnabled) channels.push("in_app");
    return channels;
  }

  checkFeatureOrThrow(feature: string, featureName: string): void {
    if (!this.isFeatureEnabled(feature)) {
      throw new BadRequestException(
        `${featureName} is disabled. Enable it from the admin settings panel.`,
      );
    }
  }
}
