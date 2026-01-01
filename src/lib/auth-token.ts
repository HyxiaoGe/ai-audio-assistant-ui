/**
 * Authentication Token Management
 * Handles JWT token storage and retrieval
 */

import { getSession } from "next-auth/react"
import { getAuthToken } from "./jwt"

const TOKEN_STORAGE_KEY = "auth_token"
const TOKEN_EXPIRY_KEY = "auth_token_expiry"
const TOKEN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60

/**
 * Get stored token from localStorage
 */
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null

  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)

  if (!token || !expiry) return null

  const expiryTime = parseInt(expiry, 10)
  if (Date.now() >= expiryTime) {
    clearToken()
    return null
  }

  return token
}

/**
 * Store token in localStorage
 */
function storeToken(
  token: string,
  expiresInSeconds: number = TOKEN_EXPIRES_IN_SECONDS
): void {
  if (typeof window === "undefined") return

  const expiryTime = Date.now() + expiresInSeconds * 1000
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
}

/**
 * Clear stored token
 */
export function clearToken(): void {
  if (typeof window === "undefined") return

  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

/**
 * Get valid authentication token
 * Returns stored token if valid, otherwise generates a new one
 */
export async function getToken(): Promise<string | null> {
  const storedToken = getStoredToken()
  if (storedToken) {
    return storedToken
  }

  const session = await getSession()
  const userId = session?.user?.id
  if (!userId) {
    return null
  }

  const newToken = await getAuthToken(userId)
  storeToken(newToken, TOKEN_EXPIRES_IN_SECONDS)

  return newToken
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
  return getStoredToken() !== null
}

/**
 * Force refresh token (for testing or manual refresh)
 */
export async function refreshToken(): Promise<string | null> {
  clearToken()
  return await getToken()
}
