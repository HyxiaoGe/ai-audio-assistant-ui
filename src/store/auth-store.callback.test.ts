import { beforeEach, describe, expect, it, vi } from "vitest"

// Fake the SDK boundary so we test audio's callback adapter (map + status), not the SDK
// itself (which has its own suite). configure() is a no-op; handleCallback is driven per test.
vi.mock("auth-client-web", () => ({
  configure: vi.fn(),
  handleCallback: vi.fn(),
  getAccessToken: vi.fn(),
  fetchUserInfo: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

import { handleCallback } from "auth-client-web"

import { useAuthStore } from "./auth-store"

const mockedHandleCallback = vi.mocked(handleCallback)

describe("auth-store completeLogin (callback adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({ user: null, status: "loading" })
  })

  it("authenticates the store with the SDK user mapped to audio shape", async () => {
    mockedHandleCallback.mockResolvedValue({
      status: "authenticated",
      user: {
        id: "u1",
        email: "a@b.c",
        name: "Ada",
        avatarUrl: "http://i/a.png",
        is_superuser: true,
        preferences: { locale: "en", timezone: "UTC", theme: "dark" },
      },
      redirectPath: "/tasks",
    })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toEqual({ ok: true, redirectPath: "/tasks" })
    const state = useAuthStore.getState()
    expect(state.status).toBe("authenticated")
    expect(state.user?.avatar_url).toBe("http://i/a.png") // avatarUrl -> avatar_url
    // user cached for instant paint on reload
    expect(localStorage.getItem("auth_user_info")).toContain("avatar_url")
  })

  it("leaves the store unauthenticated on a login_required (silent-probe miss)", async () => {
    mockedHandleCallback.mockResolvedValue({ status: "unauthenticated", error: "login_required" })

    const result = await useAuthStore.getState().completeLogin()

    expect(result).toMatchObject({ ok: false, error: "login_required" })
    expect(useAuthStore.getState().status).toBe("unauthenticated")
  })
})
