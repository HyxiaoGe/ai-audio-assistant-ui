import { describe, expect, it, vi } from "vitest"
import { routeWebSocketMessage } from "./ws-message-router"

function makeDeps() {
  return {
    addNotificationFromWebSocket: vi.fn(),
    updateTask: vi.fn(),
    loadNotifications: vi.fn(),
    refreshUnread: vi.fn(),
    showNotificationToast: vi.fn(),
    applyImageReady: vi.fn(),
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

describe("routeWebSocketMessage — task_progress", () => {
  it("updates the task map and does NOT touch notifications", () => {
    const deps = makeDeps()
    const data = {
      task_id: "t9",
      status: "processing",
      stage: "transcribing",
      progress: 42,
      task_title: "Lecture",
    }

    routeWebSocketMessage({ kind: "task_progress", data, traceId: "tr9" }, deps)

    expect(deps.updateTask).toHaveBeenCalledTimes(1)
    expect(deps.updateTask).toHaveBeenCalledWith("t9", data)
    expect(deps.addNotificationFromWebSocket).not.toHaveBeenCalled()
    expect(deps.showNotificationToast).not.toHaveBeenCalled()
  })

  it("ignores a task_progress envelope missing task_id without throwing", () => {
    const deps = makeDeps()
    expect(() =>
      routeWebSocketMessage(
        { kind: "task_progress", data: { progress: 10 }, traceId: "tr10" },
        deps
      )
    ).not.toThrow()
    expect(deps.updateTask).not.toHaveBeenCalled()
  })
})

describe("routeWebSocketMessage — resilience", () => {
  it("does nothing for an unknown kind", () => {
    const deps = makeDeps()
    routeWebSocketMessage(
      { kind: "totally_unknown", data: {}, traceId: "x" },
      deps
    )
    expect(deps.addNotificationFromWebSocket).not.toHaveBeenCalled()
    expect(deps.updateTask).not.toHaveBeenCalled()
    expect(deps.showNotificationToast).not.toHaveBeenCalled()
    expect(deps.loadNotifications).not.toHaveBeenCalled()
    expect(deps.applyImageReady).not.toHaveBeenCalled()
  })

  it("does not throw on an envelope with no kind", () => {
    const deps = makeDeps()
    expect(() =>
      routeWebSocketMessage({ traceId: "y" } as never, deps)
    ).not.toThrow()
  })

  it("ignores a notification envelope missing payload/id without throwing or touching deps", () => {
    const deps = makeDeps()
    expect(() =>
      routeWebSocketMessage({ kind: "notification", traceId: "z" }, deps)
    ).not.toThrow()
    expect(deps.addNotificationFromWebSocket).not.toHaveBeenCalled()
    expect(deps.showNotificationToast).not.toHaveBeenCalled()
  })
})

describe("routeWebSocketMessage — image_ready", () => {
  it("forwards a well-formed FLAT image_ready to applyImageReady and touches nothing else", () => {
    const deps = makeDeps()
    // 后端 image_ready 是【扁平】信封：字段与 kind 同级、无 data 包裹（image_generator.py
    // publish_image_ready_global）。router 把整个 envelope 当 payload 透传给 applyImageReady。
    const envelope = {
      kind: "image_ready",
      task_id: "t1",
      summary_id: "s1",
      summary_type: "overview",
      placeholder: "{{IMAGE: a}}",
      status: "ready",
      url: "/api/v1/summaries/images/a.png",
      model_id: "gemini",
      traceId: "ir1",
    }

    routeWebSocketMessage(envelope, deps)

    expect(deps.applyImageReady).toHaveBeenCalledTimes(1)
    expect(deps.applyImageReady).toHaveBeenCalledWith(envelope)
    expect(deps.updateTask).not.toHaveBeenCalled()
    expect(deps.addNotificationFromWebSocket).not.toHaveBeenCalled()
    expect(deps.showNotificationToast).not.toHaveBeenCalled()
  })

  it("ignores a flat image_ready missing placeholder without throwing", () => {
    const deps = makeDeps()
    // 先存变量再传：内联对象字面量直接作实参会触发 TS 超额属性检查（WsEnvelope 只声明 kind/data/traceId）。
    const envelope = { kind: "image_ready", task_id: "t1", status: "ready", traceId: "ir2" }
    expect(() => routeWebSocketMessage(envelope, deps)).not.toThrow()
    expect(deps.applyImageReady).not.toHaveBeenCalled()
  })

  it("ignores a legacy NESTED-data image_ready (backend sends flat, top-level fields absent)", () => {
    const deps = makeDeps()
    // 旧的嵌套形状（payload 包在 data 里）不符合后端扁平契约：顶层无 task_id/placeholder，
    // 守卫命中 → 忽略。此用例钉死「只认扁平信封」。
    routeWebSocketMessage(
      {
        kind: "image_ready",
        data: { task_id: "t1", placeholder: "{{IMAGE: a}}", status: "ready" },
        traceId: "ir3",
      },
      deps
    )
    expect(deps.applyImageReady).not.toHaveBeenCalled()
  })
})
