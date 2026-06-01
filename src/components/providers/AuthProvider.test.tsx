import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

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
})
