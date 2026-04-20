"use client";

import { useState, useCallback } from "react";
import {
  useMessagingSocket,
  useMessagingEvent,
} from "./useMessagingSocket";

/**
 * Hook for tracking online presence of users via the /messaging namespace.
 *
 * @returns { onlineUsers, isOnline, requestOnlineStatus }
 */
export function usePresence() {
  const socket = useMessagingSocket();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useMessagingEvent("user:online", (data: { userId: string }) => {
    setOnlineUsers((prev) => new Set(prev).add(data.userId));
  });

  useMessagingEvent("user:offline", (data: { userId: string }) => {
    setOnlineUsers((prev) => {
      const next = new Set(prev);
      next.delete(data.userId);
      return next;
    });
  });

  const isOnline = useCallback(
    (userId: string) => onlineUsers.has(userId),
    [onlineUsers],
  );

  /**
   * Request current online status for a list of user IDs.
   */
  const requestOnlineStatus = useCallback(
    (userIds: string[]) => {
      if (!socket || userIds.length === 0) return;
      socket.emit(
        "users:getOnlineStatus",
        { userIds },
        (response: { success: boolean; onlineStatus: Record<string, boolean> }) => {
          if (response?.success) {
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              for (const [uid, online] of Object.entries(response.onlineStatus)) {
                if (online) next.add(uid);
                else next.delete(uid);
              }
              return next;
            });
          }
        },
      );
    },
    [socket],
  );

  return { onlineUsers, isOnline, requestOnlineStatus };
}
