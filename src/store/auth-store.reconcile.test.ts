import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  events,
  reconcileSessionMock,
  clearMediaTicketMock,
  resetGlobalMock,
  clearProfileMock,
  resetDiscoverMock,
  stopAudioMock,
} = vi.hoisted(() => ({
  events: [] as string[],
  reconcileSessionMock: vi.fn(),
  clearMediaTicketMock: vi.fn(() => events.push("clear:media")),
  resetGlobalMock: vi.fn(() => events.push("clear:global")),
  clearProfileMock: vi.fn(() => events.push("clear:user")),
  resetDiscoverMock: vi.fn(() => events.push("clear:discover")),
  stopAudioMock: vi.fn(() => events.push("clear:audio")),
}))

vi.mock("auth-client-web", () => ({
  configure: vi.fn(),
  fetchUserInfo: vi.fn(),
  getAccessToken: vi.fn(),
  getState: vi.fn(() => ({ user: null, status: "loading" })),
  handleCallback: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  reconcileSession: reconcileSessionMock,
  tokenStore: vi.fn(() => ({
    getAccessToken: () => localStorage.getItem("auth_access_token"),
    getUser: () => {
      const raw = localStorage.getItem("auth_user_info")
      return raw ? JSON.parse(raw) : null
    },
    setUser: (user: unknown) => localStorage.setItem("auth_user_info", JSON.stringify(user)),
  })),
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

import { resetAuthSessionTransitionForTests } from "@/lib/auth-session-transition"
import { useAuthStore } from "./auth-store"

const USER_A = {
  id: "u1",
  email: "a@example.com",
  name: "A",
  is_superuser: false,
  preferences: { locale: "zh", timezone: "Asia/Shanghai", theme: "system" },
}

const SDK_USER_B = {
  id: "u2",
  email: "b@example.com",
  name: "B",
  avatarUrl: "https://example.com/b.png",
}

describe("auth-store 中央账户对账", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    events.length = 0
    localStorage.clear()
    localStorage.setItem("auth_access_token", "old-token")
    resetAuthSessionTransitionForTests()
    useAuthStore.setState({
      user: USER_A,
      status: "authenticated",
      accountSwitchError: null,
      switchedAccountEmail: null,
    })
  })

  it("在 SDK 提交 B 会话前清空 A 的运行态，随后采用 B", async () => {
    reconcileSessionMock.mockImplementation(async (options) => {
      events.push("reconcile:confirmed")
      await options.beforeCommit?.({ previousUser: { id: "u1" }, user: SDK_USER_B })
      events.push("sdk:commit")
      localStorage.setItem("auth_access_token", "new-token")
      return {
        status: "switched",
        previousUser: { id: "u1", email: "a@example.com" },
        user: SDK_USER_B,
      }
    })

    const result = await useAuthStore.getState().reconcileAccount()

    expect(result).toBe("switched")
    expect(events.indexOf("clear:media")).toBeGreaterThan(events.indexOf("reconcile:confirmed"))
    expect(events.indexOf("clear:media")).toBeLessThan(events.indexOf("sdk:commit"))
    expect(resetGlobalMock).toHaveBeenCalledTimes(1)
    expect(clearProfileMock).toHaveBeenCalledTimes(1)
    expect(resetDiscoverMock).toHaveBeenCalledTimes(1)
    expect(stopAudioMock).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user?.id).toBe("u2")
    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(useAuthStore.getState().switchedAccountEmail).toBe("b@example.com")
  })

  it("同一次 SDK 提交被 subscriber 再次观察时保持幂等", async () => {
    await useAuthStore.getState().prepareAccountSwitch()
    await useAuthStore.getState().syncCommittedAccount(SDK_USER_B)
    useAuthStore.getState().acknowledgeAccountSwitch()

    await useAuthStore.getState().syncCommittedAccount(SDK_USER_B)

    expect(useAuthStore.getState().switchedAccountEmail).toBeNull()
    expect(useAuthStore.getState().user?.id).toBe("u2")
  })

  it("已确认失配但换票失败时保持封锁，不恢复 A 的请求能力", async () => {
    reconcileSessionMock.mockImplementation(async (options) => {
      await options.beforeCommit?.({ previousUser: { id: "u1" }, user: SDK_USER_B })
      throw Object.assign(new Error("exchange failed"), { blocking: true })
    })

    const result = await useAuthStore.getState().reconcileAccount()

    expect(result).toBe("blocked")
    expect(useAuthStore.getState().status).toBe("synchronizing")
    expect(useAuthStore.getState().accountSwitchError).toContain("exchange failed")
  })

  it("尚未确认失配的网络错误不清理当前账户", async () => {
    reconcileSessionMock.mockRejectedValue(new TypeError("Failed to fetch"))

    const result = await useAuthStore.getState().reconcileAccount()

    expect(result).toBe("unchanged")
    expect(clearMediaTicketMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(useAuthStore.getState().user?.id).toBe("u1")
  })
})
