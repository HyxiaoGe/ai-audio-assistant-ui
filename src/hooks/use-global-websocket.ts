/**
 * Global WebSocket Manager
 *
 * Manages a single WebSocket connection to /ws/user that receives
 * all task updates and notifications for the authenticated user.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - HTTP polling fallback when WebSocket fails
 * - Automatic recovery when network is restored
 */

"use client";

import { useEffect, useRef, useCallback, createElement } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { getToken } from "@/lib/auth-token";
import { useGlobalStore } from "@/store/global-store";
import { useAPIClient } from "@/lib/use-api-client";
import type { TaskStatus } from "@/types/api";

// WebSocket message types from backend
interface WebSocketMessage {
  code: number;
  message: string;
  data: {
    type: string;
    status?: TaskStatus;
    stage?: string;
    progress?: number;
    task_id?: string;
    task_title?: string;
    user_id?: string;
    notification?: {
      message: string;
      type?: "success" | "error" | "info" | "warning";
      link?: string;
    };
  };
  traceId: string;
}

const MAX_RECONNECT_ATTEMPTS = 999; // Infinite reconnect
const RECONNECT_BASE_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_DELAY = 60000; // 60 seconds (cap)
const AUTH_TIMEOUT_MS = 5000;
const POLLING_INTERVAL = 5000; // 5 seconds

