"use client"

import { useEffect, useState } from "react"
import { getMediaTicket, getMediaTicketSync, setPublicMediaTask } from "@/lib/media-ticket"

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
 * Resolve a short-lived, media-scoped ticket for media/image URLs (NOT the
 * long-lived access JWT — keeps the bearer token out of URLs/proxy logs).
 * Seeds synchronously from the shared cache when one is already warm (e.g. from
 * another media element on the page), otherwise mints once on mount. Returns
 * null until the ticket is available; the media element then re-renders with
 * the tokened URL. Deliberately does NOT fall back to the access JWT.
 */
export function useMediaToken(): string | null {
  const [token, setToken] = useState<string | null>(() => getMediaTicketSync())
  useEffect(() => {
    let active = true
    getMediaTicket().then((ticket) => {
      if (active && ticket) setToken(ticket)
    })
    return () => {
      active = false
    }
  }, [])
  return token
}

/**
 * 公开任务详情页的媒体票：挂载时把签发通道切到该任务的公开票（匿名可签），
 * 卸载时切回私有通道。通道切换后，页面内所有媒体消费方（MarkdownContent 配图、
 * audio-store 播放源、ImagePlaceholder 401 重签）都经 getMediaTicket() 自动
 * 拿到公开票，无需各自感知。
 */
export function usePublicMediaToken(taskId: string): string | null {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    if (!taskId) return
    setPublicMediaTask(taskId)
    let active = true
    getMediaTicket().then((ticket) => {
      if (active && ticket) setToken(ticket)
    })
    return () => {
      active = false
      setPublicMediaTask(null)
    }
  }, [taskId])
  return token
}
