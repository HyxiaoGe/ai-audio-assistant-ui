import { describe, expect, it, vi, beforeEach } from "vitest"

// 复活的 store action 名（契约）：addNotificationFromWebSocket / refreshUnread。
const addNotificationFromWebSocket = vi.fn()
const updateTask = vi.fn()
const loadNotifications = vi.fn()
const refreshUnread = vi.fn()

vi.mock("@/store/global-store", () => ({
  useGlobalStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        addNotificationFromWebSocket,
        updateTask,
        loadNotifications,
        refreshUnread,
        setWsConnected: vi.fn(),
        setWsReconnecting: vi.fn(),
        wsConnected: false,
        wsReconnecting: false,
      }),
    { getState: () => ({}) }
  ),
}))

// 导入整个 hook 模块会顺带拉起 next/navigation；与仓内其他 hook/组件测试一致地打桩，
// 避免模块加载期触达真实 next 运行时。
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { buildWsRouterDeps } from "@/hooks/use-global-websocket"
import { routeWebSocketMessage } from "@/lib/ws-message-router"

describe("use-global-websocket message routing wiring", () => {
  beforeEach(() => {
    addNotificationFromWebSocket.mockClear()
    updateTask.mockClear()
    loadNotifications.mockClear()
    refreshUnread.mockClear()
  })

  it("a notification envelope inserts to store and fires one toast, with NO full reload", () => {
    const showNotificationToast = vi.fn()
    const deps = buildWsRouterDeps({
      addNotificationFromWebSocket,
      updateTask,
      loadNotifications,
      refreshUnread,
      showNotificationToast,
    })

    routeWebSocketMessage(
      {
        kind: "notification",
        data: {
          id: "n1",
          type: "task_completed",
          category: "task",
          priority: "normal",
          params: { task_title: "Demo" },
          action_url: "/tasks/t1",
          title: null,
          message: null,
          created_at: "2026-06-03T00:00:00Z",
          read_at: null,
        },
        traceId: "tr1",
      },
      deps
    )

    expect(addNotificationFromWebSocket).toHaveBeenCalledTimes(1)
    expect(showNotificationToast).toHaveBeenCalledTimes(1)
    expect(loadNotifications).not.toHaveBeenCalled()
  })

  it("a task_progress envelope updates the task map and does not touch notifications", () => {
    const showNotificationToast = vi.fn()
    const deps = buildWsRouterDeps({
      addNotificationFromWebSocket,
      updateTask,
      loadNotifications,
      refreshUnread,
      showNotificationToast,
    })

    routeWebSocketMessage(
      {
        kind: "task_progress",
        data: { task_id: "t9", status: "processing", progress: 30 },
        traceId: "tr9",
      },
      deps
    )

    expect(updateTask).toHaveBeenCalledWith("t9", {
      task_id: "t9",
      status: "processing",
      progress: 30,
    })
    expect(addNotificationFromWebSocket).not.toHaveBeenCalled()
    expect(showNotificationToast).not.toHaveBeenCalled()
  })
})
