import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAPIClient } from "./api-client"

describe("api-client youtube blocklist", () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function stubFetch(data: unknown): { calls: { url: string; method: string }[] } {
    const calls: { url: string; method: string }[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: String(init?.method ?? "GET") })
      return new Response(
        JSON.stringify({ code: 0, message: "成功", data, traceId: "t-1" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    })
    vi.stubGlobal("fetch", fetchMock)
    return { calls }
  }

  it("GETs /admin/youtube-blocklist and unwraps items", async () => {
    const { calls } = stubFetch({
      items: [
        { id: "e1", kind: "term", match_field: "query", raw_value: "bad", note: null, created_at: "2026-06-26T00:00:00Z" },
      ],
    })
    const client = createAPIClient("test-token")
    const result = await client.getYouTubeBlocklist()
    expect(calls[0].url).toContain("/admin/youtube-blocklist")
    expect(calls[0].method).toBe("GET")
    expect(result.items[0].raw_value).toBe("bad")
  })

  it("POSTs /admin/youtube-blocklist with kind+value", async () => {
    const { calls } = stubFetch({
      id: "e2", kind: "channel", match_field: "channel_name", raw_value: "Lex Fridman", note: null,
      created_at: "2026-06-26T00:00:00Z",
    })
    const client = createAPIClient("test-token")
    const result = await client.addYouTubeBlocklistEntry({ kind: "channel", value: "Lex Fridman" })
    expect(calls[0].url).toContain("/admin/youtube-blocklist")
    expect(calls[0].method).toBe("POST")
    expect(result.kind).toBe("channel")
  })

  it("DELETEs /admin/youtube-blocklist/:id", async () => {
    const { calls } = stubFetch(null)
    const client = createAPIClient("test-token")
    await client.deleteYouTubeBlocklistEntry("e1")
    expect(calls[0].url).toContain("/admin/youtube-blocklist/e1")
    expect(calls[0].method).toBe("DELETE")
  })
})
