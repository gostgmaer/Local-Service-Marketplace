"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useMessagingSocket,
  useMessagingEvent,
} from "./useMessagingSocket";

interface TypingState {
  [userId: string]: boolean;
}

/**
 * Hook for typing indicators over the /messaging namespace.
 *
 * @param receiverId - The user ID of the other chat participant
 * @returns { isTyping, typingUsers, sendTyping }
 *   - typingUsers: record of userId → isTyping
 *   - sendTyping(isTyping): emit typing state to the receiver
 */
export function useTypingIndicator(receiverId: string | null) {
  const socket = useMessagingSocket();
  const [typingUsers, setTypingUsers] = useState<TypingState>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for typing events from others
  useMessagingEvent("message:typing", (data: { senderId: string; isTyping: boolean }) => {
    setTypingUsers((prev) => ({ ...prev, [data.senderId]: data.isTyping }));

    // Auto-clear after 5 seconds (in case the stop event was missed)
    if (data.isTyping) {
      setTimeout(() => {
        setTypingUsers((prev) => ({ ...prev, [data.senderId]: false }));
      }, 5000);
    }
  });

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !receiverId) return;
      socket.emit("message:typing", { receiverId, isTyping });

      // Auto-stop typing after 3 seconds of inactivity
      if (isTyping) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          socket.emit("message:typing", { receiverId, isTyping: false });
        }, 3000);
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [socket, receiverId],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isOtherTyping = Object.values(typingUsers).some(Boolean);

  return { typingUsers, isOtherTyping, sendTyping };
}
