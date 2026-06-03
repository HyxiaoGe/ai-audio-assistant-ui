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

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { getToken } from "@/lib/auth-token";
import { scheduleSingleFlightTimer, closeIfCurrent } from "@/lib/ws-lifecycle";
import { useGlobalStore, type TaskProgress } from "@/store/global-store";
import { useAPIClient } from "@/lib/use-api-client";
import {
  routeWebSocketMessage,
  type WsRouterDeps,
  type WsNotificationData,
} from "@/lib/ws-message-router";
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from "@/lib/notify";
import { getNotificationVariant } from "@/lib/notification-variant";
import { translateStatic } from "@/lib/i18n-static";

// Backend may send either the auth handshake (data.type === "authenticated")
// or a unified envelope { kind, data, traceId }.
interface WebSocketMessage {
  kind?: string;
  data?: {
    type?: string;
    [key: string]: unknown;
  };
  traceId?: string;
}

function interpolateTitle(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] === undefined ? m : String(vars[k])
  );
}

const MAX_RECONNECT_ATTEMPTS = 999; // Infinite reconnect
const RECONNECT_BASE_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_DELAY = 60000; // 60 seconds (cap)
const AUTH_TIMEOUT_MS = 5000;
const POLLING_INTERVAL = 5000; // 5 seconds

interface WsRouterStoreActions {
  addNotificationFromWebSocket: (data: WsNotificationData) => void;
  // 与 store 的 updateTask 签名精确对齐，避免把 store 函数赋给 Record<string,unknown>
  // 形参的逆变不兼容（strictFunctionTypes 下会报错）。
  updateTask: (taskId: string, data: Partial<TaskProgress>) => void;
  loadNotifications: () => void;
  refreshUnread: () => void;
  showNotificationToast: (data: WsNotificationData) => void;
}

export function buildWsRouterDeps(actions: WsRouterStoreActions): WsRouterDeps {
  return {
    addNotificationFromWebSocket: actions.addNotificationFromWebSocket,
    // WsTaskProgressData 与 Partial<TaskProgress> 字段重叠但不互相可赋（status: string vs TaskStatus、
    // task_id 必填 vs 可选），经 unknown 桥接；运行时同一对象，仅编译期断言。
    updateTask: (taskId, data) =>
      actions.updateTask(taskId, data as unknown as Partial<TaskProgress>),
    loadNotifications: actions.loadNotifications,
    refreshUnread: actions.refreshUnread,
    showNotificationToast: actions.showNotificationToast,
  };
}

export function makeVisibilityRefetch(
  loadNotifications: () => void,
  refreshUnread: () => void
): () => void {
  return () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;
    loadNotifications();
    refreshUnread();
  };
}

export function useGlobalWebSocket() {
  const authUser = useAuthStore((s) => s.user);
  const client = useAPIClient();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pollingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const authTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const connectRef = useRef<(() => void) | null>(null);
  const reconnectRef = useRef<(() => void) | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isAuthenticatedRef = useRef(false);
  const enabledRef = useRef(true);

  // 用 per-field selector 订阅，避免无 selector 的整店订阅在任意 global state 变化时
  // 都触发本 hook 重跑（这些都是 zustand 稳定 action）。返回值处已用 selector，这里对齐。
  const updateTask = useGlobalStore((s) => s.updateTask);
  const loadNotifications = useGlobalStore((s) => s.loadNotifications);
  const refreshUnread = useGlobalStore((s) => s.refreshUnread);
  const addNotificationFromWebSocket = useGlobalStore(
    (s) => s.addNotificationFromWebSocket
  );
  const setWsConnected = useGlobalStore((s) => s.setWsConnected);
  const setWsReconnecting = useGlobalStore((s) => s.setWsReconnecting);

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

  const showNotificationToast = useCallback(
    (data: WsNotificationData) => {
      const params = data.params as Record<string, string | number>;
      const title = translateStatic(`notif.${data.type}.title`, undefined);
      const text = title === `notif.${data.type}.title` ? data.title ?? "" : title;
      const message = interpolateTitle(text, params);
      const action = data.action_url
        ? {
            label: translateStatic("notifications.viewDetails"),
            onClick: () => router.push(data.action_url as string),
          }
        : undefined;
      const opts = action ? { action } : undefined;
      // 配色按 type 推导，与铃铛行（NotificationItem）共用同一 getNotificationVariant，
      // 二者绝不失配（如 visual_failed 失败 → 两处都红，而非 toast 绿、行内红）。
      switch (getNotificationVariant(data.type)) {
        case "error":
          notifyError(message, opts);
          break;
        case "warning":
          notifyWarning(message, opts);
          break;
        case "info":
          notifyInfo(message, opts);
          break;
        default:
          notifySuccess(message, opts);
      }
    },
    [router]
  );

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      let response: WebSocketMessage;
      try {
        response = JSON.parse(event.data);
      } catch (err) {
        console.warn("[ws] failed to parse message", err);
        return;
      }

      // Auth handshake (legacy data.type === "authenticated")
      if (response.data?.type === "authenticated") {
        isAuthenticatedRef.current = true;
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
        }
        setWsConnected(true);
        setWsReconnecting(false);
        reconnectAttemptsRef.current = 0;
        stopPolling();
        // 重连兜底：补离线期间漏掉的通知。
        loadNotifications();
        refreshUnread();
        return;
      }

      try {
        routeWebSocketMessage(
          response,
          buildWsRouterDeps({
            addNotificationFromWebSocket,
            updateTask,
            loadNotifications,
            refreshUnread,
            showNotificationToast,
          })
        );
      } catch (err) {
        console.warn("[ws] failed to handle message", err);
      }
    },
    [
      addNotificationFromWebSocket,
      updateTask,
      loadNotifications,
      refreshUnread,
      showNotificationToast,
      setWsConnected,
      setWsReconnecting,
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

  // 窗口重新可见时兜底重取列表 + 未读数（增量推送会漏掉离线期间的事件）。
  useEffect(() => {
    if (!authUser) return;
    const handler = makeVisibilityRefetch(loadNotifications, refreshUnread);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [authUser, loadNotifications, refreshUnread]);

  return {
    wsConnected: useGlobalStore((state) => state.wsConnected),
    wsReconnecting: useGlobalStore((state) => state.wsReconnecting),
    disconnect,
    reconnect: connect,
  };
}
