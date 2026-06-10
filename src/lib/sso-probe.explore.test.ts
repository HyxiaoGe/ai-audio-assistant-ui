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
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })
})
