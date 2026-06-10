import { apiClient } from "@/lib/api-client"

/**
 * 媒体短票（scope=media）的进程内缓存。
 *
 * 浏览器 <img>/<audio> 无法带 Authorization 头，需把凭证拼到媒体代理 URL 的
 * ?token= 上。为避免把长效 access JWT 暴露在 URL/代理日志里，改用后端签发的
 * 短期 media 票据；同一页面内的所有媒体（图片 + 音频）复用同一张票，到期前
 * 复用、临期重签。失败不缓存（下次调用重试），登出时清除（见 auth-store）。
 *
 * 公开通道：探索详情页（匿名可看）用「公开任务媒体票」（POST
 * /public/tasks/{id}/media-ticket，票内 resource 钉死该任务）。
 * setPublicMediaTask(taskId) 切换签发通道后，本模块所有下游消费方
 * （useMediaToken / ImagePlaceholder 重签 / audio-store）无需感知差异。
 * 缓存按「签发通道」打标：通道切换立即作废旧票与在途签发，绝不把 A 任务的
 * 公开票用于 B 任务或私有媒体。
 */

// 提前这么多毫秒视为过期：给请求在票真正失效前送达留出余量。
const REFRESH_SKEW_MS = 30_000

let cached: { token: string; expiresAt: number; channel: string } | null = null
let inflight: { promise: Promise<string | null>; channel: string } | null = null
let publicTaskId: string | null = null

function currentChannel(): string {
  return publicTaskId ? `public:${publicTaskId}` : "user"
}

/** 进入/离开公开任务详情页时切换签发通道；同值幂等，变更即作废缓存与在途签发。 */
export function setPublicMediaTask(taskId: string | null): void {
  if (publicTaskId === taskId) return
  publicTaskId = taskId
  cached = null
  inflight = null
}

/**
 * 离开公开详情页时调用：仅当通道仍属于该任务时才回落私有通道，防止乱序卸载误清
 * 新页面通道。场景：公开页 A→B 两实例切换时，若 B 的 mount 先于 A 的 unmount
 * 执行，A 的 cleanup 无条件调 setPublicMediaTask(null) 会把 B 刚设的通道清掉；
 * 改用比对式清除后，A 的 cleanup 发现当前通道已属于 B（不等于 A），不动通道。
 */
export function releasePublicMediaTask(taskId: string): void {
  if (publicTaskId === taskId) setPublicMediaTask(null)
}

function freshToken(now: number): string | null {
  return cached && cached.channel === currentChannel() && cached.expiresAt - now > REFRESH_SKEW_MS
    ? cached.token
    : null
}

/**
 * 同步读取已缓存且未临近过期的媒体短票；否则返回 null（不触发签发）。
 * 用于渲染期/写 DOM 时无法 await 的场景（媒体 URL 构建）。
 */
export function getMediaTicketSync(): string | null {
  return freshToken(Date.now())
}

/**
 * 取媒体短票：命中有效缓存即返回；否则按当前通道签发并缓存。并发调用共享同一次
 * 在途签发，签发失败返回 null 且不缓存（下次调用会重试）。
 */
export function getMediaTicket(): Promise<string | null> {
  const hit = freshToken(Date.now())
  if (hit) return Promise.resolve(hit)
  const channel = currentChannel()
  if (inflight && inflight.channel === channel) return inflight.promise

  const taskId = publicTaskId
  const mint = taskId ? apiClient.mintPublicMediaTicket(taskId) : apiClient.mintMediaTicket()
  const promise = mint
    .then(({ token, expires_in }) => {
      // 在途期间通道可能已切换（快速跳页）：过期通道的结果只返回、不落缓存
      if (currentChannel() === channel) {
        cached = { token, expiresAt: Date.now() + expires_in * 1000, channel }
      }
      return token
    })
    .catch(() => null)
    .finally(() => {
      if (inflight && inflight.channel === channel) inflight = null
    })
  inflight = { promise, channel }
  return promise
}

/**
 * 清除缓存的媒体短票（登出/换号时调用，避免把上一用户的票用于下一用户）。
 *
 * 注意：不重置公开通道（publicTaskId）——通道归属页面生命周期（usePublicMediaToken
 * 挂卸载管理），登出后仍挂载的公开页继续匿名走公开通道是预期行为。
 */
export function clearMediaTicket(): void {
  cached = null
  inflight = null
}
