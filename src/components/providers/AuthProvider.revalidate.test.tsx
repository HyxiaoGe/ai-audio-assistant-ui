import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 跨应用单点登出（SLO）的前端探测：别处登出后，本标签页手里的 access token 签名仍然有效、
// 本地无从察觉。AuthProvider 用【只读存活探测】感知它——store.checkLiveness 只读本地 token +
// 打一次 denylist 受保护端点，被吊销则翻未登录，【绝不轮换 refresh token】（旧实现每次 focus 都
// 走 SDK refresh 轮换，慢隧道下失同步会引发被动登出）。触发两路：focus/可见性恢复（即时，去抖）
// 与低频定时器（兜底覆盖无 focus 事件的空闲页）。约束：只在已登录态触发。
vi.mock("@/lib/sso-probe", () => ({ maybeSilentLogin: vi.fn(() => false) }))

import { useAuthStore } from "@/store/auth-store"

import { AuthProvider } from "./AuthProvider"

function renderProvider() {
  return render(
    <AuthProvider>
      <div />
    </AuthProvider>
  )
}

describe("AuthProvider focus/visibility liveness probe (read-only SLO)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 回到可见，避免污染后续用例
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
  })

  it("probes liveness when the tab regains focus while authenticated", () => {
    const checkLiveness = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ initialize: vi.fn(), checkLiveness, status: "authenticated" })

    renderProvider()
    window.dispatchEvent(new Event("focus"))

    expect(checkLiveness).toHaveBeenCalledTimes(1)
  })

  it("probes liveness when the document becomes visible while authenticated", () => {
    const checkLiveness = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ initialize: vi.fn(), checkLiveness, status: "authenticated" })

    renderProvider()
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))

    expect(checkLiveness).toHaveBeenCalledTimes(1)
  })

  it("does NOT probe on focus when the user is not authenticated", () => {
    const checkLiveness = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ initialize: vi.fn(), checkLiveness, status: "unauthenticated" })

    renderProvider()
    window.dispatchEvent(new Event("focus"))

    expect(checkLiveness).not.toHaveBeenCalled()
  })

  it("debounces a focus + visibilitychange burst into a single probe", () => {
    const checkLiveness = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ initialize: vi.fn(), checkLiveness, status: "authenticated" })

    renderProvider()
    // 切回标签页：浏览器常先后触发两个事件，期望只探测一次
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))

    expect(checkLiveness).toHaveBeenCalledTimes(1)
  })

  it("runs the low-frequency fallback probe on a timer (covers idle pages with no focus events)", () => {
    vi.useFakeTimers()
    try {
      const checkLiveness = vi.fn().mockResolvedValue(undefined)
      useAuthStore.setState({ initialize: vi.fn(), checkLiveness, status: "authenticated" })

      renderProvider()
      expect(checkLiveness).not.toHaveBeenCalled() // 挂载不立即探测
      vi.advanceTimersByTime(5 * 60 * 1000) // 推进一个兜底间隔
      expect(checkLiveness).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("stops probing after the provider unmounts (listeners + timer cleaned up)", () => {
    const checkLiveness = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ initialize: vi.fn(), checkLiveness, status: "authenticated" })

    const { unmount } = renderProvider()
    unmount()
    window.dispatchEvent(new Event("focus"))

    expect(checkLiveness).not.toHaveBeenCalled()
  })
})
