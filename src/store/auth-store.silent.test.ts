import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  clearMediaTicketMock,
  resetGlobalMock,
  clearProfileMock,
  resetDiscoverMock,
  stopAudioMock,
} = vi.hoisted(() => ({
  clearMediaTicketMock: vi.fn(),
  resetGlobalMock: vi.fn(),
  clearProfileMock: vi.fn(),
  resetDiscoverMock: vi.fn(),
  stopAudioMock: vi.fn(),
}))

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
  reconcileSession: vi.fn().mockResolvedValue({ status: "match" }),
  resumeSession: vi.fn(),
  tokenStore: () => ({
    getAccessToken: () => localStorage.getItem("auth_access_token"),
    getUser: () => {
      const raw = localStorage.getItem("auth_user_info")
      return raw ? JSON.parse(raw) : null
    },
    setUser: (user: unknown) => localStorage.setItem("auth_user_info", JSON.stringify(user)),
    clear: () => localStorage.clear(),
  }),
}))
vi.mock("@/lib/media-ticket", () => ({ clearMediaTicket: clearMediaTicketMock }))
vi.mock("@/store/global-store", () => ({
  useGlobalStore: { getState: () => ({ resetForAuthChange: resetGlobalMock }) },
}))
vi.mock("@/store/user-store", () => ({
  useUserStore: { getState: () => ({ clearProfile: clearProfileMock }) },
}))
vi.mock("@/store/discover-store", () => ({
  useDiscoverStore: { getState: () => ({ reset: resetDiscoverMock }) },
}))
vi.mock("@/store/audio-store", () => ({
  useAudioStore: { getState: () => ({ stop: stopAudioMock }) },
}))

import {
  handleCallback,
  login as sdkLogin,
  logout as sdkLogout,
  resumeSession as sdkResumeSession,
} from "auth-client-web"

import { resetAuthSessionTransitionForTests } from "@/lib/auth-session-transition"
import { loginWithGoogle, useAuthStore } from "./auth-store"

const mockedHandleCallback = vi.mocked(handleCallback)
const mockedSdkLogout = vi.mocked(sdkLogout)
const mockedSdkLogin = vi.mocked(sdkLogin)
const mockedSdkResumeSession = vi.mocked(sdkResumeSession)

const RETURN_KEY = "audio_sso_return"
const LOGGED_OUT_KEY = "audio_sso_logged_out"

const USER = { id: "u1", email: "a@b.c", name: "Ada", avatarUrl: "http://i/a.png" }

describe("auth-store completeLogin: silent SSO probe outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    resetAuthSessionTransitionForTests()
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

  it("logout sets the logged-out guard so we don't silently re-login right after logout", async () => {
    mockedSdkLogout.mockResolvedValue(undefined)
    useAuthStore.setState({ user: { ...USER, is_superuser: false, preferences: { locale: "zh", timezone: "Asia/Shanghai", theme: "system" } } as never, status: "authenticated" })

    await useAuthStore.getState().logout()

    expect(sessionStorage.getItem(LOGGED_OUT_KEY)).toBe("1")
  })

  it("logout still sets the guard and unauthenticates even if the SDK revoke rejects", async () => {
    // 撤销失败（网络抖动）不能让用户卡在已登录、且不能漏掉守卫——否则下次加载会被静默重登
    mockedSdkLogout.mockRejectedValue(new TypeError("Failed to fetch"))
    useAuthStore.setState({ user: { ...USER, is_superuser: false, preferences: { locale: "zh", timezone: "Asia/Shanghai", theme: "system" } } as never, status: "authenticated" })

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined() // 本地登出绝不因撤销失败而抛

    expect(sessionStorage.getItem(LOGGED_OUT_KEY)).toBe("1")
    expect(useAuthStore.getState().status).toBe("unauthenticated")
  })

  it("interactive login clears a stale silent-return so an abandoned probe can't hijack the redirect", () => {
    sessionStorage.setItem(RETURN_KEY, "/stats") // 残留自一个被放弃的静默探测
    sessionStorage.setItem(LOGGED_OUT_KEY, "1")
    mockedSdkLogin.mockReturnValue(undefined as never)

    loginWithGoogle("/admin")

    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull()
    expect(sessionStorage.getItem(LOGGED_OUT_KEY)).toBeNull()
    expect(mockedSdkLogin).toHaveBeenCalledWith("google", { redirectPath: "/admin" })
  })

  it("resumeSession adopts the SDK atomically committed user and enters authenticated state", async () => {
    mockedSdkResumeSession.mockImplementation(async (options) => {
      await options?.beforeCommit?.({ user: USER })
      localStorage.setItem("auth_access_token", "token-b")
      localStorage.setItem("auth_refresh_token", "refresh-b")
      return { status: "resumed", user: USER }
    })
    useAuthStore.setState({ user: null, status: "unauthenticated" })

    const result = await useAuthStore.getState().resumeSession()

    expect(result).toBe("resumed")
    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(useAuthStore.getState().user?.id).toBe("u1")
    expect(clearMediaTicketMock).toHaveBeenCalledOnce()
    expect(resetGlobalMock).toHaveBeenCalledOnce()
    expect(clearProfileMock).toHaveBeenCalledOnce()
    expect(resetDiscoverMock).toHaveBeenCalledOnce()
    expect(stopAudioMock).toHaveBeenCalledOnce()
  })

  it("resumeSession leaves the host unauthenticated when the central session is absent", async () => {
    mockedSdkResumeSession.mockResolvedValue({ status: "no_session" })
    useAuthStore.setState({ user: null, status: "unauthenticated" })

    const result = await useAuthStore.getState().resumeSession()

    expect(result).toBe("no_session")
    expect(useAuthStore.getState().status).toBe("unauthenticated")
  })

  it("resumeSession adopts a sibling-tab local_session only after clearing old runtime state", async () => {
    localStorage.setItem("auth_access_token", "token-b")
    localStorage.setItem("auth_refresh_token", "refresh-b")
    localStorage.setItem("auth_user_info", JSON.stringify(USER))
    mockedSdkResumeSession.mockResolvedValue({ status: "local_session" })
    useAuthStore.setState({ user: null, status: "unauthenticated" })

    const result = await useAuthStore.getState().resumeSession()

    expect(result).toBe("local_session")
    expect(clearMediaTicketMock).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(useAuthStore.getState().user?.id).toBe("u1")
  })
})
