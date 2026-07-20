import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn() }))
const { sdkSubscriber } = vi.hoisted(() => ({
  sdkSubscriber: { current: null as null | ((state: { status: string; user: unknown }) => void) },
}))

vi.mock("auth-client-web", async () => {
  const actual = await vi.importActual<typeof import("auth-client-web")>("auth-client-web")
  return {
    ...actual,
    subscribe: vi.fn((listener) => {
      sdkSubscriber.current = listener
      return vi.fn()
    }),
  }
})

// On app load AuthProvider attempts a one-shot silent SSO probe; only if it does NOT navigate
// the page away (returns false) do we run the normal initialize().
vi.mock("@/lib/sso-probe", () => ({ maybeSilentLogin: vi.fn() }))

import { maybeSilentLogin } from "@/lib/sso-probe"
import { useAuthStore } from "@/store/auth-store"

import { AuthProvider } from "./AuthProvider"

const mockedMaybe = vi.mocked(maybeSilentLogin)

describe("AuthProvider bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sdkSubscriber.current = null
  })

  it("runs initialize() when no silent probe is kicked off", () => {
    const initialize = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ initialize })
    mockedMaybe.mockReturnValue(false)

    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    )

    expect(maybeSilentLogin).toHaveBeenCalledTimes(1)
    expect(initialize).toHaveBeenCalledTimes(1)
  })

  it("skips initialize() when a silent probe is navigating the page away", () => {
    const initialize = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ initialize })
    mockedMaybe.mockReturnValue(true)

    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    )

    expect(maybeSilentLogin).toHaveBeenCalledTimes(1)
    expect(initialize).not.toHaveBeenCalled()
  })

  it("兄弟标签缓存清理失败时进入可重试阻塞态，不会永久空转 spinner", async () => {
    useAuthStore.setState({
      initialize: vi.fn(),
      prepareAccountSwitch: vi.fn().mockRejectedValue(new Error("cache cleanup failed")),
      status: "authenticated",
      accountSwitchError: null,
    })
    mockedMaybe.mockReturnValue(false)
    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    )

    sdkSubscriber.current?.({ status: "synchronizing", user: null })
    useAuthStore.setState({ status: "synchronizing" })
    sdkSubscriber.current?.({ status: "authenticated", user: { id: "u-b" } })

    await waitFor(() => {
      expect(useAuthStore.getState().accountSwitchError).toContain("cache cleanup failed")
    })
    expect(useAuthStore.getState().status).toBe("synchronizing")
  })
})
