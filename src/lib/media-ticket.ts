import { apiClient } from "@/lib/api-client"

/**
 * 媒体短票（scope=media）的进程内缓存。
 *
 * 浏览器 <img>/<audio> 无法带 Authorization 头，需把凭证拼到媒体代理 URL 的
 * ?token= 上。为避免把长效 access JWT 暴露在 URL/代理日志里，改用后端签发的
 * 短期 media 票据；同一用户一页内的所有媒体（图片 + 音频）复用同一张票，到期前
 * 复用、临期重签。失败不缓存（下次调用重试），登出时清除（见 auth-store）。
 */

// 提前这么多毫秒视为过期：给请求在票真正失效前送达留出余量。
const REFRESH_SKEW_MS = 30_000

let cached: { token: string; expiresAt: number } | null = null
let inflight: Promise<string | null> | null = null

function freshToken(now: number): string | null {
  return cached && cached.expiresAt - now > REFRESH_SKEW_MS ? cached.token : null
}

/**
 * 同步读取已缓存且未临近过期的媒体短票；否则返回 null（不触发签发）。
 * 用于渲染期/写 DOM 时无法 await 的场景（媒体 URL 构建）。
 */
export function getMediaTicketSync(): string | null {
  return freshToken(Date.now())
}

/**
 * 取媒体短票：命中有效缓存即返回；否则签发并缓存。并发调用共享同一次在途签发，
 * 签发失败返回 null 且不缓存（下次调用会重试）。
 */
export function getMediaTicket(): Promise<string | null> {
  const hit = freshToken(Date.now())
  if (hit) return Promise.resolve(hit)
  if (inflight) return inflight

  inflight = apiClient
    .mintMediaTicket()
    .then(({ token, expires_in }) => {
      cached = { token, expiresAt: Date.now() + expires_in * 1000 }
      return token
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** 清除缓存的媒体短票（登出/换号时调用，避免把上一用户的票用于下一用户）。 */
export function clearMediaTicket(): void {
  cached = null
  inflight = null
}
