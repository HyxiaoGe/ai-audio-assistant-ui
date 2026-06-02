import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The probe redirects via the SDK's silentLogin (prompt=none). Fake that boundary + configureAuth
// so the test asserts the guard/capture logic, not the SDK redirect itself.
vi.mock("auth-client-web", () => ({
  silentLogin: vi.fn(),
}))
vi.mock("@/lib/auth-sdk", () => ({
  configureAuth: vi.fn(),
}))

import { silentLogin } from "auth-client-web"

import { clearSsoReturn, isSafeReturnPath, markLoggedOut, maybeSilentLogin, takeSsoReturnPath } from "./sso-probe"

const mockedSilentLogin = vi.mocked(silentLogin)

const PROBED_KEY = "audio_sso_probed"
const LOGGED_OUT_KEY = "audio_sso_logged_out"
const RETURN_KEY = "audio_sso_return"
const ACCESS_TOKEN_KEY = "auth_access_token"

// 控制 maybeSilentLogin 内部读到的「本次页面加载导航类型」。自动跳转返回那一圈是 302/软跳转 →
// "navigate"，只有用户真·手动刷新(F5/Cmd-R)才是 "reload"。默认按 "navigate"，个别用例覆盖。
// jsdom 不一定实现 getEntriesByType，所以直接替换方法（afterEach 还原），比 spyOn 更稳。
const realGetEntriesByType = performance.getEntriesByType?.bind(performance)
function setNavigationType(type: "navigate" | "reload" | null): void {
  const entries = (type === null ? [] : [{ type }]) as unknown as PerformanceEntryList
  performance.getEntriesByType = (() => entries) as Performance["getEntriesByType"]
}

describe("sso-probe: silent SSO on app load", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    setNavigationType("navigate") // 默认非刷新导航
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (realGetEntriesByType) {
      performance.getEntriesByType = realGetEntriesByType as Performance["getEntriesByType"]
    }
  })

  it("fires once when there is no token, captures the origin path and sets the loop guard", () => {
    const fired = maybeSilentLogin("/stats?tab=usage")

    expect(fired).toBe(true)
    expect(mockedSilentLogin).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(PROBED_KEY)).toBe("1")
    expect(sessionStorage.getItem(RETURN_KEY)).toBe("/stats?tab=usage")
  })

  it('does NOT capture a protocol-relative path (open-redirect guard): stores "/" instead of //evil.com', () => {
    // window.location.pathname 可以字面就是 "//evil.com/x"（浏览器不折叠前导双斜杠）；
    // 若原样喂给回调消费端的 router.replace 会被解析成站外 origin，造成客户端开放重定向。
    const fired = maybeSilentLogin("//evil.com/x?a=1")

    expect(fired).toBe(true) // 探测照常发起（用户本就无 token）
    expect(sessionStorage.getItem(RETURN_KEY)).toBe("/") // 但站外路径被拒，落库回退为 "/"
  })

  it("normalizes a backslash-prefixed path that resolves off-origin to a safe \"/\" capture", () => {
    maybeSilentLogin("/\\evil.com")

    expect(sessionStorage.getItem(RETURN_KEY)).toBe("/")
  })

  it("isSafeReturnPath accepts same-origin relative paths and rejects off-origin vectors", () => {
    expect(isSafeReturnPath("/stats?tab=usage")).toBe(true)
    expect(isSafeReturnPath("/")).toBe(true)
    expect(isSafeReturnPath("//evil.com")).toBe(false)
    expect(isSafeReturnPath("/\\evil.com")).toBe(false)
    expect(isSafeReturnPath("///evil.com")).toBe(false)
  })

  it("does NOT fire when a local access token already exists", () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, "tok")

    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("does NOT re-fire on a normal (non-reload) navigation once the guard is set (no redirect loop)", () => {
    sessionStorage.setItem(PROBED_KEY, "1")
    setNavigationType("navigate")

    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("RE-fires on a genuine manual reload even though the per-tab guard is set (picks up a cross-app login)", () => {
    // 用户在别处（fusion）登录后，切回 audio 按刷新：reload 放行再探一次，接上 IdP 会话。
    sessionStorage.setItem(PROBED_KEY, "1")
    setNavigationType("reload")

    expect(maybeSilentLogin("/tasks")).toBe(true)
    expect(mockedSilentLogin).toHaveBeenCalledTimes(1)
  })

  it("does NOT re-fire on reload when navigation timing is unavailable (conservative fallback)", () => {
    sessionStorage.setItem(PROBED_KEY, "1")
    setNavigationType(null)

    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("does NOT fire while on the callback path (mid token-exchange)", () => {
    expect(maybeSilentLogin("/auth/callback?code=abc&state=xyz")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("markLoggedOut blocks a silent re-login on a normal navigation (used by logout)", () => {
    markLoggedOut()
    expect(sessionStorage.getItem(LOGGED_OUT_KEY)).toBe("1")

    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("markLoggedOut blocks a silent re-login EVEN on a manual reload (an explicit logout must survive a refresh)", () => {
    // 关键回归守卫：登出后即便 IdP 会话还在，用户刷新本页也绝不能被静默登回去。
    markLoggedOut()
    setNavigationType("reload")

    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("takeSsoReturnPath reads and clears the captured origin", () => {
    sessionStorage.setItem(RETURN_KEY, "/notifications")
    expect(takeSsoReturnPath()).toBe("/notifications")
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull()
    expect(takeSsoReturnPath()).toBeNull()
  })

  it("clearSsoReturn drops a stale captured origin (so it can't hijack a later interactive login)", () => {
    sessionStorage.setItem(RETURN_KEY, "/stats")
    clearSsoReturn()
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull()
  })
})
