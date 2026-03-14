import { useState, useEffect } from 'react';
import { notificationService } from '@/services/notification-service';

interface NotificationCount {
  unreadCount: number;
}

/**
 * Hook to fetch real-time unread notification count
 * Polls the API every 30 seconds for updates
 * 
 * @returns {Object} { unreadCount, isLoading, refetch }
 */
export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationService.getUnreadCount();
      setUnreadCount(response.count || 0);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    unreadCount,
    isLoading,
    refetch: fetchUnreadCount
  };
}
