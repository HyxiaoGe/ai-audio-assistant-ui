import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 媒体短票缓存：一次签发、跨页复用、临期刷新、并发共享、失败不缓存、可清除。
// mock 掉 api-client，仅暴露 mintMediaTicket，避免拉起它的全部依赖。
const mint = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock("@/lib/api-client", () => ({
  apiClient: { mintMediaTicket: mint.fn },
}))

import { clearMediaTicket, getMediaTicket, getMediaTicketSync } from "./media-ticket"

describe("media-ticket cache", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    mint.fn.mockReset()
    clearMediaTicket()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("mints once and reuses the cached ticket within its TTL", async () => {
    mint.fn.mockResolvedValue({ token: "t1", expires_in: 300 })
    expect(await getMediaTicket()).toBe("t1")
    expect(await getMediaTicket()).toBe("t1")
    expect(mint.fn).toHaveBeenCalledTimes(1)
  })

  it("re-mints once the ticket nears expiry", async () => {
    mint.fn
      .mockResolvedValueOnce({ token: "t1", expires_in: 300 })
      .mockResolvedValueOnce({ token: "t2", expires_in: 300 })
    expect(await getMediaTicket()).toBe("t1")
    vi.setSystemTime(300_000) // 300s 后，已过 (300-30) 的刷新阈值
    expect(await getMediaTicket()).toBe("t2")
    expect(mint.fn).toHaveBeenCalledTimes(2)
  })

  it("getMediaTicketSync: null before mint, cached value after, null once stale", async () => {
    expect(getMediaTicketSync()).toBeNull()
    mint.fn.mockResolvedValue({ token: "t1", expires_in: 300 })
    await getMediaTicket()
    expect(getMediaTicketSync()).toBe("t1")
    vi.setSystemTime(300_000)
    expect(getMediaTicketSync()).toBeNull()
  })

  it("shares a single in-flight mint across concurrent callers", async () => {
    let resolveMint: (value: { token: string; expires_in: number }) => void = () => {}
    mint.fn.mockReturnValue(
      new Promise((resolve) => {
        resolveMint = resolve
      }),
    )
    const p1 = getMediaTicket()
    const p2 = getMediaTicket()
    resolveMint({ token: "t1", expires_in: 300 })
    expect(await p1).toBe("t1")
    expect(await p2).toBe("t1")
    expect(mint.fn).toHaveBeenCalledTimes(1)
  })

  it("returns null and does not cache on mint failure, retrying on the next call", async () => {
    mint.fn
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ token: "t1", expires_in: 300 })
    expect(await getMediaTicket()).toBeNull()
    expect(getMediaTicketSync()).toBeNull()
    expect(await getMediaTicket()).toBe("t1")
    expect(mint.fn).toHaveBeenCalledTimes(2)
  })

  it("clearMediaTicket drops the cache so the next call re-mints", async () => {
    mint.fn.mockResolvedValue({ token: "t1", expires_in: 300 })
    await getMediaTicket()
    clearMediaTicket()
    expect(getMediaTicketSync()).toBeNull()
    await getMediaTicket()
    expect(mint.fn).toHaveBeenCalledTimes(2)
  })
})
