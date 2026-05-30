"use client"

import { useEffect, useState } from "react"
import { getToken, getTokenSync } from "@/lib/auth-token"

/**
 * Same-origin proxy endpoints that require an auth token. Browser <audio>/<img>
 * elements can't send an Authorization header, so the token rides in the query
 * string (mirrors the SSE pattern in TaskDetail). Only relative same-origin
 * /api/v1/media and /api/v1/summaries/images paths are rewritten — absolute /
 * external / data URLs (e.g. OAuth avatars) pass through untouched.
 */
const MEDIA_PROXY_RE = /^\/api\/v1\/(media|summaries\/images)\//

/**
 * Append `?token=<accessToken>` to a same-origin media/image proxy URL so the
 * browser request authenticates against the gated backend. No-op for empty
 * input, a missing token, or a non-proxy URL.
 */
export function appendMediaToken(url: string | null | undefined, token: string | null): string {
  if (!url) return url ?? ""
  if (!token || !MEDIA_PROXY_RE.test(url)) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

/**
 * Resolve the current access token for media/image URLs. Seeds synchronously
 * from storage to avoid an initial un-tokenized request, then refreshes
 * asynchronously once on mount (covers token rotation). Returns null when
 * unauthenticated.
 */
export function useMediaToken(): string | null {
  const [token, setToken] = useState<string | null>(() => getTokenSync())
  useEffect(() => {
    let active = true
    getToken().then((fresh) => {
      if (active && fresh) setToken(fresh)
    })
    return () => {
      active = false
    }
  }, [])
  return token
}
