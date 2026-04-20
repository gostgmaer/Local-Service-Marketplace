"use client";

import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useCallback } from "react";
import { create } from "zustand";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3007";

interface SocketStore {
  socket: Socket | null;
  connected: boolean;
  setSocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
  socket: null,
  connected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
}));

/**
 * Hook that manages the socket.io connection lifecycle.
 * Call once at the dashboard layout level.
 */
export function useSocketConnection() {
  const { data: session, status } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const { setSocket, setConnected } = useSocketStore();

  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) {
      // Not authenticated — disconnect if connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Already connected with this token
    if (socketRef.current?.connected) return;

    const socket = io(`${WS_URL}/updates`, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.warn("[socket] connection error:", err.message);
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
 * Hook to get the current socket instance.
 */
export function useSocket() {
  return useSocketStore((s) => s.socket);
}

/**
 * Subscribe to a socket event. Returns an unsubscribe function.
 * Stable across re-renders via callback ref.
 */
export function useSocketEvent(
  event: string,
  handler: (payload: any) => void,
) {
  const socket = useSocket();
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
