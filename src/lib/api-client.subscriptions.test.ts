import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getTokenMock = vi.hoisted(() =>
  vi.fn<() => Promise<string | null>>(() => new Promise<string | null>(() => {})),
)
vi.mock("@/lib/auth-token", () => ({ getToken: getTokenMock }))

import { createAPIClient } from "./api-client"

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, message: "ok", data, traceId: "t" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

const SUBS_PAGE = { items: [], total: 0, page: 1, page_size: 20 }

function stubFetch() {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => envelope(SUBS_PAGE),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  localStorage.clear()
  getTokenMock.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("APIClient.getYouTubeSubscriptions 的 search 参数(全局搜索)", () => {
  it("提供 search 时把它带进 /youtube/subscriptions 查询串", async () => {
    const fetchMock = stubFetch()
    const client = createAPIClient("tok")
    await client.getYouTubeSubscriptions({ page: 1, page_size: 20, search: "tech" })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/youtube/subscriptions?")
    expect(url).toContain("search=tech")
  })

  it("search 前后空白被去除后再发送", async () => {
    const fetchMock = stubFetch()
    const client = createAPIClient("tok")
    await client.getYouTubeSubscriptions({ search: "  tech  " })

    // 未 trim 会编码成 search=++tech++;这里应为干净的 search=tech
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("search=tech")
  })

  it("search 为纯空白时不带 search 参数(退化为普通分页)", async () => {
    const fetchMock = stubFetch()
    const client = createAPIClient("tok")
    await client.getYouTubeSubscriptions({ page: 2, page_size: 20, search: "   " })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).not.toContain("search=")
    expect(url).toContain("page=2")
  })

  it("未提供 search 时不带 search 参数", async () => {
    const fetchMock = stubFetch()
    const client = createAPIClient("tok")
    await client.getYouTubeSubscriptions({ page: 1, page_size: 20 })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).not.toContain("search=")
  })
})
