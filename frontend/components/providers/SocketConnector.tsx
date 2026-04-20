"use client";

import { useSocketConnection } from "@/hooks/useSocket";

/**
 * Invisible client component that establishes the socket.io connection
 * when rendered inside the dashboard layout (authenticated context).
 */
export function SocketConnector() {
  useSocketConnection();
  return null;
}
