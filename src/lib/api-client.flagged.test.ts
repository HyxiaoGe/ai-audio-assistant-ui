import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAPIClient } from "./api-client"

describe("api-client flagged channels", () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  function stubFetch(data: unknown) {
    const calls: { url: string; method: string; body: string | null }[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: String(init?.method ?? "GET"),
        body: (init?.body as string) ?? null,
      })
      return new Response(
        JSON.stringify({ code: 0, message: "成功", data, traceId: "t-1" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    })
    vi.stubGlobal("fetch", fetchMock)
    return { calls }
  }

  const sample = {
    id: "f1", match_field: "channel_id", match_value: "UCabc",
    channel_id: "UCabc", channel_handle: null, channel_name: "Evil",
    block_count: 3, last_video_id: "v1", last_title: "t",
    status: "pending", first_flagged_at: null, last_flagged_at: null,
  }

  it("GETs /admin/flagged-channels and unwraps items", async () => {
    const { calls } = stubFetch({ items: [sample] })
    const client = createAPIClient("test-token")
    const result = await client.getFlaggedChannels()
    expect(calls[0].url).toContain("/admin/flagged-channels")
    expect(calls[0].method).toBe("GET")
    expect(result.items[0].channel_name).toBe("Evil")
  })

  it("POSTs /admin/flagged-channels/:id/resolve with action+note", async () => {
    const { calls } = stubFetch({ ...sample, status: "blocked" })
    const client = createAPIClient("test-token")
    const result = await client.resolveFlaggedChannel("f1", { action: "block", note: "spam" })
    expect(calls[0].url).toContain("/admin/flagged-channels/f1/resolve")
    expect(calls[0].method).toBe("POST")
    expect(JSON.parse(calls[0].body as string)).toEqual({ action: "block", note: "spam" })
    expect(result.status).toBe("blocked")
  })
})
