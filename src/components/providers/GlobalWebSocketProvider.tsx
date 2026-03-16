/**
 * Global WebSocket Provider
 *
 * Initializes the global WebSocket connection for the entire app.
 * Must be placed inside AuthProvider to access authentication.
 */

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useGlobalWebSocket } from "@/hooks/use-global-websocket";
import { useGlobalStore } from "@/store/global-store";

export function GlobalWebSocketProvider({ children }: { children: React.ReactNode }) {
  const authUser = useAuthStore((s) => s.user);
  const loadNotifications = useGlobalStore((state) => state.loadNotifications);

  // Initialize global WebSocket (auto-connects when user is authenticated)
  useGlobalWebSocket();

  // Load notifications when user is authenticated
  useEffect(() => {
    if (authUser) {
      loadNotifications();
    }
  }, [authUser, loadNotifications]);

  return <>{children}</>;
}
