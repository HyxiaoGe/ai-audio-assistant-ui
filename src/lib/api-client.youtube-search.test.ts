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

beforeEach(() => {
  localStorage.clear()
  getTokenMock.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("APIClient.searchYouTube", () => {
  it("anonymous search hits /youtube/search with q and skips the auth-token gate", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({ query: "cats", items: [], cached: false }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("logged-in-token")
    const res = await client.searchYouTube("cats")

    expect(res.cached).toBe(false)
    expect(getTokenMock).not.toHaveBeenCalled()
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/youtube/search?")
    expect(url).toContain("q=cats")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers["Authorization"]).toBeUndefined()
  })

  it("authenticated search attaches the bearer token", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({ query: "cats", items: [], cached: false }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("tok-123")
    await client.searchYouTube("cats", { authenticated: true })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer tok-123")
  })
})

describe("APIClient.getYouTubeTrending", () => {
  it("requests /youtube/search/trending anonymously", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => envelope({ items: [{ query: "news", count: 3 }] }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient()
    const res = await client.getYouTubeTrending({ limit: 5 })

    expect(res.items[0].query).toBe("news")
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/youtube/search/trending?")
    expect(url).toContain("limit=5")
  })
})
