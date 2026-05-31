import { describe, expect, it, vi } from "vitest"
import { normalizeApiBaseUrl, attachSseServerErrorListener } from "./summary-stream"

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
