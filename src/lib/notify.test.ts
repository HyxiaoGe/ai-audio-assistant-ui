import { describe, expect, it, vi, beforeEach } from "vitest"

const success = vi.fn()
const error = vi.fn()
const info = vi.fn()
const warning = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => success(...a),
    error: (...a: unknown[]) => error(...a),
    info: (...a: unknown[]) => info(...a),
    warning: (...a: unknown[]) => warning(...a),
  },
}))

// notifications-store 已删除（notify.ts 收敛为纯 sonner 后不再 import 它）。
// 「不写 store」由「该模块已不存在」从结构上保证，无需再 mock 死模块。

import {
  notifySuccess,
  notifyError,
  notifyInfo,
  notifyWarning,
} from "@/lib/notify"

describe("notify", () => {
  beforeEach(() => {
    success.mockClear()
    error.mockClear()
    info.mockClear()
    warning.mockClear()
  })

  it("routes each variant to the matching styled sonner method", () => {
    notifySuccess("ok")
    notifyError("bad")
    notifyInfo("fyi")
    notifyWarning("careful")

    expect(success).toHaveBeenCalledWith("ok", undefined)
    expect(error).toHaveBeenCalledWith("bad", undefined)
    expect(info).toHaveBeenCalledWith("fyi", undefined)
    expect(warning).toHaveBeenCalledWith("careful", undefined)
  })

  it("forwards sonner options through", () => {
    notifyInfo("fyi", { duration: 1234 })
    expect(info).toHaveBeenCalledWith("fyi", { duration: 1234 })
  })

  it("tolerates a legacy { persist } option without forwarding it to sonner", () => {
    notifyInfo("reset", { persist: false })
    expect(info).toHaveBeenCalledWith("reset", undefined)
  })
})
