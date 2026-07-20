import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("auth-client-web", () => ({
  configure: vi.fn(),
  fetchUserInfo: vi.fn(),
  getAccessToken: vi.fn(),
  handleCallback: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  reconcileSession: vi.fn().mockResolvedValue({ status: "match" }),
  tokenStore: () => ({
    getAccessToken: () => localStorage.getItem("auth_access_token"),
    setUser: (user: unknown) => localStorage.setItem("auth_user_info", JSON.stringify(user)),
  }),
}))

import { useAuthStore } from "./auth-store"

describe("auth-store 邮箱验证码登录完成", () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, status: "unauthenticated" })
  })

  it("把 SDK 返回用户归一化并同步到 Zustand 与现有缓存键", () => {
    localStorage.setItem("auth_access_token", "access-token")
    useAuthStore.getState().completeEmailCodeLogin({
      id: 42,
      email: "user@example.com",
      name: "Audio User",
      avatarUrl: "https://example.com/avatar.png",
      preferences: { locale: "en", timezone: "UTC" },
    })

    const state = useAuthStore.getState()
    expect(state.status).toBe("authenticated")
    expect(state.user).toEqual({
      id: "42",
      email: "user@example.com",
      name: "Audio User",
      avatar_url: "https://example.com/avatar.png",
      is_superuser: false,
      preferences: { locale: "en", timezone: "UTC", theme: "system" },
    })
    expect(JSON.parse(localStorage.getItem("auth_user_info") ?? "null")).toEqual(state.user)
  })

  it("SDK 未原子写入 access token 时不伪造已登录状态", () => {
    expect(() =>
      useAuthStore.getState().completeEmailCodeLogin({
        id: "user-1",
        email: "user@example.com",
        name: "Audio User",
      })
    ).toThrow("邮箱验证码换码完成后缺少 access token")
    expect(useAuthStore.getState()).toMatchObject({ user: null, status: "unauthenticated" })
  })
})
