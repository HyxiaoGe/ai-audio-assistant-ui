import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 公开方法免 token 通道：后端 /public/* 零鉴权不读 Authorization，但旧实现每个请求都先
// await getAuthToken —— 登录用户 token 临期时，公开请求会被同一次经隧道(0.5-1.5s)的
// refresh 集体闸住。这里锁定：5 个公开方法既不等 token、也不挂 Authorization。

// getToken 永不 resolve = 模拟「refresh 被慢隧道闸住」的最坏情形。
// 公开方法若误走了 getAuthToken，用例会以超时失败的方式暴露。
const getTokenMock = vi.hoisted(() =>
  vi.fn<() => Promise<string | null>>(() => new Promise<string | null>(() => {}))
)
vi.mock("@/lib/auth-token", () => ({
  getToken: getTokenMock,
}))

import { createAPIClient } from "./api-client"

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, message: "ok", data, traceId: "t" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  localStorage.clear()
  getTokenMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("api-client public methods skip the auth-token gate", () => {
  it("resolves public calls without awaiting getToken even when token refresh hangs", async () => {
    const fetchMock = vi.fn(async () => envelope({ items: [], total: 0, page: 1, page_size: 12 }))
    vi.stubGlobal("fetch", fetchMock)

    // 不传 token 的客户端：私有路径会走 getToken()（此处永不 resolve）；
    // 公开方法必须完全绕过它、立即发出请求。
    const client = createAPIClient()
    await client.getPublicTasks({ page: 1 })

    expect(getTokenMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("sends no Authorization header on all 5 public methods, even when the client holds a token", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({})
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("logged-in-token")
    await client.getPublicTasks()
    await client.getPublicTask("t1")
    await client.getPublicTranscript("t1")
    await client.getPublicSummary("t1")
    await client.mintPublicMediaTicket("t1")

    expect(fetchMock).toHaveBeenCalledTimes(5)
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls[0]).toMatch(/\/public\/tasks$/)
    expect(urls[1]).toMatch(/\/public\/tasks\/t1$/)
    expect(urls[2]).toMatch(/\/public\/tasks\/t1\/transcripts$/)
    expect(urls[3]).toMatch(/\/public\/tasks\/t1\/summaries$/)
    expect(urls[4]).toMatch(/\/public\/tasks\/t1\/media-ticket$/)
    for (const [, init] of fetchMock.mock.calls) {
      const headers = init?.headers as Record<string, string>
      expect(headers["Authorization"]).toBeUndefined()
      // 信封解析所需的语言/类型头照常携带（免 token 只去鉴权，不动其余请求语义）。
      expect(headers["Accept-Language"]).toBeTruthy()
    }
  })

  it("keeps attaching Authorization on private methods (the variant does not leak)", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({ items: [], total: 0, page: 1, page_size: 10 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("logged-in-token")
    await client.getTasks()

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer logged-in-token")
  })
})
