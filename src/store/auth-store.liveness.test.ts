import { beforeEach, describe, expect, it, vi } from "vitest"

// checkLiveness() is the READ-ONLY cross-app Single-Logout probe. After the user logs out in
// another app, audio's stored access token is still cryptographically valid until it expires, so
// the SDK's getAccessToken() returns it AS-IS and can't notice the foreign logout. checkLiveness
// reads that token (refreshing only if actually expired) and pings the denylist-protected
// /auth/userinfo: a 401/403 means "revoked / logged out elsewhere" -> flip to unauthenticated.
// CRUCIALLY it must NEVER force a refresh()/rotation (that was the focus-churn that desynced the
// rotating refresh token over a flaky tunnel and caused the spurious logouts), and must NEVER log
// the user out on a transient blip (5xx / network) -- a missed round is caught by the next real
// API 401 or by token expiry.
vi.mock("auth-client-web", () => ({
  configure: vi.fn(),
  handleCallback: vi.fn(),
  getAccessToken: vi.fn(),
  refresh: vi.fn(),
  fetchUserInfo: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

import { fetchUserInfo, getAccessToken, refresh } from "auth-client-web"

import { useAuthStore } from "./auth-store"

const mockedGetAccessToken = vi.mocked(getAccessToken)
const mockedFetchUserInfo = vi.mocked(fetchUserInfo)
const mockedRefresh = vi.mocked(refresh)

const CACHED_USER = {
  id: "u1",
  email: "a@b.c",
  name: "Ada",
  avatar_url: "http://i/a.png",
  is_superuser: false,
  preferences: { locale: "en", timezone: "UTC", theme: "dark" },
}

describe("auth-store checkLiveness: read-only foreign-logout detection (no rotation)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({ user: CACHED_USER, status: "authenticated" })
  })

  it("stays authenticated and NEVER rotates when userinfo succeeds", async () => {
    mockedGetAccessToken.mockResolvedValue("tok")
    mockedFetchUserInfo.mockResolvedValue({ id: "u1" } as never)

    await useAuthStore.getState().checkLiveness()

    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(mockedRefresh).not.toHaveBeenCalled() // the whole point: read-only, no churn
  })

  it("logs out when userinfo is rejected 401 (logged out elsewhere / token revoked)", async () => {
    mockedGetAccessToken.mockResolvedValue("tok")
    mockedFetchUserInfo.mockRejectedValue(new Error("auth-client-web: userinfo failed (401)"))

    await useAuthStore.getState().checkLiveness()

    expect(useAuthStore.getState().status).toBe("unauthenticated")
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("logs out when userinfo is rejected 403 (account disabled)", async () => {
    mockedGetAccessToken.mockResolvedValue("tok")
    mockedFetchUserInfo.mockRejectedValue(new Error("auth-client-web: userinfo failed (403)"))

    await useAuthStore.getState().checkLiveness()

    expect(useAuthStore.getState().status).toBe("unauthenticated")
  })

  it("keeps the session on a transient 5xx userinfo failure (must not log out on a blip)", async () => {
    mockedGetAccessToken.mockResolvedValue("tok")
    mockedFetchUserInfo.mockRejectedValue(new Error("auth-client-web: userinfo failed (503)"))

    await useAuthStore.getState().checkLiveness()

    expect(useAuthStore.getState().status).toBe("authenticated")
  })

  it("keeps the session on a network throw from userinfo", async () => {
    mockedGetAccessToken.mockResolvedValue("tok")
    mockedFetchUserInfo.mockRejectedValue(new TypeError("Failed to fetch"))

    await useAuthStore.getState().checkLiveness()

    expect(useAuthStore.getState().status).toBe("authenticated")
  })

  it("flips to unauthenticated when getAccessToken is a definitive null (refresh rejected)", async () => {
    mockedGetAccessToken.mockResolvedValue(null)

    await useAuthStore.getState().checkLiveness()

    expect(useAuthStore.getState().status).toBe("unauthenticated")
    expect(mockedFetchUserInfo).not.toHaveBeenCalled()
  })

  it("keeps the session when getAccessToken throws (transient), without probing userinfo", async () => {
    mockedGetAccessToken.mockRejectedValue(new TypeError("Failed to fetch"))

    await useAuthStore.getState().checkLiveness()

    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(mockedFetchUserInfo).not.toHaveBeenCalled()
  })

  it("no-ops when not authenticated (no token to probe; avoids racing the first-paint SSO probe)", async () => {
    useAuthStore.setState({ user: null, status: "unauthenticated" })

    await useAuthStore.getState().checkLiveness()

    expect(mockedGetAccessToken).not.toHaveBeenCalled()
  })
})
