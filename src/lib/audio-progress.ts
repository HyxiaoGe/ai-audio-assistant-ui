// 播放进度持久化的 src 归一化（audit MEDIUM [bugs] 修复）。
//
// 背景：<audio> 的 DOM `src` 是浏览器解析过的绝对 URL，且带鉴权 token 查询串
// （media 代理需要）；而 store.src 是不含 token 的逻辑 URL（可能是相对路径）。
// 旧代码持久化 `audio.src`、恢复时拿它跟 store.src 直接比较，永不相等 → 进度恢复
// 是死代码。把两侧都归一到 pathname（丢掉 origin / token / 其余 query / hash）后再
// 比较即可重新生效；对 media 代理 URL 而言 pathname 唯一标识媒体文件。
//
// 顺带好处：持久化归一后的 pathname 不再把 token 写进 localStorage。

const CANONICALIZE_BASE = "http://audio-progress.local"

/**
 * 把音频 src 归一化为可跨会话比较的稳定标识（pathname）。
 * 绝对/相对、带不带 token 都归到同一形式；空值返回 null；无法解析时回退到 trim 后的原串。
 */
export function canonicalizeAudioSrc(src: string | null | undefined): string | null {
  if (!src) return null
  try {
    return new URL(src, CANONICALIZE_BASE).pathname
  } catch {
    const trimmed = src.trim()
    return trimmed || null
  }
}
