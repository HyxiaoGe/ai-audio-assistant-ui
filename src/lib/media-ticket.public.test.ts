import { afterEach, describe, expect, it, vi } from "vitest"

const mockApi = vi.hoisted(() => ({
  mintMediaTicket: vi.fn(),
  mintPublicMediaTicket: vi.fn(),
}))

vi.mock("@/lib/api-client", () => ({ apiClient: mockApi }))

import {
  clearMediaTicket,
  getMediaTicket,
  getMediaTicketSync,
  releasePublicMediaTask,
  setPublicMediaTask,
} from "./media-ticket"

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

describe("在途跨通道丢弃与加固语义", () => {
  it("在途期间切换通道:resolve 后旧结果不落缓存,新通道触发重新签发", async () => {
    let resolveA!: (v: { token: string; expires_in: number }) => void
    mockApi.mintPublicMediaTicket.mockReturnValueOnce(
      new Promise((res) => {
        resolveA = res
      }),
    )
    setPublicMediaTask("task-a")
    const inflightPromise = getMediaTicket() // 触发 task-a 在途签发

    // 在 resolve 之前切走通道
    setPublicMediaTask("task-b")

    // resolve A 的 promise
    resolveA({ token: "pub-a", expires_in: 300 })
    const result = await inflightPromise

    // 返回值照旧(调用方拿到)
    expect(result).toBe("pub-a")

    // 但旧结果未落缓存:新通道(task-b)下再调用应触发新的签发
    mockApi.mintPublicMediaTicket.mockResolvedValueOnce({ token: "pub-b", expires_in: 300 })
    const newResult = await getMediaTicket()
    expect(newResult).toBe("pub-b")
    expect(mockApi.mintPublicMediaTicket).toHaveBeenLastCalledWith("task-b")
  })

  it("公开通道下 getMediaTicketSync:签发后命中;setPublicMediaTask(null) 后立即 null", async () => {
    mockApi.mintPublicMediaTicket.mockResolvedValue({ token: "pub-sync", expires_in: 300 })
    setPublicMediaTask("task-a")
    await getMediaTicket()
    // 通道匹配,sync 命中
    expect(getMediaTicketSync()).toBe("pub-sync")

    // 切回私有,sync 不再命中(channel 不匹配)
    setPublicMediaTask(null)
    expect(getMediaTicketSync()).toBeNull()
  })

  it("clearMediaTicket 不重置公开通道:清票后再签发仍走公开端点", async () => {
    mockApi.mintPublicMediaTicket
      .mockResolvedValueOnce({ token: "pub-1", expires_in: 300 })
      .mockResolvedValueOnce({ token: "pub-2", expires_in: 300 })
    setPublicMediaTask("task-a")
    await getMediaTicket()

    // 清票(模拟登出)
    clearMediaTicket()

    // 再次签发应走公开端点,而非私有端点
    const next = await getMediaTicket()
    expect(next).toBe("pub-2")
    expect(mockApi.mintPublicMediaTicket).toHaveBeenCalledTimes(2)
    expect(mockApi.mintMediaTicket).not.toHaveBeenCalled()
  })

  it("releasePublicMediaTask 比对语义:id 不匹配不动通道,匹配才回落私有", async () => {
    mockApi.mintPublicMediaTicket
      .mockResolvedValueOnce({ token: "pub-b", expires_in: 300 })
      .mockResolvedValueOnce({ token: "pub-b2", expires_in: 300 })
    setPublicMediaTask("task-b")
    await getMediaTicket()

    // 旧页 A 的 cleanup 传 task-a:通道是 task-b,不匹配,不动
    releasePublicMediaTask("task-a")
    // 仍走 b 的公开端点(缓存未清)
    expect(getMediaTicketSync()).toBe("pub-b")

    // 页 B 的 cleanup 传 task-b:匹配,回落私有
    releasePublicMediaTask("task-b")
    expect(getMediaTicketSync()).toBeNull()

    // 此后签发应走私有端点
    mockApi.mintMediaTicket.mockResolvedValueOnce({ token: "user-1", expires_in: 300 })
    expect(await getMediaTicket()).toBe("user-1")
    expect(mockApi.mintMediaTicket).toHaveBeenCalledTimes(1)
  })
})
