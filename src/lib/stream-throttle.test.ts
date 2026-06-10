import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createStreamThrottle } from "./stream-throttle"

// SSE delta 帧合并节流:锁定「合并窗口内多次 schedule 只 flush 一次」「flushNow 立即清余量
// 且取消在途定时器(不双发)」「cancel/cancelAll 丢弃而不 flush」的语义——TaskDetail 的
// summary.delta 高频 setState 整页重渲染问题靠这组语义砍渲染次数且绝不丢字。

describe("createStreamThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    // 本仓教训:fake timers 不恢复会污染后续文件/用例,务必 afterEach 还原。
    vi.useRealTimers()
  })

  it("merges multiple schedules inside one window into a single flush", () => {
    const flush = vi.fn()
    const throttle = createStreamThrottle<"overview">(flush, 100)

    throttle.schedule("overview")
    throttle.schedule("overview")
    throttle.schedule("overview")
    expect(flush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenCalledWith("overview")
  })

  it("starts a fresh window after a flush (subsequent deltas are not lost)", () => {
    const flush = vi.fn()
    const throttle = createStreamThrottle<"overview">(flush, 100)

    throttle.schedule("overview")
    vi.advanceTimersByTime(100)
    throttle.schedule("overview")
    vi.advanceTimersByTime(100)

    expect(flush).toHaveBeenCalledTimes(2)
  })

  it("tracks timers per key independently", () => {
    const flush = vi.fn()
    const throttle = createStreamThrottle<"overview" | "key_points">(flush, 100)

    throttle.schedule("overview")
    vi.advanceTimersByTime(50)
    throttle.schedule("key_points")

    vi.advanceTimersByTime(50)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenLastCalledWith("overview")

    vi.advanceTimersByTime(50)
    expect(flush).toHaveBeenCalledTimes(2)
    expect(flush).toHaveBeenLastCalledWith("key_points")
  })

  it("flushNow flushes immediately and cancels the pending timer (no double flush)", () => {
    const flush = vi.fn()
    const throttle = createStreamThrottle<"overview">(flush, 100)

    throttle.schedule("overview")
    throttle.flushNow("overview")
    expect(flush).toHaveBeenCalledTimes(1)

    // 在途定时器已被取消:窗口走完不再二次 flush。
    vi.advanceTimersByTime(200)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it("flushNow works without a pending timer (stream completed before any delta)", () => {
    const flush = vi.fn()
    const throttle = createStreamThrottle<"overview">(flush, 100)

    throttle.flushNow("overview")
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it("cancel drops the pending flush without emitting", () => {
    const flush = vi.fn()
    const throttle = createStreamThrottle<"overview">(flush, 100)

    throttle.schedule("overview")
    throttle.cancel("overview")
    vi.advanceTimersByTime(200)
    expect(flush).not.toHaveBeenCalled()

    // cancel 后可重新 schedule(新一轮流)。
    throttle.schedule("overview")
    vi.advanceTimersByTime(100)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it("cancelAll drops every pending timer (unmount cleanup)", () => {
    const flush = vi.fn()
    const throttle = createStreamThrottle<"overview" | "key_points">(flush, 100)

    throttle.schedule("overview")
    throttle.schedule("key_points")
    throttle.cancelAll()
    vi.advanceTimersByTime(200)
    expect(flush).not.toHaveBeenCalled()
  })
})
