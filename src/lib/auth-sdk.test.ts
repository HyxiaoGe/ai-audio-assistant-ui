import { describe, expect, it } from "vitest"

import { getConfig } from "auth-client-web"

import { configureAuth } from "./auth-sdk"

describe("configureAuth", () => {
  it("binds the shared SDK to audio's existing localStorage keys (zero-logout migration)", () => {
    configureAuth()
    const c = getConfig()
    // Reusing audio's pre-existing keys means already-logged-in users keep their session
    // through the migration instead of being silently logged out.
    expect(c.storageKeys).toMatchObject({
      accessToken: "auth_access_token",
      refreshToken: "auth_refresh_token",
      expiresAt: "auth_token_expiry",
      user: "auth_user_info",
    })
    expect(c.redirectUri).toContain("/auth/callback")
  })
})
