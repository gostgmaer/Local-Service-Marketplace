import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { notificationService } from "@/services/notification-service";
import { isNotificationsEnabled } from "@/config/features";
import { useSocketEvent } from "@/hooks/useSocket";

interface UseNotificationsOptions {
  enabled?: boolean; // Only fetch when enabled (e.g., user is authenticated)
}

/** Map notification types to a simple emoji icon for the toast. */
function getToastIcon(notificationType: string): string {
  switch (notificationType) {
    case "proposal":
      return "📋";
    case "job":
      return "🔧";
    case "payment":
      return "💳";
    case "review":
      return "⭐";
    case "message":
      return "💬";
    case "dispute":
      return "⚠️";
    default:
      return "🔔";
  }
}

/**
 * Hook to fetch real-time unread notification count and show toast popups.
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

  // Show a toast and re-fetch unread count when a new notification arrives via socket
  useSocketEvent("notification:created", (payload: any) => {
    const message: string = payload?.data?.message;
    const notificationType: string = payload?.data?.notificationType ?? "";
    if (message) {
      toast(message, {
        icon: getToastIcon(notificationType),
        duration: 5000,
        style: { maxWidth: 400 },
      });
    }
    fetchUnreadCount();
  });

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

