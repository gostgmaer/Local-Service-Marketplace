import { useState, useEffect } from 'react';
import { notificationService } from '@/services/notification-service';

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

  const fetchUnreadCount = async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await notificationService.getUnreadCount();
      setUnreadCount(response.count || 0);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
      setUnreadCount(0); // Reset count on error
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if enabled
    if (!enabled) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [enabled]); // Re-run when enabled state changes

  return {
    unreadCount,
    isLoading,
    refetch: fetchUnreadCount
  };
}
