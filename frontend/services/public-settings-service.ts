/**
 * Public site configuration fetched from /public/site-config.
 * No authentication required — safe to call from server components and
 * client-side hooks alike.
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
};

import { API_URL } from "@/config/constants";

/**
 * Fetches site config from the backend.
 * - In Next.js server components: use with `{ next: { revalidate: 300 } }`.
 * - In client components: use `usePublicSettings()` hook instead.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/site-config`, {
      next: { revalidate: 300 }, // cache for 5 min in RSC
    } as any);
    if (!res.ok) return SITE_CONFIG_DEFAULTS;
    const json = await res.json();
    // API may wrap in standardized envelope { data: { ... } } or return flat
    const config = json?.data ?? json;
    return config as SiteConfig;
  } catch {
    return SITE_CONFIG_DEFAULTS;
  }
}
