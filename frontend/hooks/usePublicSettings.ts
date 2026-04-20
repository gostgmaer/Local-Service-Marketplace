"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getSiteConfig,
  getSiteConfigFromCache,
  SITE_CONFIG_DEFAULTS,
  type SiteConfig,
} from "@/services/public-settings-service";

/**
 * React Query hook that provides the full public site configuration including
 * feature flags (contact info, upload limits, GST rate, platform fee,
 * pagination defaults, notification flags, messaging flags, etc.).
 *
 * - On first render: returns instantly from localStorage (no flash, no spinner).
 * - Background: re-fetches from the API every 60 s and writes the result back
 *   to localStorage so the next page load is instant too.
 * - Falls back to sensible defaults when the backend is unreachable.
 * - No authentication required.
 *
 * @example
 * const { config } = usePublicSettings();
 * <p>Email: {config.supportEmail}</p>
 * <p>Notifications: {config.notificationsEnabled}</p>
 */
export function usePublicSettings(): {
  config: SiteConfig;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<SiteConfig>({
    queryKey: ["public-site-config"],
    queryFn: getSiteConfig,
    staleTime: 60_000,          // re-fetch after 60 s (matches admin polling expectation)
    gcTime: 10 * 60 * 1000,     // keep in cache for 10 min
    initialData: getSiteConfigFromCache, // instant from localStorage on every render
    retry: 1,
  });

  return { config: data ?? SITE_CONFIG_DEFAULTS, isLoading };
}
