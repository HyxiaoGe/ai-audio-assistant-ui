import { describe, expect, it, vi } from "vitest"
import { routeWebSocketMessage } from "./ws-message-router"

function makeDeps() {
  return {
    addNotificationFromWebSocket: vi.fn(),
    updateTask: vi.fn(),
    loadNotifications: vi.fn(),
    refreshUnread: vi.fn(),
    showNotificationToast: vi.fn(),
  }
}

describe("routeWebSocketMessage — notification", () => {
  it("inserts the notification into the store and fires exactly one toast", () => {
    const deps = makeDeps()
    const data = {
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
    }

    routeWebSocketMessage({ kind: "notification", data, traceId: "tr1" }, deps)

    expect(deps.addNotificationFromWebSocket).toHaveBeenCalledTimes(1)
    expect(deps.addNotificationFromWebSocket).toHaveBeenCalledWith(data)
    expect(deps.showNotificationToast).toHaveBeenCalledTimes(1)
    expect(deps.showNotificationToast).toHaveBeenCalledWith(data)
  })

  it("never calls the full loadNotifications reload on a notification (race root cause)", () => {
    const deps = makeDeps()
    routeWebSocketMessage(
      {
        kind: "notification",
        data: {
          id: "n2",
          type: "task_failed",
          category: "task",
          priority: "high",
          params: { error_code: "asr_timeout" },
          action_url: "/tasks/t2",
          title: null,
          message: null,
          created_at: "2026-06-03T00:00:00Z",
          read_at: null,
        },
        traceId: "tr2",
      },
      deps
    )

    expect(deps.loadNotifications).not.toHaveBeenCalled()
    expect(deps.refreshUnread).not.toHaveBeenCalled()
    expect(deps.updateTask).not.toHaveBeenCalled()
  })
})
