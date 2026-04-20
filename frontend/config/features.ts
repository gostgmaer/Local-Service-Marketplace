/**
 * Feature Flag helpers
 *
 * All flag values come from the admin system_settings table via
 * /public/site-config. They are part of SiteConfig and accessed through
 * `usePublicSettings()` — a single React Query call shared across the whole
 * app, cached in localStorage for instant loads and refreshed every 60 s.
 *
 * Use the hooks below in client components.
 */

import { usePublicSettings } from "@/hooks/usePublicSettings";
import type { SiteConfig } from "@/services/public-settings-service";

/** The feature-flag slice of SiteConfig for components that need only flags. */
export type FeatureFlags = Pick<
  SiteConfig,
  | "notificationsEnabled"
  | "inAppNotificationsEnabled"
  | "pushNotificationsEnabled"
  | "emailNotificationsEnabled"
  | "smsNotificationsEnabled"
  | "messagingEnabled"
  | "whatsappEnabled"
  | "notificationPreferencesEnabled"
  | "deviceTrackingEnabled"
>;

/** Returns all feature flags from the shared site config. */
export function useFeatureFlags(): FeatureFlags {
  const { config } = usePublicSettings();
  return {
    notificationsEnabled:           config.notificationsEnabled,
    inAppNotificationsEnabled:      config.inAppNotificationsEnabled,
    pushNotificationsEnabled:       config.pushNotificationsEnabled,
    emailNotificationsEnabled:      config.emailNotificationsEnabled,
    smsNotificationsEnabled:        config.smsNotificationsEnabled,
    messagingEnabled:               config.messagingEnabled,
    whatsappEnabled:                config.whatsappEnabled,
    notificationPreferencesEnabled: config.notificationPreferencesEnabled,
    deviceTrackingEnabled:          config.deviceTrackingEnabled,
  };
}

/** Returns true when the notification system (bell, feed, or push) is active. */
export function useIsNotificationsEnabled(): boolean {
  const { config } = usePublicSettings();
  return (
    config.notificationsEnabled ||
    config.inAppNotificationsEnabled ||
    config.pushNotificationsEnabled
  );
}

/** Returns true when the messaging/chat feature is active. */
export function useIsMessagingEnabled(): boolean {
  return usePublicSettings().config.messagingEnabled;
}

