/**
 * Global WebSocket Provider
 *
 * Initializes the global WebSocket connection for the entire app.
 * Must be placed inside SessionProvider to access authentication.
 */

"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useGlobalWebSocket } from "@/hooks/use-global-websocket";
import { useGlobalStore } from "@/store/global-store";

export function GlobalWebSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const loadNotifications = useGlobalStore((state) => state.loadNotifications);

  // Initialize global WebSocket (auto-connects when user is authenticated)
  useGlobalWebSocket();

  // Load notifications when user is authenticated
  useEffect(() => {
    if (session?.user) {
      loadNotifications();
    }
  }, [session, loadNotifications]);

  return <>{children}</>;
}
