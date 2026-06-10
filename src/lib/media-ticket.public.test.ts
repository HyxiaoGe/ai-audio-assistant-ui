import { afterEach, describe, expect, it, vi } from "vitest"

const mockApi = vi.hoisted(() => ({
  mintMediaTicket: vi.fn(),
  mintPublicMediaTicket: vi.fn(),
}))

vi.mock("@/lib/api-client", () => ({ apiClient: mockApi }))

import { clearMediaTicket, getMediaTicket, setPublicMediaTask } from "./media-ticket"

afterEach(() => {
  setPublicMediaTask(null)
  clearMediaTicket()
  vi.clearAllMocks()
})

describe("公开任务媒体票签发通道", () => {
  it("公开模式经公开端点签发并缓存复用", async () => {
    mockApi.mintPublicMediaTicket.mockResolvedValue({ token: "pub-1", expires_in: 300 })
    setPublicMediaTask("task-a")
    expect(await getMediaTicket()).toBe("pub-1")
    expect(await getMediaTicket()).toBe("pub-1")
    expect(mockApi.mintPublicMediaTicket).toHaveBeenCalledTimes(1)
    expect(mockApi.mintPublicMediaTicket).toHaveBeenCalledWith("task-a")
    expect(mockApi.mintMediaTicket).not.toHaveBeenCalled()
  })

  it("切任务/退出公开模式立即作废旧票", async () => {
    mockApi.mintPublicMediaTicket.mockResolvedValueOnce({ token: "pub-a", expires_in: 300 })
    setPublicMediaTask("task-a")
    expect(await getMediaTicket()).toBe("pub-a")

    mockApi.mintPublicMediaTicket.mockResolvedValueOnce({ token: "pub-b", expires_in: 300 })
    setPublicMediaTask("task-b") // A 的票绝不能复用给 B
    expect(await getMediaTicket()).toBe("pub-b")

    mockApi.mintMediaTicket.mockResolvedValue({ token: "user-1", expires_in: 300 })
    setPublicMediaTask(null) // 回私有通道,公开票不再命中
    expect(await getMediaTicket()).toBe("user-1")
    expect(mockApi.mintMediaTicket).toHaveBeenCalledTimes(1)
  })

  it("同值幂等:重复 set 同一任务不清缓存", async () => {
    mockApi.mintPublicMediaTicket.mockResolvedValue({ token: "pub-1", expires_in: 300 })
    setPublicMediaTask("task-a")
    expect(await getMediaTicket()).toBe("pub-1")
    setPublicMediaTask("task-a")
    expect(await getMediaTicket()).toBe("pub-1")
    expect(mockApi.mintPublicMediaTicket).toHaveBeenCalledTimes(1)
  })

  it("签发失败不缓存,下次调用重试", async () => {
    setPublicMediaTask("task-a")
    mockApi.mintPublicMediaTicket.mockRejectedValueOnce(new Error("net"))
    expect(await getMediaTicket()).toBeNull()
    mockApi.mintPublicMediaTicket.mockResolvedValueOnce({ token: "pub-2", expires_in: 300 })
    expect(await getMediaTicket()).toBe("pub-2")
  })
})
