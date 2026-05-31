import { describe, expect, it } from "vitest"
import { SEEK_PAGE_SECONDS, SEEK_STEP_SECONDS, seekKeyToTime } from "./seek-keyboard"

// 键盘 seek 的纯逻辑：给定按键 + 当前播放状态，算出 clamp 后的新时间；非 seek 键返回 null。
// 抽成纯函数后可被 PlayerBar / Header 两个 slider 复用并独立测试。

describe("seekKeyToTime", () => {
  const duration = 100

  it("ArrowRight / ArrowUp 前进一个步长", () => {
    expect(seekKeyToTime("ArrowRight", 10, duration)).toBe(10 + SEEK_STEP_SECONDS)
    expect(seekKeyToTime("ArrowUp", 10, duration)).toBe(10 + SEEK_STEP_SECONDS)
  })

  it("ArrowLeft / ArrowDown 后退一个步长", () => {
    expect(seekKeyToTime("ArrowLeft", 10, duration)).toBe(10 - SEEK_STEP_SECONDS)
    expect(seekKeyToTime("ArrowDown", 10, duration)).toBe(10 - SEEK_STEP_SECONDS)
  })

  it("PageUp / PageDown 用更大的页步长", () => {
    expect(seekKeyToTime("PageUp", 50, duration)).toBe(50 + SEEK_PAGE_SECONDS)
    expect(seekKeyToTime("PageDown", 50, duration)).toBe(50 - SEEK_PAGE_SECONDS)
  })

  it("Home 跳到 0，End 跳到 duration", () => {
    expect(seekKeyToTime("Home", 42, duration)).toBe(0)
    expect(seekKeyToTime("End", 42, duration)).toBe(duration)
  })

  it("结果被 clamp 到 [0, duration]", () => {
    expect(seekKeyToTime("ArrowRight", 99, duration)).toBe(duration)
    expect(seekKeyToTime("ArrowLeft", 2, duration)).toBe(0)
    expect(seekKeyToTime("PageUp", 99, duration)).toBe(duration)
    expect(seekKeyToTime("PageDown", 3, duration)).toBe(0)
  })

  it("非 seek 键返回 null（调用方据此不拦截事件）", () => {
    expect(seekKeyToTime("Enter", 10, duration)).toBeNull()
    expect(seekKeyToTime("a", 10, duration)).toBeNull()
    expect(seekKeyToTime("Tab", 10, duration)).toBeNull()
  })

  it("duration 非法（0 / NaN / Infinity）时返回 null，不会产生 NaN 跳转", () => {
    expect(seekKeyToTime("ArrowRight", 10, 0)).toBeNull()
    expect(seekKeyToTime("ArrowRight", 10, Number.NaN)).toBeNull()
    expect(seekKeyToTime("ArrowRight", 10, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it("支持自定义步长", () => {
    expect(seekKeyToTime("ArrowRight", 10, duration, 1)).toBe(11)
  })
})
