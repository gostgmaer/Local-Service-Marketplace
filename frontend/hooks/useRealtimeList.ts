"use client";

import { useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketStore } from "./useSocket";

/**
 * Invalidate a React Query list when a socket event fires.
 * Debounces by 500ms so rapid mutations don't cause N refetches.
 *
 * @param events  - socket event names to listen for, e.g. ["request:created","request:updated"]
 * @param queryKey - React Query key to invalidate, e.g. ["requests"]
 */
export function useRealtimeList(events: string[], queryKey: unknown[]) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey });
    }, 500);
  }, [queryClient, queryKey]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Subscribe to all events in a single effect to avoid hooks-in-loop
  // (calling useSocketEvent in a for-loop violates Rules of Hooks)
  const socket = useSocketStore((s) => s.socket);
  useEffect(() => {
    if (!socket) return;
    events.forEach((event) => socket.on(event, invalidate));
    return () => {
      events.forEach((event) => socket.off(event, invalidate));
    };
    // events.join is a stable string representation of the array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, invalidate, events.join(",")]);
}
