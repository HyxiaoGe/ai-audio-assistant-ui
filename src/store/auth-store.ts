/**
 * Auth Store - 基于 auth-service 的认证状态管理
 *
 * 替代 NextAuth，直接管理 auth-service 的 access_token / refresh_token
 */

import { create } from "zustand"

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:8100"
const AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH_CLIENT_ID || ""

const ACCESS_TOKEN_KEY = "auth_access_token"
const REFRESH_TOKEN_KEY = "auth_refresh_token"
const TOKEN_EXPIRY_KEY = "auth_token_expiry"
const USER_INFO_KEY = "auth_user_info"

export interface AuthUserPreferences {
  locale: string
  timezone: string
  theme: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar_url?: string
  is_superuser: boolean
  preferences: AuthUserPreferences
}

interface AuthState {
  user: AuthUser | null
  status: "loading" | "authenticated" | "unauthenticated"

  // Actions
  initialize: () => Promise<void>
  exchangeCode: (code: string) => Promise<void>
  getAccessToken: () => Promise<string | null>
  logout: () => Promise<void>
}

function getStored(key: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(key)
}

function setStored(key: string, value: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, value)
}

function removeStored(key: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(key)
}

function clearTokens(): void {
  removeStored(ACCESS_TOKEN_KEY)
  removeStored(REFRESH_TOKEN_KEY)
  removeStored(TOKEN_EXPIRY_KEY)
  removeStored(USER_INFO_KEY)
}

function isTokenExpired(): boolean {
  const expiry = getStored(TOKEN_EXPIRY_KEY)
  if (!expiry) return true
  // Add 30 second buffer
  return Date.now() >= parseInt(expiry, 10) - 30_000
}

async function refreshTokens(): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const refreshToken = getStored(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  try {
    const res = await fetch(`${AUTH_URL}/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      clearTokens()
      return null
    }

    const data = await res.json()
    setStored(ACCESS_TOKEN_KEY, data.access_token)
    setStored(REFRESH_TOKEN_KEY, data.refresh_token)
    setStored(TOKEN_EXPIRY_KEY, (Date.now() + data.expires_in * 1000).toString())
    return data
  } catch {
    clearTokens()
    return null
  }
}

async function fetchUserInfo(accessToken: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${AUTH_URL}/auth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      id: data.id,
      email: data.email,
      name: data.name || "",
      avatar_url: data.avatar_url,
      is_superuser: data.is_superuser ?? false,
      preferences: data.preferences ?? { locale: "zh", timezone: "Asia/Shanghai", theme: "system" },
    }
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  status: "loading",

  initialize: async () => {
    const accessToken = getStored(ACCESS_TOKEN_KEY)
    if (!accessToken) {
      set({ user: null, status: "unauthenticated" })
      return
    }

    // Try to restore user from cache
    const cachedUser = getStored(USER_INFO_KEY)
    if (cachedUser) {
      try {
        set({ user: JSON.parse(cachedUser), status: "authenticated" })
      } catch {
        // ignore parse errors
      }
    }

    // Refresh token if expired
    if (isTokenExpired()) {
      const result = await refreshTokens()
      if (!result) {
        set({ user: null, status: "unauthenticated" })
        return
      }
    }

    // Fetch fresh user info
    const token = getStored(ACCESS_TOKEN_KEY)
    if (token) {
      const user = await fetchUserInfo(token)
      if (user) {
        setStored(USER_INFO_KEY, JSON.stringify(user))
        set({ user, status: "authenticated" })
      } else {
        // Token might be invalid, try refresh
        const result = await refreshTokens()
        if (result) {
          const retryUser = await fetchUserInfo(result.access_token)
          if (retryUser) {
            setStored(USER_INFO_KEY, JSON.stringify(retryUser))
            set({ user: retryUser, status: "authenticated" })
            return
          }
        }
        clearTokens()
        set({ user: null, status: "unauthenticated" })
      }
    }
  },

  exchangeCode: async (code: string) => {
    const res = await fetch(`${AUTH_URL}/auth/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, client_id: AUTH_CLIENT_ID }),
    })

    if (!res.ok) {
      throw new Error("Token exchange failed")
    }

    const data = await res.json()
    setStored(ACCESS_TOKEN_KEY, data.access_token)
    setStored(REFRESH_TOKEN_KEY, data.refresh_token)
    setStored(TOKEN_EXPIRY_KEY, (Date.now() + data.expires_in * 1000).toString())

    // Fetch user info
    const user = await fetchUserInfo(data.access_token)
    if (user) {
      setStored(USER_INFO_KEY, JSON.stringify(user))
      set({ user, status: "authenticated" })
    }
  },

  getAccessToken: async () => {
    const token = getStored(ACCESS_TOKEN_KEY)
    if (!token) return null

    if (isTokenExpired()) {
      const result = await refreshTokens()
      if (!result) {
        set({ user: null, status: "unauthenticated" })
        return null
      }
      return result.access_token
    }

    return token
  },

  logout: async () => {
    const refreshToken = getStored(REFRESH_TOKEN_KEY)
    if (refreshToken) {
      fetch(`${AUTH_URL}/auth/token/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {})
    }
    clearTokens()
    set({ user: null, status: "unauthenticated" })
  },
}))

// Helper functions for OAuth redirects
const AUTH_REDIRECT_KEY = "auth_redirect_path"

export function loginWithGoogle(redirectPath: string = "/tasks") {
  setStored(AUTH_REDIRECT_KEY, redirectPath)
  const callbackUrl = `${window.location.origin}/auth/callback`
  window.location.href = `${AUTH_URL}/auth/oauth/google?client_id=${AUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}`
}

export function loginWithGitHub(redirectPath: string = "/tasks") {
  setStored(AUTH_REDIRECT_KEY, redirectPath)
  const callbackUrl = `${window.location.origin}/auth/callback`
  window.location.href = `${AUTH_URL}/auth/oauth/github?client_id=${AUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}`
}

export function getAndClearRedirectPath(): string {
  const path = getStored(AUTH_REDIRECT_KEY) || "/tasks"
  removeStored(AUTH_REDIRECT_KEY)
  return path
}
