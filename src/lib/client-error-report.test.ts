import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 每个用例拿一份全新模块,隔离模块级的去重/计数状态。
async function loadReporter() {
  vi.resetModules()
  return await import("./client-error-report")
}

// jsdom 的 Blob 未实现 .text(),用 FileReader 读出文本。
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsText(blob)
  })
}

describe("client-error-report: 前端错误上报(best-effort, never throws)", () => {
  let beacon: ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    beacon = vi.fn(() => true)
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true, writable: true })
    fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("用 sendBeacon 以 application/json 发到 /api/v1/client-errors", async () => {
    const { reportClientError } = await loadReporter()
    reportClientError({ message: "Boom", source: "error_boundary", stack: "at x", digest: "d1" })
    expect(beacon).toHaveBeenCalledTimes(1)
    const [url, blob] = beacon.mock.calls[0] as [string, Blob]
    expect(url).toBe("/api/v1/client-errors")
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe("application/json")
    const body = JSON.parse(await blobText(blob))
    expect(body.message).toBe("Boom")
    expect(body.source).toBe("error_boundary")
    expect(body.stack).toBe("at x")
    expect(body.digest).toBe("d1")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sendBeacon 不可用时回落 keepalive fetch", async () => {
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true, writable: true })
    const { reportClientError } = await loadReporter()
    reportClientError({ message: "Boom", source: "window.onerror" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/v1/client-errors")
    expect(init.method).toBe("POST")
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string).message).toBe("Boom")
  })

  it("sendBeacon 返回 false(队列满)时回落 fetch", async () => {
    beacon.mockReturnValue(false)
    const { reportClientError } = await loadReporter()
    reportClientError({ message: "Boom", source: "x" })
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("两个传输都抛错也绝不向外抛(它本就跑在错误边界里)", async () => {
    beacon.mockImplementation(() => {
      throw new Error("beacon broke")
    })
    fetchMock.mockImplementation(() => {
      throw new Error("fetch broke")
    })
    const { reportClientError } = await loadReporter()
    expect(() => reportClientError({ message: "Boom", source: "x" })).not.toThrow()
  })

  it("窗口内相同 message+source 去重(防错误循环刷屏)", async () => {
    const { reportClientError } = await loadReporter()
    reportClientError({ message: "Same", source: "s" })
    reportClientError({ message: "Same", source: "s" })
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  it("单次会话有上报次数上限(防失控循环烧预算)", async () => {
    const { reportClientError } = await loadReporter()
    for (let i = 0; i < 50; i++) {
      reportClientError({ message: `m${i}`, source: "s" }) // 各不相同,绕过去重
    }
    expect(beacon.mock.calls.length).toBeGreaterThan(0)
    expect(beacon.mock.calls.length).toBeLessThanOrEqual(20)
  })
})

describe("installGlobalErrorListeners: 全局未捕获错误监听", () => {
  let beacon: ReturnType<typeof vi.fn>

  beforeEach(() => {
    beacon = vi.fn(() => true)
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function blobPayload(): Promise<Record<string, unknown>> {
    const blob = beacon.mock.calls[0][1] as Blob
    return JSON.parse(await blobText(blob))
  }

  it("上报 window 'error' 事件(source=window.onerror)", async () => {
    const { installGlobalErrorListeners } = await loadReporter()
    const cleanup = installGlobalErrorListeners()
    window.dispatchEvent(new ErrorEvent("error", { message: "kaboom", error: new Error("kaboom") }))
    cleanup()
    expect(beacon).toHaveBeenCalledTimes(1)
    const body = await blobPayload()
    expect(body.source).toBe("window.onerror")
    expect(body.message).toContain("kaboom")
  })

  it("上报 unhandledrejection(source=unhandledrejection,带 reason)", async () => {
    const { installGlobalErrorListeners } = await loadReporter()
    const cleanup = installGlobalErrorListeners()
    const ev = new Event("unhandledrejection") as Event & { reason?: unknown }
    ev.reason = new Error("promise blew up")
    window.dispatchEvent(ev)
    cleanup()
    expect(beacon).toHaveBeenCalledTimes(1)
    const body = await blobPayload()
    expect(body.source).toBe("unhandledrejection")
    expect(body.message).toContain("promise blew up")
  })

  it("cleanup 后不再监听(移除 listener)", async () => {
    const { installGlobalErrorListeners } = await loadReporter()
    const cleanup = installGlobalErrorListeners()
    cleanup()
    window.dispatchEvent(new ErrorEvent("error", { message: "after cleanup" }))
    expect(beacon).not.toHaveBeenCalled()
  })
})
