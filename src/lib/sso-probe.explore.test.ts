import { beforeEach, describe, expect, it, vi } from "vitest"

// The probe redirects via the SDK's silentLogin (prompt=none). Fake that boundary + configureAuth
// so the test asserts the guard/capture logic, not the SDK redirect itself.
vi.mock("auth-client-web", () => ({
  silentLogin: vi.fn(),
}))
vi.mock("@/lib/auth-sdk", () => ({
  configureAuth: vi.fn(),
}))

import { silentLogin } from "auth-client-web"

import { maybeSilentLogin } from "./sso-probe"

const mockedSilentLogin = vi.mocked(silentLogin)

describe("公开路由 SSO 探测豁免", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
  })

  it("/explore 前缀绝不发起静默登录(匿名浏览是产品功能,不是未登录异常)", () => {
    expect(maybeSilentLogin("/explore")).toBe(false)
    expect(maybeSilentLogin("/explore/abc-123")).toBe(false)
    expect(maybeSilentLogin("/explore?page=2")).toBe(false) // 带 query 也不能被绕过
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("首页 / 绝不发起静默登录(Task 12 广场:未登录首次落地也要能渲染,不被弹去登录墙)", () => {
    expect(maybeSilentLogin("/")).toBe(false)
    expect(maybeSilentLogin("/?callbackUrl=%2Fsettings")).toBe(false) // 带 query 的首页同样豁免
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("受保护路由(/settings)仍会探测(精确匹配护栏:首页豁免绝不能误伤其它路由)", () => {
    // 关键回归守卫:首页豁免必须是精确匹配——若用前缀 "/" 会匹配所有路径、等于全局关掉探针。
    expect(maybeSilentLogin("/settings")).toBe(true)
    expect(mockedSilentLogin).toHaveBeenCalledTimes(1)
  })
})
