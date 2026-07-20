import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AuthSessionTransitionError,
  assertAuthSessionStable,
  beginAuthSessionTransition,
  blockAuthSessionTransition,
  completeAuthSessionTransition,
  getAuthSessionTransitionState,
  registerAuthBoundCloser,
  registerAuthBoundController,
  resetAuthSessionTransitionForTests,
} from "./auth-session-transition"

afterEach(() => resetAuthSessionTransitionForTests())

describe("认证会话切换栅栏", () => {
  it("确认换号时中断旧请求和长连接", () => {
    const controller = new AbortController()
    const close = vi.fn()
    registerAuthBoundController(controller)
    registerAuthBoundCloser(close)

    beginAuthSessionTransition()

    expect(controller.signal.aborted).toBe(true)
    expect(close).toHaveBeenCalledTimes(1)
    expect(() => assertAuthSessionStable()).toThrow(AuthSessionTransitionError)
  })

  it("新身份提交后开放新 epoch，旧响应仍被拒绝", () => {
    const controller = new AbortController()
    const old = registerAuthBoundController(controller)
    beginAuthSessionTransition()
    completeAuthSessionTransition()

    expect(getAuthSessionTransitionState()).toBe("stable")
    expect(() => assertAuthSessionStable(old.epoch)).toThrow(AuthSessionTransitionError)
  })

  it("换票失败时保持封锁", () => {
    beginAuthSessionTransition()
    blockAuthSessionTransition()

    expect(getAuthSessionTransitionState()).toBe("blocked")
    expect(() => registerAuthBoundController(new AbortController())).toThrow(
      AuthSessionTransitionError
    )
  })
})
