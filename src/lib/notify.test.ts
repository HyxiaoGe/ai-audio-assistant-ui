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

// 一旦 notify.ts 还 import 死的 notifications-store，这个 mock 会成为它被引用的证据。
const pushNotification = vi.fn()
vi.mock("@/lib/notifications-store", () => ({
  pushNotification: (...a: unknown[]) => pushNotification(...a),
}))

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
    pushNotification.mockClear()
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

  it("forwards sonner options through and never writes any store", () => {
    notifyInfo("fyi", { duration: 1234 })
    expect(info).toHaveBeenCalledWith("fyi", { duration: 1234 })
    expect(pushNotification).not.toHaveBeenCalled()
  })

  it("tolerates a legacy { persist } option without forwarding it to sonner", () => {
    notifyInfo("reset", { persist: false })
    expect(info).toHaveBeenCalledWith("reset", undefined)
    expect(pushNotification).not.toHaveBeenCalled()
  })
})
