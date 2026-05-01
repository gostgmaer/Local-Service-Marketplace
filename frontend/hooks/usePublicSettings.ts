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
 * - Refresh: sends conditional requests with ETag and only updates local cache
 *   when backend settings actually change.
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
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: getSiteConfigFromCache, // instant from localStorage on every render
    retry: 1,
  });

  return { config: data ?? SITE_CONFIG_DEFAULTS, isLoading };
}
