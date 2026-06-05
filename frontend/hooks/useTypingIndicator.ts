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
  // Track per-sender auto-clear timers so they can be cancelled and cleaned up
  const autoClearTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Listen for typing events from others
  useMessagingEvent("message:typing", (data: { senderId: string; isTyping: boolean }) => {
    setTypingUsers((prev) => ({ ...prev, [data.senderId]: data.isTyping }));

    // Cancel any existing auto-clear timer for this sender
    const existing = autoClearTimers.current.get(data.senderId);
    if (existing) clearTimeout(existing);

    if (data.isTyping) {
      // Auto-clear after 5 seconds (in case the stop event was missed)
      const id = setTimeout(() => {
        setTypingUsers((prev) => ({ ...prev, [data.senderId]: false }));
        autoClearTimers.current.delete(data.senderId);
      }, 5000);
      autoClearTimers.current.set(data.senderId, id);
    } else {
      autoClearTimers.current.delete(data.senderId);
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      autoClearTimers.current.forEach(clearTimeout);
      autoClearTimers.current.clear();
    };
  }, []);

  const isOtherTyping = Object.values(typingUsers).some(Boolean);

  return { typingUsers, isOtherTyping, sendTyping };
}
