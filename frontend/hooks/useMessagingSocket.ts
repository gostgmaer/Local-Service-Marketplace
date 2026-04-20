"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { create } from "zustand";
import { WS_URL } from "@/config/constants";

interface MessagingSocketStore {
  socket: Socket | null;
  connected: boolean;
  setSocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useMessagingSocketStore = create<MessagingSocketStore>((set) => ({
  socket: null,
  connected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
}));

/**
 * Hook that manages the /messaging namespace socket.io connection.
 * Call once at the messages page level.
 */
export function useMessagingConnection() {
  const { data: session, status } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const { setSocket, setConnected } = useMessagingSocketStore();

  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    if (socketRef.current?.connected) return;

    const socket = io(`${WS_URL}/messaging`, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      console.warn("[messaging-socket] connection error:", err.message);
      setConnected(false);
    });

    socketRef.current = socket;
    setSocket(socket);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.accessToken]);
}

/**
 * Get the current /messaging namespace socket instance.
 */
export function useMessagingSocket() {
  return useMessagingSocketStore((s) => s.socket);
}

/**
 * Subscribe to a /messaging namespace event.
 */
export function useMessagingEvent(
  event: string,
  handler: (payload: any) => void,
) {
  const socket = useMessagingSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const fn = (payload: any) => handlerRef.current(payload);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}
