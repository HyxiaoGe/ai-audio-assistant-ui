import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 跨应用单点登出（SLO）的前端探测：别处登出后，本标签页手里的 access token 签名仍然有效、
// 本地无从察觉。AuthProvider 在标签页「重新获得焦点 / 重新变为可见」时强制校验一次令牌
// （store.revalidateToken 会走 SDK refresh 做服务端往返），从而把别处的登出落地到本页。
// 约束：只在已登录态触发（未登录无 token 可验、且避免与静默探测竞态）；切回标签页常同时触发
// focus + visibilitychange，必须去抖成一次刷新，避免无谓的双重往返。
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

describe("AuthProvider focus/visibility revalidation (SLO probe)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 回到可见，避免污染后续用例
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
  })

  it("revalidates the token when the tab regains focus while authenticated", () => {
    const revalidateToken = vi.fn().mockResolvedValue("fresh")
    useAuthStore.setState({ initialize: vi.fn(), revalidateToken, status: "authenticated" })

    renderProvider()
    window.dispatchEvent(new Event("focus"))

    expect(revalidateToken).toHaveBeenCalledTimes(1)
  })

  it("revalidates when the document becomes visible while authenticated", () => {
    const revalidateToken = vi.fn().mockResolvedValue("fresh")
    useAuthStore.setState({ initialize: vi.fn(), revalidateToken, status: "authenticated" })

    renderProvider()
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))

    expect(revalidateToken).toHaveBeenCalledTimes(1)
  })

  it("does NOT revalidate on focus when the user is not authenticated", () => {
    const revalidateToken = vi.fn().mockResolvedValue(null)
    useAuthStore.setState({ initialize: vi.fn(), revalidateToken, status: "unauthenticated" })

    renderProvider()
    window.dispatchEvent(new Event("focus"))

    expect(revalidateToken).not.toHaveBeenCalled()
  })

  it("debounces a focus + visibilitychange burst into a single revalidation", () => {
    const revalidateToken = vi.fn().mockResolvedValue("fresh")
    useAuthStore.setState({ initialize: vi.fn(), revalidateToken, status: "authenticated" })

    renderProvider()
    // 切回标签页：浏览器常先后触发两个事件，期望只刷新一次
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))

    expect(revalidateToken).toHaveBeenCalledTimes(1)
  })

  it("stops revalidating after the provider unmounts (listeners cleaned up)", () => {
    const revalidateToken = vi.fn().mockResolvedValue("fresh")
    useAuthStore.setState({ initialize: vi.fn(), revalidateToken, status: "authenticated" })

    const { unmount } = renderProvider()
    unmount()
    window.dispatchEvent(new Event("focus"))

    expect(revalidateToken).not.toHaveBeenCalled()
  })
})
