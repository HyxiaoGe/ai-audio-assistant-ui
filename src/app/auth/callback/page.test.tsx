import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import AuthCallbackPage from "./page"

// A bare landing on /auth/callback with no ?code= is what auth-service's post-logout 302
// produces (Single Logout bounces back to the registered redirect_uri = /auth/callback).
// completeLogin() maps that to { ok:false, error:"no_callback", redirectPath:"/login" }; the
// page must treat it as a clean soft-redirect, NOT the "Login failed" error screen.
const replaceMock = vi.fn()
const completeLoginMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}))
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { completeLogin: () => Promise<unknown> }) => unknown) =>
    sel({ completeLogin: completeLoginMock }),
}))

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    replaceMock.mockClear()
    completeLoginMock.mockReset()
  })
  afterEach(() => vi.clearAllMocks())

  it("post-logout bare landing (no_callback): soft-redirects to /login, no error screen", async () => {
    completeLoginMock.mockResolvedValue({ ok: false, redirectPath: "/login", error: "no_callback" })
    render(<AuthCallbackPage />)
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"))
    expect(screen.queryByText("Login failed. Please try again.")).not.toBeInTheDocument()
  })

  it("authenticated: routes to the resolved redirectPath", async () => {
    completeLoginMock.mockResolvedValue({ ok: true, redirectPath: "/tasks" })
    render(<AuthCallbackPage />)
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/tasks"))
  })

  it("silent probe miss (login_required): soft-redirects, no error screen", async () => {
    completeLoginMock.mockResolvedValue({ ok: false, redirectPath: "/stats", error: "login_required" })
    render(<AuthCallbackPage />)
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/stats"))
    expect(screen.queryByText("Login failed. Please try again.")).not.toBeInTheDocument()
  })

  it("a real auth error (e.g. access_denied): shows the error screen, does NOT redirect", async () => {
    completeLoginMock.mockResolvedValue({ ok: false, redirectPath: "/login", error: "access_denied" })
    render(<AuthCallbackPage />)
    await screen.findByText("Login failed. Please try again.")
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
