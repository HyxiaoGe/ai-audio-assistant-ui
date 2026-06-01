import { beforeEach, describe, expect, it, vi } from "vitest"

// Fake the SDK boundary so we can drive the two failure modes the SDK actually exposes:
//  - getAccessToken() THROWS on a transient network error (the fetch rejects), and
//  - getAccessToken() RETURNS null only on a definitive failure (no refresh token / rotation
//    rejected), after the SDK has already cleared its own session.
// audio's store must treat these differently: a transient blip must NOT log the user out.
vi.mock("auth-client-web", () => ({
  configure: vi.fn(),
  handleCallback: vi.fn(),
  getAccessToken: vi.fn(),
  fetchUserInfo: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

// Observe ordering in logout(): the media ticket must be cleared BEFORE the store flips to
// unauthenticated, so no component can mint a media URL with the old ticket post-logout.
let statusWhenTicketCleared: string | null = null
vi.mock("@/lib/media-ticket", () => ({
  clearMediaTicket: vi.fn(() => {
    statusWhenTicketCleared = useAuthStore.getState().status
  }),
}))

import { fetchUserInfo, getAccessToken, logout } from "auth-client-web"
import { clearMediaTicket } from "@/lib/media-ticket"

import { useAuthStore } from "./auth-store"

const mockedGetAccessToken = vi.mocked(getAccessToken)
const mockedFetchUserInfo = vi.mocked(fetchUserInfo)
const mockedSdkLogout = vi.mocked(logout)

const CACHED_USER = {
  id: "u1",
  email: "a@b.c",
  name: "Ada",
  avatar_url: "http://i/a.png",
  is_superuser: false,
  preferences: { locale: "en", timezone: "UTC", theme: "dark" },
}

describe("auth-store resilience: transient vs definitive auth failure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    statusWhenTicketCleared = null
    useAuthStore.setState({ user: null, status: "loading" })
  })

  // ── getAccessToken() ────────────────────────────────────────────────────────
  it("getAccessToken: a transient throw returns null WITHOUT logging the user out", async () => {
    useAuthStore.setState({ user: CACHED_USER, status: "authenticated" })
    mockedGetAccessToken.mockRejectedValue(new TypeError("Failed to fetch"))

    const token = await useAuthStore.getState().getAccessToken()

    expect(token).toBeNull()
    // a network blip mid-session must keep the user authenticated, not flip the whole app out
    expect(useAuthStore.getState().status).toBe("authenticated")
  })

  it("getAccessToken: a definitive null flips the store to unauthenticated", async () => {
    useAuthStore.setState({ user: CACHED_USER, status: "authenticated" })
    mockedGetAccessToken.mockResolvedValue(null)

    const token = await useAuthStore.getState().getAccessToken()

    expect(token).toBeNull()
    expect(useAuthStore.getState().status).toBe("unauthenticated")
    expect(useAuthStore.getState().user).toBeNull()
  })

  // ── initialize() ────────────────────────────────────────────────────────────
  it("initialize: keeps the cached user authenticated when userinfo fetch fails but token is valid", async () => {
    localStorage.setItem("auth_access_token", "tok")
    localStorage.setItem("auth_user_info", JSON.stringify(CACHED_USER))
    mockedGetAccessToken.mockResolvedValue("tok") // token is valid
    mockedFetchUserInfo.mockRejectedValue(new TypeError("Failed to fetch")) // transient userinfo blip

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(useAuthStore.getState().user?.email).toBe("a@b.c")
  })

  it("initialize: a transient token-validation throw keeps the cache-painted user authenticated", async () => {
    localStorage.setItem("auth_access_token", "tok")
    localStorage.setItem("auth_user_info", JSON.stringify(CACHED_USER))
    mockedGetAccessToken.mockRejectedValue(new TypeError("Failed to fetch"))

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(useAuthStore.getState().user?.email).toBe("a@b.c")
    expect(mockedFetchUserInfo).not.toHaveBeenCalled()
  })

  it("initialize: a definitive null flips to unauthenticated even with a cached user", async () => {
    localStorage.setItem("auth_access_token", "tok")
    localStorage.setItem("auth_user_info", JSON.stringify(CACHED_USER))
    mockedGetAccessToken.mockResolvedValue(null)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().status).toBe("unauthenticated")
    expect(useAuthStore.getState().user).toBeNull()
  })

  // ── logout() ordering ───────────────────────────────────────────────────────
  it("logout: clears the media ticket BEFORE flipping the store to unauthenticated", async () => {
    useAuthStore.setState({ user: CACHED_USER, status: "authenticated" })
    mockedSdkLogout.mockResolvedValue(undefined)

    await useAuthStore.getState().logout()

    expect(clearMediaTicket).toHaveBeenCalledTimes(1)
    // at the moment the ticket was cleared, the store had not yet flipped out
    expect(statusWhenTicketCleared).not.toBe("unauthenticated")
    // and afterwards it is fully logged out
    expect(useAuthStore.getState().status).toBe("unauthenticated")
  })
})
