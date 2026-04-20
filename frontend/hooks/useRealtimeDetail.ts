"use client";

import { useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketEvent } from "./useSocket";

/**
 * Invalidate a React Query detail entry when a socket event fires
 * AND the payload matches the target entity ID.
 *
 * @param events   - socket event names to listen for
 * @param queryKey - React Query key to invalidate, e.g. ["request", requestId]
 * @param entityId - only invalidate when `payload.entityId === entityId`
 *                   OR `payload.relatedIds` contains the entityId
 */
export function useRealtimeDetail(
  events: string[],
  queryKey: unknown[],
  entityId: string | undefined,
) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvent = useCallback(
    (payload: any) => {
      if (!entityId) return;

      // Match on direct entity ID or any related ID value
      const matches =
        payload?.entityId === entityId ||
        (payload?.relatedIds &&
          Object.values(payload.relatedIds).includes(entityId));

      if (!matches) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 500);
    },
    [queryClient, queryKey, entityId],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  for (const event of events) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSocketEvent(event, handleEvent);
  }
}