export function useGlobalWebSocket() {
  const { data: session } = useSession();
  const client = useAPIClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pollingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const authTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const connectRef = useRef<(() => void) | null>(null);
  const reconnectRef = useRef<(() => void) | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isAuthenticatedRef = useRef(false);
  const enabledRef = useRef(true);

  const {
    updateTask,
    loadNotifications,
    setWsConnected,
    setWsReconnecting,
  } = useGlobalStore();

  // Stop HTTP polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
  }, []);

  // Start HTTP polling fallback
  const startPolling = useCallback(() => {
    if (!session?.user || pollingIntervalRef.current) return;

    console.log("[GlobalWS] Starting HTTP polling fallback");

    const poll = async () => {
      try {
        const tasks = await client.getTasks({ status: "processing" });
        tasks.items.forEach((task) => {
          updateTask(task.id, {
            task_id: task.id,
            status: task.status,
            progress: task.progress ?? 0,
            title: task.title,
            updated_at: Date.now(),
          });
        });

        // If polling succeeds, try to reconnect WebSocket
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log("[GlobalWS] HTTP polling successful, attempting WebSocket reconnect");
          reconnectRef.current?.();
        }
      } catch {
        // Ignore polling errors to avoid noisy overlays in dev
      }
    };

    // Poll immediately, then every 5 seconds
    poll();
    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL);
  }, [session, client, updateTask]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const response: WebSocketMessage = JSON.parse(event.data);

        // Log all received messages (except auth)
        if (response.data?.type !== "authenticated") {
          console.log("[GlobalWS] Message received:", response.data);
        }

        // Handle authentication response
        if (response.data?.type === "authenticated") {
          isAuthenticatedRef.current = true;
          if (authTimeoutRef.current) {
            clearTimeout(authTimeoutRef.current);
          }
          setWsConnected(true);
          setWsReconnecting(false);
          reconnectAttemptsRef.current = 0;
          stopPolling(); // Stop polling when WebSocket is connected
          console.log("[GlobalWS] Authenticated successfully");
          return;
        }

        // Handle task progress updates
        if (response.data?.type === "progress" && response.data.task_id) {
          updateTask(response.data.task_id, {
            task_id: response.data.task_id,
            status: response.data.status || "processing",
            progress: response.data.progress || 0,
            stage: response.data.stage,
            updated_at: Date.now(),
          });
        }

        // Handle task completion
        if (response.data?.type === "completed" && response.data.task_id) {
          updateTask(response.data.task_id, {
            task_id: response.data.task_id,
            status: "completed",
            progress: 100,
            updated_at: Date.now(),
          });

          const taskTitle = response.data.task_title || "任务";

          // Reload notifications (notification was created by backend)
          loadNotifications();

          // Show toast notification
          toast.success(`《${taskTitle}》转写完成`, {
            icon: createElement(CheckCircle2, { className: "w-4 h-4" }),
            action: {
              label: "查看详情",
              onClick: () => {
                window.location.href = `/tasks/${response.data.task_id}`;
              },
            },
          });
        }

        // Handle task error
        if (response.data?.type === "error" && response.data.task_id) {
          updateTask(response.data.task_id, {
            task_id: response.data.task_id,
            status: "failed",
            error_message: response.message,
            updated_at: Date.now(),
          });

          const taskTitle = response.data.task_title || "任务";

          // Reload notifications (notification was created by backend)
          loadNotifications();

          // Show error toast
          toast.error(`《${taskTitle}》处理失败`, {
            icon: createElement(XCircle, { className: "w-4 h-4" }),
            description: response.message,
            action: {
              label: "查看详情",
              onClick: () => {
                window.location.href = `/tasks/${response.data.task_id}`;
              },
            },
          });
        }
      } catch (err) {
        console.error("[GlobalWS] Failed to parse message:", err);
      }
    },
    [updateTask, loadNotifications, setWsConnected, setWsReconnecting, stopPolling]
  );

  // Reconnect with exponential backoff
  const reconnect = useCallback(() => {
    if (!enabledRef.current || !session?.user) return;

    const attempts = reconnectAttemptsRef.current;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("[GlobalWS] Max reconnect attempts reached, starting HTTP polling");
      setWsReconnecting(false);
      startPolling();
      return;
    }

    // Exponential backoff with cap
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, attempts),
      MAX_RECONNECT_DELAY
    );

    console.log(
      `[GlobalWS] Reconnecting in ${delay}ms (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`
    );

    setWsReconnecting(true);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      connectRef.current?.();
    }, delay);
  }, [session, startPolling, setWsReconnecting]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!session?.user) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Get authentication token
    const token = await getToken();
    if (!token) {
      console.error("[GlobalWS] No auth token available");
      return;
    }

    // Determine WebSocket URL
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8000";
    const normalizedBaseUrl = /\/api\/v1\/?$/.test(rawBaseUrl)
      ? rawBaseUrl.replace(/\/$/, "")
      : `${rawBaseUrl.replace(/\/$/, "")}/api/v1`;
    const wsBase = new URL(normalizedBaseUrl);
    const basePath =
      wsBase.pathname && wsBase.pathname !== "/"
        ? wsBase.pathname.replace(/\/$/, "")
        : "";
    const wsUrl = `${wsProtocol}//${wsBase.host}${basePath}/ws/user`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[GlobalWS] Connected");
        isAuthenticatedRef.current = false;

        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
        }

        // Send authentication
        ws.send(
          JSON.stringify({
            type: "authenticate",
            token,
          })
        );

        // Set authentication timeout
        authTimeoutRef.current = setTimeout(() => {
          if (!isAuthenticatedRef.current) {
            console.error("[GlobalWS] Authentication timeout");
            ws.close(4001, "Authentication timeout");
          }
        }, AUTH_TIMEOUT_MS);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`[GlobalWS] Disconnected (code: ${event.code})`);
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
        }
        isAuthenticatedRef.current = false;
        setWsConnected(false);
        wsRef.current = null;

        // Auto-reconnect if enabled
        if (enabledRef.current && session?.user) {
          reconnect();
        }
      };
    } catch (err) {
      console.error("[GlobalWS] Failed to create connection:", err);
      setWsConnected(false);
      reconnect();
    }
  }, [session, handleMessage, setWsConnected, reconnect]);

  useEffect(() => {
    connectRef.current = () => {
      void connect();
    };
  }, [connect]);

  useEffect(() => {
    reconnectRef.current = reconnect;
  }, [reconnect]);

  // Disconnect
  const disconnect = useCallback(() => {
    enabledRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
    }

    stopPolling();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isAuthenticatedRef.current = false;
    setWsConnected(false);
    setWsReconnecting(false);
    reconnectAttemptsRef.current = 0;
  }, [stopPolling, setWsConnected, setWsReconnecting]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (session?.user) {
      enabledRef.current = true;
      connect();
    }

    return () => {
      disconnect();
    };
  }, [session, connect, disconnect]);

  return {
    wsConnected: useGlobalStore((state) => state.wsConnected),
    wsReconnecting: useGlobalStore((state) => state.wsReconnecting),
    disconnect,
    reconnect: connect,
  };
}
