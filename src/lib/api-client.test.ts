import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"
import { createAPIClient } from "./api-client"

// 后端/nginx 接受了连接却永不响应（过载、worker 卡死、上游断开）时，request() 之前没有超时，
// 返回的 Promise 永不 settle —— loading 永转、mutation 永不回报。这里锁定：请求必须在超时后
// 以 ApiError 拒绝，而不是无限挂起。
describe("api-client request timeout/abort", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it(
    "rejects with an ApiError instead of hanging forever when the backend never responds",
    async () => {
      // fetch 永不 resolve，但遵守 abort 信号：被中断时按 AbortError 拒绝（贴近真实 fetch 行为）。
      const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"))
          })
        })
      })
      vi.stubGlobal("fetch", fetchMock)

      // token 显式传入 → 跳过 getToken()，请求直接发起。
      const client = createAPIClient("test-token")
      // 同步挂上 catch，推进定时器期间不产生未处理拒绝。
      const settled = client.getTasks().catch((e: unknown) => e)

      // 推进到超时点：AbortController 触发 → fetch 拒绝 → request 捕获并抛 ApiError。
      await vi.advanceTimersByTimeAsync(30_000)

      const result = await settled
      expect(result).toBeInstanceOf(ApiError)
      expect((result as ApiError).code).toBe(50000)
    },
    2_000
  )
})

// 网关 5xx 返回 HTML、空体或被截断的 body 不是 {code,message,data,traceId} 信封。
// 之前 request() 无条件 response.json()，解析失败被压成 50000/"client_error"，真实 HTTP
// status 与 X-Trace-Id 全部丢失，线上故障无法定位。这里锁定：非信封响应必须把真实 HTTP
// status 与 trace header 带进 ApiError。
describe("api-client non-envelope / HTTP-error responses", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("preserves the real HTTP status and trace header when the body is not the JSON envelope", async () => {
    const response = new Response("<html><body>502 Bad Gateway</body></html>", {
      status: 502,
      headers: { "Content-Type": "text/html", "X-Trace-Id": "trace-abc-123" },
    })
    const fetchMock = vi.fn(async () => response)
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    const err = await client.getTasks().catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).httpStatus).toBe(502)
    expect((err as ApiError).traceId).toBe("trace-abc-123")
  })
})

// 401 自动刷新重试：之前重试复用首个 AbortController，若首个已到超时点被 abort，
// 重试会立刻 AbortError。这里锁定：重试必须用全新的 abort 信号。
describe("api-client 401 retry uses a fresh AbortController", () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("retries the 401 with a new abort signal, not the original one", async () => {
    // 一个未过期的存储 token，让 store.getAccessToken 直接返回它（不触发网络刷新）。
    localStorage.setItem("auth_access_token", "fresh-token")
    localStorage.setItem("auth_refresh_token", "rt")
    localStorage.setItem("auth_token_expiry", String(Date.now() + 600_000))

    let call = 0
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
      call += 1
      if (call === 1) return new Response("unauth", { status: 401 })
      return new Response(JSON.stringify({ code: 0, message: "ok", data: { ok: true }, traceId: "t" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    // 初始 Authorization 为 "test-token"，与刷新后的 "fresh-token" 不同 → 触发重试。
    const client = createAPIClient("test-token")
    await client.getTasks()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const sig1 = (fetchMock.mock.calls[0][1] as RequestInit).signal
    const sig2 = (fetchMock.mock.calls[1][1] as RequestInit).signal
    expect(sig1).toBeTruthy()
    expect(sig2).toBeTruthy()
    expect(sig2).not.toBe(sig1)
  })
})

// 媒体/SSE 短票签发：替代把长效 access JWT 拼进 ?token=。这里锁定端点路径、方法与
// summary_type 的 URL 编码（resource 绑定靠 task_id + summary_type）。
describe("api-client media/stream ticket minting", () => {
  function envelope(data: unknown): Response {
    return new Response(JSON.stringify({ code: 0, message: "ok", data, traceId: "t" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("mintMediaTicket POSTs to /media/ticket and returns the ticket payload", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({ token: "mt", expires_in: 300 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    const res = await client.mintMediaTicket()

    expect(res).toEqual({ token: "mt", expires_in: 300 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/media\/ticket$/)
    expect(init?.method).toBe("POST")
  })

  it("mintStreamTicket POSTs to the task+type-scoped stream-ticket endpoint", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({ token: "st", expires_in: 300 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    const res = await client.mintStreamTicket("task1", "overview")

    expect(res).toEqual({ token: "st", expires_in: 300 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/summaries/task1/stream-ticket?summary_type=overview")
    expect(init?.method).toBe("POST")
  })

  it("URL-encodes the summary_type", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({ token: "st", expires_in: 300 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    await client.mintStreamTicket("task1", "visual_mind map")

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("summary_type=visual_mind%20map")
  })
})
