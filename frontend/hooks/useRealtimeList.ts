"use client";

import { useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketEvent } from "./useSocket";

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

  // Subscribe to each event
  for (const event of events) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSocketEvent(event, invalidate);
  }
}
