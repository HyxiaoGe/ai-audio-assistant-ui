import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "./auth-store"

describe("auth-store token refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    useAuthStore.setState({ user: null, status: "loading" })
  })

  it("coalesces concurrent refresh requests so rotated refresh tokens are not reused", async () => {
    localStorage.setItem("auth_access_token", "expired-access-token")
    localStorage.setItem("auth_refresh_token", "old-refresh-token")
    localStorage.setItem("auth_token_expiry", String(Date.now() - 1_000))

    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const [firstToken, secondToken] = await Promise.all([
      useAuthStore.getState().getAccessToken(),
      useAuthStore.getState().getAccessToken(),
    ])

    expect(firstToken).toBe("new-access-token")
    expect(secondToken).toBe("new-access-token")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      refresh_token: "old-refresh-token",
    })
    expect(localStorage.getItem("auth_refresh_token")).toBe("new-refresh-token")
  })
})
