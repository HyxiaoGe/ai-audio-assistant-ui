import { beforeEach, describe, expect, it, vi } from "vitest"

// Fake the SDK boundary; drive handleCallback per test. We use the REAL sso-probe so the
// silent-return capture (sessionStorage) is exercised end-to-end with completeLogin.
vi.mock("auth-client-web", () => ({
  configure: vi.fn(),
  handleCallback: vi.fn(),
  getAccessToken: vi.fn(),
  fetchUserInfo: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  silentLogin: vi.fn(),
}))
vi.mock("@/lib/media-ticket", () => ({ clearMediaTicket: vi.fn() }))

import { handleCallback, login as sdkLogin, logout as sdkLogout } from "auth-client-web"

import { loginWithGoogle, useAuthStore } from "./auth-store"

const mockedHandleCallback = vi.mocked(handleCallback)
const mockedSdkLogout = vi.mocked(sdkLogout)
const mockedSdkLogin = vi.mocked(sdkLogin)

const RETURN_KEY = "audio_sso_return"
const PROBED_KEY = "audio_sso_probed"

const USER = { id: "u1", email: "a@b.c", name: "Ada", avatarUrl: "http://i/a.png" }

describe("auth-store completeLogin: silent SSO probe outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.setState({ user: null, status: "loading" })
  })

  it("silent HIT: returns the captured origin path (not the SDK default) and authenticates", async () => {
    sessionStorage.setItem(RETURN_KEY, "/stats?tab=usage")
    mockedHandleCallback.mockResolvedValue({ status: "authenticated", user: USER, redirectPath: "/" })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toEqual({ ok: true, redirectPath: "/stats?tab=usage" })
    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull() // consumed
  })

  it("silent MISS: soft-returns to the origin page (no forced /login), stays unauthenticated", async () => {
    sessionStorage.setItem(RETURN_KEY, "/stats?tab=usage")
    mockedHandleCallback.mockResolvedValue({ status: "unauthenticated", error: "login_required" })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toEqual({ ok: false, redirectPath: "/stats?tab=usage", error: "login_required" })
    expect(useAuthStore.getState().status).toBe("unauthenticated")
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull()
  })

  it("silent HIT with an unsafe captured return is dropped (open-redirect guard): uses the SDK default", async () => {
    // 纵深防御：即便有东西把站外路径塞进了 RETURN_KEY（落库端本应已挡回），
    // 消费端也必须独立校验、丢弃，绝不把它当成 router.replace 的目标。
    sessionStorage.setItem(RETURN_KEY, "//evil.com/x")
    mockedHandleCallback.mockResolvedValue({ status: "authenticated", user: USER, redirectPath: "/tasks" })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toEqual({ ok: true, redirectPath: "/tasks" }) // 站外路径被丢，回退到 SDK 默认
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull() // 仍被消费清除，不残留
  })

  it("silent MISS with an unsafe captured return falls back to /login, not the off-origin path", async () => {
    sessionStorage.setItem(RETURN_KEY, "//evil.com")
    mockedHandleCallback.mockResolvedValue({ status: "unauthenticated", error: "login_required" })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toEqual({ ok: false, redirectPath: "/login", error: "login_required" })
  })

  it("interactive MISS (no silent marker): falls back to /login", async () => {
    mockedHandleCallback.mockResolvedValue({ status: "unauthenticated", error: "login_required" })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toEqual({ ok: false, redirectPath: "/login", error: "login_required" })
  })

  it("interactive HIT (no silent marker): uses the SDK redirectPath unchanged", async () => {
    mockedHandleCallback.mockResolvedValue({ status: "authenticated", user: USER, redirectPath: "/tasks" })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toEqual({ ok: true, redirectPath: "/tasks" })
  })

  it("logout sets the probe-suppress guard so we don't silently re-login right after logout", async () => {
    mockedSdkLogout.mockResolvedValue(undefined)
    useAuthStore.setState({ user: { ...USER, is_superuser: false, preferences: { locale: "zh", timezone: "Asia/Shanghai", theme: "system" } } as never, status: "authenticated" })

    await useAuthStore.getState().logout()

    expect(sessionStorage.getItem(PROBED_KEY)).toBe("1")
  })

  it("logout still sets the guard and unauthenticates even if the SDK revoke rejects", async () => {
    // 撤销失败（网络抖动）不能让用户卡在已登录、且不能漏掉守卫——否则下次加载会被静默重登
    mockedSdkLogout.mockRejectedValue(new TypeError("Failed to fetch"))
    useAuthStore.setState({ user: { ...USER, is_superuser: false, preferences: { locale: "zh", timezone: "Asia/Shanghai", theme: "system" } } as never, status: "authenticated" })

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined() // 本地登出绝不因撤销失败而抛

    expect(sessionStorage.getItem(PROBED_KEY)).toBe("1")
    expect(useAuthStore.getState().status).toBe("unauthenticated")
  })

  it("interactive login clears a stale silent-return so an abandoned probe can't hijack the redirect", () => {
    sessionStorage.setItem(RETURN_KEY, "/stats") // 残留自一个被放弃的静默探测
    mockedSdkLogin.mockReturnValue(undefined as never)

    loginWithGoogle("/admin")

    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull()
    expect(mockedSdkLogin).toHaveBeenCalledWith("google", { redirectPath: "/admin" })
  })
})
