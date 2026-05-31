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
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { getToken } from "@/lib/auth-token";
import { scheduleSingleFlightTimer, closeIfCurrent } from "@/lib/ws-lifecycle";
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
  const authUser = useAuthStore((s) => s.user);
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
  const toastHistoryRef = useRef(new Map<string, number>());

  // 用 per-field selector 订阅，避免无 selector 的整店订阅在任意 global state 变化时
  // 都触发本 hook 重跑（这些都是 zustand 稳定 action）。返回值处已用 selector，这里对齐。
  const updateTask = useGlobalStore((s) => s.updateTask);
  const loadNotifications = useGlobalStore((s) => s.loadNotifications);
  const setWsConnected = useGlobalStore((s) => s.setWsConnected);
  const setWsReconnecting = useGlobalStore((s) => s.setWsReconnecting);

  const shouldShowToast = useCallback((taskId: string, status: "completed" | "failed") => {
    const key = `${taskId}:${status}`;
    const now = Date.now();
    const history = toastHistoryRef.current;
    const lastShown = history.get(key);
    if (lastShown && now - lastShown < 10000) {
      return false;
    }
    history.set(key, now);
    history.forEach((timestamp, storedKey) => {
      if (now - timestamp > 120000) {
        history.delete(storedKey);
      }
    });
    return true;
  }, []);

  // Stop HTTP polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
  }, []);

  // Start HTTP polling fallback
  const startPolling = useCallback(() => {
    if (!authUser || pollingIntervalRef.current) return;

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
          reconnectRef.current?.();
        }
      } catch {
        // Ignore polling errors to avoid noisy overlays in dev
      }
    };

    // Poll immediately, then every 5 seconds
    poll();
    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL);
  }, [authUser, client, updateTask]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const response: WebSocketMessage = JSON.parse(event.data);

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
          if (shouldShowToast(response.data.task_id, "completed")) {
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
          if (shouldShowToast(response.data.task_id, "failed")) {
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
        }

        // Handle YouTube reauthorization required (with deduplication)
        if (response.data?.type === "youtube_reauth_required") {
          const now = Date.now();
          const lastShown = toastHistoryRef.current.get("youtube_reauth");
          if (!lastShown || now - lastShown > 60000) {
            // Only show once per minute
            toastHistoryRef.current.set("youtube_reauth", now);
            toast.warning("YouTube 授权已过期", {
              description: "请重新连接您的 YouTube 账号以继续同步",
              action: {
                label: "重新连接",
                onClick: () => {
                  window.location.href = "/subscriptions";
                },
              },
              duration: 10000,
            });
          }
        }
      } catch {
      }
    },
    [
      updateTask,
      loadNotifications,
      setWsConnected,
      setWsReconnecting,
      shouldShowToast,
      stopPolling,
    ]
  );

  // Reconnect with exponential backoff
  const reconnect = useCallback(() => {
    if (!enabledRef.current || !authUser) return;

    const attempts = reconnectAttemptsRef.current;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      setWsReconnecting(false);
      startPolling();
      return;
    }

    // Exponential backoff with cap
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, attempts),
      MAX_RECONNECT_DELAY
    );

    setWsReconnecting(true);

    // 单飞调度：先清掉上一个未触发的重连定时器，避免网络抖动下叠出多条并行连接。
    scheduleSingleFlightTimer(reconnectTimeoutRef, delay, () => {
      reconnectAttemptsRef.current += 1;
      connectRef.current?.();
    });
  }, [authUser, startPolling, setWsReconnecting]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!authUser) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Get authentication token
    const token = await getToken();
    if (!token) {
      return;
    }

    // Determine WebSocket URL
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "";
    let wsHost: string;
    let basePath: string;
    if (rawBaseUrl) {
      // Dev: env var provides an absolute URL to the API server
      const normalizedBaseUrl = /\/api\/v1\/?$/.test(rawBaseUrl)
        ? rawBaseUrl.replace(/\/$/, "")
        : `${rawBaseUrl.replace(/\/$/, "")}/api/v1`;
      const wsBase = new URL(normalizedBaseUrl);
      wsHost = wsBase.host;
      basePath =
        wsBase.pathname && wsBase.pathname !== "/"
          ? wsBase.pathname.replace(/\/$/, "")
          : "";
    } else {
      // Prod: same-origin WS via nginx /api/v1/ proxy
      wsHost = window.location.host;
      basePath = "/api/v1";
    }
    const wsUrl = `${wsProtocol}//${wsHost}${basePath}/ws/user`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
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
            ws.close(4001, "Authentication timeout");
          }
        }, AUTH_TIMEOUT_MS);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = () => {
        // 仅当关闭的是当前 socket 时才清理：被 connect() 取代的旧 socket 的延迟 onclose
        // 不得清掉活 socket 的 auth 定时器/引用，也不得触发多余重连。
        closeIfCurrent(wsRef, ws, () => {
          if (authTimeoutRef.current) {
            clearTimeout(authTimeoutRef.current);
          }
          isAuthenticatedRef.current = false;
          setWsConnected(false);

          // Auto-reconnect if enabled
          if (enabledRef.current && authUser) {
            reconnect();
          }
        });
      };
    } catch {
      setWsConnected(false);
      reconnect();
    }
  }, [authUser, handleMessage, setWsConnected, reconnect]);

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
    if (authUser) {
      enabledRef.current = true;
      connect();
    }

    return () => {
      disconnect();
    };
  }, [authUser, connect, disconnect]);

  return {
    wsConnected: useGlobalStore((state) => state.wsConnected),
    wsReconnecting: useGlobalStore((state) => state.wsReconnecting),
    disconnect,
    reconnect: connect,
  };
}
