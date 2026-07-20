/**
 * Authentication Token Management
 * Delegates to auth-store for token lifecycle
 */

import { useAuthStore } from "@/store/auth-store"
import { tokenStore as sdkTokenStore } from "auth-client-web"
import { configureAuth } from "@/lib/auth-sdk"

/**
 * Get valid access token (auto-refreshes if expired)
 */
export async function getToken(): Promise<string | null> {
  return await useAuthStore.getState().getAccessToken()
}

/**
 * Synchronously read the stored access token (no refresh). For render-time
 * media URL building where awaiting isn't possible; pair with getToken() to
 * refresh. Returns null on the server or when unauthenticated.
 */
export function getTokenSync(): string | null {
  if (typeof window === "undefined") return null
  configureAuth()
  return sdkTokenStore().getAccessToken()
}

/**
 * Check if user is authenticated (has stored token)
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  configureAuth()
  return sdkTokenStore().getAccessToken() !== null
}

/**
 * Clear stored tokens
 */
export function clearToken(): void {
  // Handled by auth store logout
  if (typeof window === "undefined") return
  configureAuth()
  sdkTokenStore().clear()
}
