import { describe, expect, it, vi } from "vitest"
import {
  normalizeApiBaseUrl,
  attachSseServerErrorListener,
  createSummaryStreamErrorHandler,
} from "./summary-stream"

// 摘要 SSE 引擎里被 regenerate / compare 两处逐字复制的脚手架（audit #8 子步骤 ④）。
// 抽出为纯函数/小助手并锁定行为，消除两套引擎已经发生过的漂移风险。

describe("normalizeApiBaseUrl", () => {
  it("appends /api/v1 to an empty base", () => {
    expect(normalizeApiBaseUrl("")).toBe("/api/v1")
  })

  it("appends /api/v1 to a bare origin", () => {
    expect(normalizeApiBaseUrl("https://x.com")).toBe("https://x.com/api/v1")
  })

  it("strips a trailing slash before appending /api/v1", () => {
    expect(normalizeApiBaseUrl("https://x.com/")).toBe("https://x.com/api/v1")
  })

  it("leaves an already-normalized /api/v1 base unchanged", () => {
    expect(normalizeApiBaseUrl("https://x.com/api/v1")).toBe("https://x.com/api/v1")
  })

  it("strips a trailing slash from an /api/v1/ base", () => {
    expect(normalizeApiBaseUrl("https://x.com/api/v1/")).toBe("https://x.com/api/v1")
  })
})

describe("attachSseServerErrorListener", () => {
  function fakeSource() {
    let errorListener: ((event: MessageEvent) => void) | null = null
    return {
      addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
        if (type === "error") errorListener = listener
      },
      emitError: (data: string) => errorListener?.({ data } as MessageEvent),
    }
  }

  it("registers an `error` listener and forwards the server message", () => {
    const source = fakeSource()
    const onError = vi.fn()
    attachSseServerErrorListener(source, onError)

    source.emitError('{"message":"boom"}')
    expect(onError).toHaveBeenCalledWith("boom")
  })

  it("calls onError with no argument when the error payload is not JSON", () => {
    const source = fakeSource()
    const onError = vi.fn()
    attachSseServerErrorListener(source, onError)

    source.emitError("not json")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith()
  })
})

// regenerate 引擎里，流在 connected 之前出错（onerror / 服务端 error 事件）时，原 handleStreamError
// 只 startPolling 而从不触发 regenerate：connected 与 connectionTimeout 都没机会触发，后端从未收到
// regenerate 请求，轮询会永远等待一个不出现的新版本。锁定：错误处理器必须先幂等补发 regenerate 再轮询。
describe("createSummaryStreamErrorHandler", () => {
  it("fires regenerate before falling back to polling on a stream error", () => {
    const order: string[] = []
    const cleanup = vi.fn(() => order.push("cleanup"))
    const triggerRegenerate = vi.fn(() => {
      order.push("trigger")
      return Promise.resolve()
    })
    const startPolling = vi.fn(() => order.push("poll"))

    const handle = createSummaryStreamErrorHandler({ cleanup, triggerRegenerate, startPolling })
    handle("boom")

    expect(cleanup).toHaveBeenCalledWith("boom")
    expect(triggerRegenerate).toHaveBeenCalledTimes(1)
    expect(startPolling).toHaveBeenCalledTimes(1)
    expect(order).toEqual(["cleanup", "trigger", "poll"])
  })

  it("does not throw and still starts polling when the regenerate request rejects", async () => {
    const startPolling = vi.fn()
    const triggerRegenerate = vi.fn(() => Promise.reject(new Error("regen failed")))

    const handle = createSummaryStreamErrorHandler({
      cleanup: vi.fn(),
      triggerRegenerate,
      startPolling,
    })

    expect(() => handle()).not.toThrow()
    expect(triggerRegenerate).toHaveBeenCalledTimes(1)
    expect(startPolling).toHaveBeenCalledTimes(1)
    // 排空微任务队列，确认被吞掉的拒绝不会变成 unhandled rejection。
    await Promise.resolve()
    await Promise.resolve()
  })
})
