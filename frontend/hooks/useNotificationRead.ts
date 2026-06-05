import { useOptimisticMutation } from "./useOptimisticMutation";
import {
  notificationService,
  Notification,
} from "@/services/notification-service";

interface MarkReadVariables {
  notificationId: string;
}

/**
 * Hook for optimistic notification mark as read
 * Immediately updates UI, rollback on error
 */
export function useNotificationRead() {
  return useOptimisticMutation<void, MarkReadVariables>({
    // Use the base key so React Query's partial matching invalidates all
    // notification query variants (keyed with page/filter suffixes).
    // The updateFn handles the paginated shape { data: Notification[], total, hasMore }.
    queryKey: ["notifications"],
    mutationFn: async ({ notificationId }) => {
      await notificationService.markAsRead(notificationId);
    },
    updateFn: (oldData: any, { notificationId }) => {
      if (!oldData) return oldData;
      // Handle paginated shape: { data: Notification[], total, hasMore }
      if (oldData?.data && Array.isArray(oldData.data)) {
        return {
          ...oldData,
          data: oldData.data.map((n: Notification) =>
            n.id === notificationId ? { ...n, read: true } : n,
          ),
        };
      }
      // Handle legacy flat array shape
      if (Array.isArray(oldData)) {
        return oldData.map((n: Notification) =>
          n.id === notificationId ? { ...n, read: true } : n,
        );
      }
      return oldData;
    },
    successMessage: undefined, // Silent success
    errorMessage: "Failed to mark notification as read",
  });
}
