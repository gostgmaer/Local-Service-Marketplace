import { API_URL } from "@/config/constants";

/**
 * Public site configuration fetched from /public/site-config.
 * No authentication required — safe to call from server components and
 * client-side hooks alike.
 *
 * Feature flags are included here so there is a single data source.
 * Use `usePublicSettings()` in client components — it loads instantly from
 * localStorage on first render, then re-fetches in the background every 60 s
 * and persists the result back to localStorage.
 */
export interface SiteConfig {
  // Contact & branding
  supportEmail: string;
  contactPhone: string;
  contactAddress: string;
  // Upload limits
  maxFileUploadSizeMb: number;
  allowedFileTypes: string; // comma-separated MIME types
  // Pricing
  gstRate: number;
  platformFeePercentage: number;
  currency: string;
  // Pagination
  defaultPageLimit: number;
  // Maintenance
  maintenanceMode: boolean;
  maintenanceMessage: string;
  // Registration & auth
  registrationEnabled: boolean;
  providerRegistrationEnabled: boolean;
  guestRequestsEnabled: boolean;
  // Limits & policies
  maxActiveRequestsPerCustomer: number;
  maxProposalCount: number;
  maxServicesPerProvider: number;
  requestExpiryDays: number;
  jobAutoCompleteDays: number;
  disputeWindowDays: number;
  refundWindowDays: number;
  reviewSubmissionWindowDays: number;
  minReviewLength: number;
  // Legal
  termsVersion: string;
  privacyVersion: string;
  // Realtime
  realtimeEnabled: boolean;
  // Timezone
  defaultTimezone: string;
  // Feature flags (admin-controlled via system_settings table)
  notificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  messagingEnabled: boolean;
  whatsappEnabled: boolean;
  notificationPreferencesEnabled: boolean;
  deviceTrackingEnabled: boolean;
}

export const SITE_CONFIG_DEFAULTS: SiteConfig = {
  supportEmail: "support@marketplace.com",
  contactPhone: "",
  contactAddress: "",
  maxFileUploadSizeMb: 10,
  allowedFileTypes: "image/jpeg,image/png,image/webp,application/pdf",
  gstRate: 12,
  platformFeePercentage: 10,
  currency: "INR",
  defaultPageLimit: 20,
  maintenanceMode: false,
  maintenanceMessage: "",
  registrationEnabled: true,
  providerRegistrationEnabled: true,
  guestRequestsEnabled: true,
  maxActiveRequestsPerCustomer: 10,
  maxProposalCount: 10,
  maxServicesPerProvider: 10,
  requestExpiryDays: 30,
  jobAutoCompleteDays: 7,
  disputeWindowDays: 30,
  refundWindowDays: 30,
  reviewSubmissionWindowDays: 90,
  minReviewLength: 10,
  termsVersion: "1.0",
  privacyVersion: "1.0",
  realtimeEnabled: true,
  defaultTimezone: "Asia/Kolkata",
  // Feature flag defaults — all disabled except email
  notificationsEnabled: false,
  inAppNotificationsEnabled: false,
  pushNotificationsEnabled: false,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: false,
  messagingEnabled: false,
  whatsappEnabled: false,
  notificationPreferencesEnabled: false,
  deviceTrackingEnabled: false,
};

/** localStorage key used to persist the config between page loads. */
const LS_KEY = "lsmp_site_config";

/**
 * Returns the site config stored in localStorage, or `SITE_CONFIG_DEFAULTS`
 * if nothing is cached yet (or in a server-side / non-browser environment).
 */
export function getSiteConfigFromCache(): SiteConfig {
  if (typeof window === "undefined") return SITE_CONFIG_DEFAULTS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...SITE_CONFIG_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Corrupted localStorage — return defaults
  }
  return SITE_CONFIG_DEFAULTS;
}

/**
 * Fetches site config from the backend and persists the result to localStorage
 * so subsequent page loads are instant.
 * - In client components: use `usePublicSettings()` hook instead.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/site-config`, {
      cache: "no-store",
    });
    if (!res.ok) return getSiteConfigFromCache();
    const json = await res.json();
    // API may wrap in standardized envelope { data: { ... } } or return flat
    const config: SiteConfig = { ...SITE_CONFIG_DEFAULTS, ...(json?.data ?? json) };
    // Persist so next page load is instant
    if (typeof window !== "undefined") {
      try { localStorage.setItem(LS_KEY, JSON.stringify(config)); } catch { /* quota exceeded */ }
    }
    return config;
  } catch {
    return getSiteConfigFromCache();
  }
}
