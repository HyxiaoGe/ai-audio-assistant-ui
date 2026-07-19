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

export interface EmailLoginCapabilities {
  headless: boolean
}

const EMAIL_LOGIN_UNAVAILABLE: EmailLoginCapabilities = { headless: false }

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

export function isAuthConfigured(): boolean {
  return AUTH_CLIENT_ID.length > 0
}

export function getAuthServiceUrl(): string {
  return AUTH_URL.replace(/\/+$/, "")
}

export function isEmailHeadlessRuntime(
  protocol: string = typeof window === "undefined" ? "" : window.location.protocol
): boolean {
  return protocol === "http:" || protocol === "https:"
}

/**
 * 只有 auth-service 明确为当前 Audio 客户端开放 headless 邮箱认证时才展示入口。
 * 旧服务、异常响应、缺失客户端配置和非 Web 运行时都按不可用降级。
 */
export async function getEmailLoginCapabilities(): Promise<EmailLoginCapabilities> {
  if (
    typeof window === "undefined" ||
    !isAuthConfigured() ||
    !isEmailHeadlessRuntime()
  ) {
    return EMAIL_LOGIN_UNAVAILABLE
  }

  const authBaseUrl = getAuthServiceUrl()
  if (!authBaseUrl) return EMAIL_LOGIN_UNAVAILABLE

  const redirectUri = `${window.location.origin}/auth/callback`
  const query = new URLSearchParams({
    client_id: AUTH_CLIENT_ID,
    redirect_uri: redirectUri,
  })

  try {
    const response = await fetch(`${authBaseUrl}/auth/capabilities?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
    })
    if (!response.ok) return EMAIL_LOGIN_UNAVAILABLE

    const capabilities: unknown = await response.json()
    const headless =
      typeof capabilities === "object" &&
      capabilities !== null &&
      "email_headless_login" in capabilities &&
      capabilities.email_headless_login === true
    return { headless }
  } catch {
    return EMAIL_LOGIN_UNAVAILABLE
  }
}
