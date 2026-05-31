import { afterEach, describe, expect, it, vi } from "vitest"
import { scheduleSingleFlightTimer, closeIfCurrent } from "./ws-lifecycle"

// 全局 WS 在网络抖动下的两类生命周期 bug：
// (1) reconnect() 调度前不清旧定时器 → 叠出多个并行 setTimeout → 拉起多条并行连接；
// (2) 被取代的旧 socket 的延迟 onclose 无条件清空 wsRef 并 reconnect() → 把活 socket 的 ref
//     置空并触发多余重连。这里把两条不变量抽成可测纯函数并锁定。

describe("scheduleSingleFlightTimer", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("clears the previous pending timer so only one callback fires (dedup)", () => {
    vi.useFakeTimers()
    const ref: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined }
    const run = vi.fn()

    scheduleSingleFlightTimer(ref, 1000, run)
    scheduleSingleFlightTimer(ref, 1000, run) // 第二次必须清掉第一次的挂起定时器

    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("runs the callback once after the delay when scheduled once", () => {
    vi.useFakeTimers()
    const ref: { current: ReturnType<typeof setTimeout> | undefined } = { current: undefined }
    const run = vi.fn()

    scheduleSingleFlightTimer(ref, 500, run)
    expect(run).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe("closeIfCurrent", () => {
  it("runs cleanup and clears the ref when the closed socket is the current one", () => {
    const sock = {} as WebSocket
    const ref: { current: WebSocket | null } = { current: sock }
    const onActiveClose = vi.fn()

    closeIfCurrent(ref, sock, onActiveClose)

    expect(onActiveClose).toHaveBeenCalledTimes(1)
    expect(ref.current).toBeNull()
  })

  it("ignores a superseded socket's close: keeps the live ref and skips cleanup", () => {
    const live = { id: "live" } as unknown as WebSocket
    const stale = { id: "stale" } as unknown as WebSocket
    const ref: { current: WebSocket | null } = { current: live }
    const onActiveClose = vi.fn()

    closeIfCurrent(ref, stale, onActiveClose)

    expect(onActiveClose).not.toHaveBeenCalled()
    expect(ref.current).toBe(live) // 活 socket 的 ref 不被旧 socket 的 onclose 清掉
  })

  it("clears the ref before cleanup so a reconnect inside cleanup is not clobbered", () => {
    const sock = {} as WebSocket
    const ref: { current: WebSocket | null } = { current: sock }

    closeIfCurrent(ref, sock, () => {
      expect(ref.current).toBeNull() // 进入 cleanup 时 ref 已清
      // 模拟 cleanup 内 reconnect() 写入新 socket
      ref.current = { id: "new" } as unknown as WebSocket
    })

    expect((ref.current as unknown as { id: string }).id).toBe("new") // 新连接的 ref 未被覆盖
  })
})
