/**
 * Bootstraps the shared SSO SDK (auth-client-web) for this app.
 *
 * configure() is bound to audio's PRE-EXISTING localStorage keys so the migration is
 * zero-logout: already-signed-in users keep their tokens. Must run client-side (it reads
 * window.location.origin for the callback URL) and exactly once; both are enforced here so
 * callers can invoke it freely (e.g. from a provider mount or before any SDK use).
 */

import { configure } from "auth-client-web"

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:8100"
const AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH_CLIENT_ID || ""

let configured = false

export function configureAuth(): void {
  if (configured || typeof window === "undefined") return
  configure({
    authUrl: AUTH_URL,
    clientId: AUTH_CLIENT_ID,
    redirectUri: `${window.location.origin}/auth/callback`,
    storageKeys: {
      accessToken: "auth_access_token",
      refreshToken: "auth_refresh_token",
      expiresAt: "auth_token_expiry",
      user: "auth_user_info",
    },
  })
  configured = true
}
