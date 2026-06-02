import { beforeEach, describe, expect, it, vi } from "vitest"

// revalidateToken() exists for cross-app Single Logout: after the user logs out in another app
// (e.g. fusion), audio's stored access token is still cryptographically valid until it expires,
// and the SDK's getAccessToken() returns that cached token AS-IS while unexpired -- so it can't
// notice the foreign logout. revalidateToken() FORCES a server round-trip via the SDK refresh():
//   - refresh() RETURNS null on a definitive failure (refresh token revoked by the logout) after
//     clearing the SDK session -> audio must mirror that and flip itself to unauthenticated;
//   - refresh() THROWS on a transient network blip -> must NOT log the user out;
//   - refresh() RETURNS a (rotated) token when the session is still alive -> stay authenticated.
vi.mock("auth-client-web", () => ({
  configure: vi.fn(),
  handleCallback: vi.fn(),
  getAccessToken: vi.fn(),
  refresh: vi.fn(),
  fetchUserInfo: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

import { refresh } from "auth-client-web"

import { useAuthStore } from "./auth-store"

const mockedRefresh = vi.mocked(refresh)

const CACHED_USER = {
  id: "u1",
  email: "a@b.c",
  name: "Ada",
  avatar_url: "http://i/a.png",
  is_superuser: false,
  preferences: { locale: "en", timezone: "UTC", theme: "dark" },
}

describe("auth-store revalidateToken: force-refresh detection of a foreign logout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({ user: CACHED_USER, status: "authenticated" })
  })

  it("definitive null (refresh token revoked elsewhere) flips the store to unauthenticated", async () => {
    mockedRefresh.mockResolvedValue(null)

    const token = await useAuthStore.getState().revalidateToken()

    expect(token).toBeNull()
    expect(useAuthStore.getState().status).toBe("unauthenticated")
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("a transient throw returns null WITHOUT logging the user out", async () => {
    mockedRefresh.mockRejectedValue(new TypeError("Failed to fetch"))

    const token = await useAuthStore.getState().revalidateToken()

    expect(token).toBeNull()
    expect(useAuthStore.getState().status).toBe("authenticated") // a network blip must not log out
  })

  it("a live session returns the rotated token and stays authenticated", async () => {
    mockedRefresh.mockResolvedValue("fresh-token")

    const token = await useAuthStore.getState().revalidateToken()

    expect(token).toBe("fresh-token")
    expect(useAuthStore.getState().status).toBe("authenticated")
  })

  it("forces a server round-trip (does not trust the locally-cached access token)", async () => {
    mockedRefresh.mockResolvedValue("fresh-token")

    await useAuthStore.getState().revalidateToken()

    expect(mockedRefresh).toHaveBeenCalledTimes(1)
  })
})
