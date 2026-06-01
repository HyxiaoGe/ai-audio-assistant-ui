import { beforeEach, describe, expect, it, vi } from "vitest"

// The probe redirects via the SDK's silentLogin (prompt=none). Fake that boundary + configureAuth
// so the test asserts the guard/capture logic, not the SDK redirect itself.
vi.mock("auth-client-web", () => ({
  silentLogin: vi.fn(),
}))
vi.mock("@/lib/auth-sdk", () => ({
  configureAuth: vi.fn(),
}))

import { silentLogin } from "auth-client-web"

import { clearSsoReturn, markSsoProbed, maybeSilentLogin, takeSsoReturnPath } from "./sso-probe"

const mockedSilentLogin = vi.mocked(silentLogin)

const PROBED_KEY = "audio_sso_probed"
const RETURN_KEY = "audio_sso_return"
const ACCESS_TOKEN_KEY = "auth_access_token"

describe("sso-probe: one-shot silent SSO on app load", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it("fires once when there is no token, captures the origin path and sets the loop guard", () => {
    const fired = maybeSilentLogin("/stats?tab=usage")

    expect(fired).toBe(true)
    expect(mockedSilentLogin).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(PROBED_KEY)).toBe("1")
    expect(sessionStorage.getItem(RETURN_KEY)).toBe("/stats?tab=usage")
  })

  it("does NOT fire when a local access token already exists", () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, "tok")

    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("does NOT fire a second time once the guard is set (no redirect loop)", () => {
    sessionStorage.setItem(PROBED_KEY, "1")

    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("does NOT fire while on the callback path (mid token-exchange)", () => {
    expect(maybeSilentLogin("/auth/callback?code=abc&state=xyz")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("markSsoProbed suppresses any later probe (used by logout to block silent re-login)", () => {
    markSsoProbed()
    expect(sessionStorage.getItem(PROBED_KEY)).toBe("1")
    expect(maybeSilentLogin("/tasks")).toBe(false)
    expect(mockedSilentLogin).not.toHaveBeenCalled()
  })

  it("takeSsoReturnPath reads and clears the captured origin", () => {
    sessionStorage.setItem(RETURN_KEY, "/notifications")
    expect(takeSsoReturnPath()).toBe("/notifications")
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull()
    expect(takeSsoReturnPath()).toBeNull()
  })

  it("clearSsoReturn drops a stale captured origin (so it can't hijack a later interactive login)", () => {
    sessionStorage.setItem(RETURN_KEY, "/stats")
    clearSsoReturn()
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull()
  })
})
