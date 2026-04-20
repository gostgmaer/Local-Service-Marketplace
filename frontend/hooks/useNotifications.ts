import { useState, useEffect, useCallback } from "react";
import { notificationService } from "@/services/notification-service";
import { isNotificationsEnabled } from "@/config/features";
import { useSocketEvent } from "@/hooks/useSocket";

interface NotificationCount {
  unreadCount: number;
}

interface UseNotificationsOptions {
  enabled?: boolean; // Only fetch when enabled (e.g., user is authenticated)
}

/**
 * Hook to fetch real-time unread notification count
 * Polls the API every 30 seconds for updates
 *
 * @param options - Configuration options
 * @param options.enabled - Whether to enable fetching (default: true)
 * @returns {Object} { unreadCount, isLoading, refetch }
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true } = options;
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check if notifications are enabled via feature flag
  const notificationsEnabled = isNotificationsEnabled();

  const fetchUnreadCount = useCallback(async () => {
    // Don't fetch if feature is disabled or not enabled via options
    if (!enabled || !notificationsEnabled) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await notificationService.getUnreadCount();
      setUnreadCount(response.count || 0);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
      setUnreadCount(0); // Reset count on error
      setIsLoading(false);
    }
  }, [enabled, notificationsEnabled]);

  // Re-fetch unread count when a new notification arrives via socket
  useSocketEvent("notification:created", fetchUnreadCount);

  useEffect(() => {
    // Only fetch if enabled and notifications feature is enabled
    if (!enabled || !notificationsEnabled) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    return () => {};
  }, [enabled, notificationsEnabled]); // Re-run when enabled state changes

  return {
    unreadCount,
    isLoading,
    refetch: fetchUnreadCount,
  };
}
