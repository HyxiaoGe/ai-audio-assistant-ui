/**
 * Authentication Token Management
 * Delegates to auth-store for token lifecycle
 */

import { useAuthStore } from "@/store/auth-store"

/**
 * Get valid access token (auto-refreshes if expired)
 */
export async function getToken(): Promise<string | null> {
  return await useAuthStore.getState().getAccessToken()
}

/**
 * Check if user is authenticated (has stored token)
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem("auth_access_token") !== null
}

/**
 * Clear stored tokens
 */
export function clearToken(): void {
  // Handled by auth store logout
  if (typeof window === "undefined") return
  localStorage.removeItem("auth_access_token")
  localStorage.removeItem("auth_refresh_token")
  localStorage.removeItem("auth_token_expiry")
  localStorage.removeItem("auth_user_info")
}
