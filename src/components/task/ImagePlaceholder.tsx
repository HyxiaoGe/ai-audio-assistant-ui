"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react"
import type { StreamingImage } from "@/types/api"
import { appendMediaToken } from "@/lib/media-url"
import { getMediaTicket } from "@/lib/media-ticket"

/**
 * 公开详情页媒体票等待超时：票签发失败或 mint 后 N 毫秒仍未到达时，
 * 放弃等待、直接渲 ImageLoader（无票请求走既有 401 → 换票重试链）。
 * 私有页热票由 useMediaToken 在父组件同步读缓存（getMediaTicketSync）后作为非 null prop 传入，
 * 挂载即 ready=true，基本不触发此超时。
 */
const TOKEN_WAIT_TIMEOUT_MS = 5_000

// 媒体代理图鉴权 token 过期/缺失（或瞬时网络）会让 <img> 触发 error。重挂载抖动修掉后，
// 这层重试主要兜底 token 过期：换新票据 + cache-bust 重试有限次，避免一次失败就永久停在
// 「[图片：..]」回退、必须手刷。非代理 URL（外链/data:）没有这个问题，首次失败即回退。
const MAX_IMAGE_RETRIES = 2

interface ImagePlaceholderProps {
  description: string
  status: StreamingImage["status"]
  imageUrl?: string | null
  /** 媒体短票：拼到代理图 URL 的 ?token=。缺省 null（外链图不需要）。 */
  mediaToken?: string | null
  /**
   * 代理回落 URL（公开页 OSS 预签名直链场景，opt-in）：imageUrl（直链）加载失败且尚未切换过时，
   * 切到这里重挂重试（代理路径，走既有媒体票拼 query + 401 换票重试链）；在回落 URL 上仍失败
   * 才进「[图片：..]」显示回退。私有页不传，行为零变化。
   */
  fallbackUrl?: string | null
  className?: string
}

/**
 * Inner component that handles image loading state.
 * Separated to allow resetting via key prop when the (token-less) base URL changes.
 */
function ImageLoader({
  baseUrl,
  mediaToken,
  description,
  className,
  onExhausted,
}: {
  baseUrl: string
  mediaToken: string | null
  description: string
  className: string
  /** 本 URL 的重试机会耗尽时回调（代替显示回退）：父组件据此切到回落 URL 重挂。 */
  onExhausted?: (() => void) | null
}) {
  const [token, setToken] = useState<string | null>(mediaToken)
  const [attempt, setAttempt] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const imageUrl = useMemo(() => {
    const withToken = appendMediaToken(baseUrl, token)
    if (attempt === 0) return withToken
    // 重试加一个无害的 cache-bust 参数：端点忽略未知 query，但能强制浏览器重新发起请求，
    // 不命中上一次失败的连接/缓存状态（响应头是 immutable）。
    return `${withToken}${withToken.includes("?") ? "&" : "?"}_r=${attempt}`
  }, [baseUrl, token, attempt])

  const handleError = () => {
    // 仅对走鉴权的媒体代理 URL 做「换票 + 重试」；非代理 URL 没有 token 问题，直接放弃本 URL。
    const isProxy = appendMediaToken(baseUrl, "probe") !== baseUrl
    if (!isProxy || attempt >= MAX_IMAGE_RETRIES) {
      // 有回落 URL（OSS 预签名直链过期自愈）：交给父组件切到代理回落路径重挂，
      // 而非直接进「[图片：..]」显示回退；没有才终态回退（既有行为）。
      if (onExhausted) {
        onExhausted()
        return
      }
      setImageError(true)
      return
    }
    void getMediaTicket().then((fresh) => {
      setToken(fresh ?? token)
      setImageLoaded(false)
      setAttempt((a) => a + 1)
    })
  }

  if (imageError) {
    return (
      <div
        className={`my-4 p-4 rounded-lg flex items-center gap-2 ${className}`}
        style={{
          backgroundColor: "var(--app-surface-muted)",
          color: "var(--app-text-muted)",
        }}
      >
        <AlertCircle className="size-4 shrink-0" style={{ color: "var(--app-warning)" }} />
        <span className="text-sm">[图片：{description}]</span>
      </div>
    )
  }

  return (
    <figure className={`my-6 ${className}`}>
      <div
        className="rounded-lg overflow-hidden relative aspect-video"
        style={{
          backgroundColor: "var(--app-surface-muted)",
        }}
      >
        {/* Skeleton overlay - shown while image is loading */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${
            imageLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{
            minHeight: "200px",
            backgroundColor: "var(--app-surface-alt)",
          }}
        >
          <div
            className="flex flex-col items-center gap-3 p-6"
            style={{ color: "var(--app-text-muted)" }}
          >
            <div className="relative">
              <ImageIcon className="size-8 opacity-40" />
              <CheckCircle2
                className="size-4 absolute -bottom-1 -right-1"
                style={{ color: "var(--app-success)" }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{description}</p>
              <p className="text-xs mt-1 opacity-60">正在加载图片...</p>
            </div>
          </div>
        </div>

        {/* Actual image with fade-in effect */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={description}
          className={`w-full h-full object-contain transition-opacity duration-500 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={handleError}
        />
      </div>
      <figcaption
        className={`mt-2 text-center text-sm transition-opacity duration-300 ${
          imageLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ color: "var(--app-text-muted)" }}
      >
        {description}
      </figcaption>
    </figure>
  )
}

/**
 * 判断一个 URL 是否需要媒体票鉴权（同源代理 URL）。
 * 与 appendMediaToken / ImageLoader.handleError 中的 "probe" 技巧保持一致语义。
 */
function isProxyUrl(url: string): boolean {
  return appendMediaToken(url, "probe") !== url
}

/**
 * 等待媒体票就绪的 Hook：
 * - token 已有：立即返回 { ready: true, token }
 * - token 为 null 且 URL 是代理 URL：等待（ready=false），token 到了或超时后 ready=true
 * - 非代理 URL（外链/data:）：跳过等待，立即返回 { ready: true, token: null }
 *
 * 目的：阻止在 token 尚未 mint 完成前向代理端点发出无票必 401 的请求。
 * 超时出口（TOKEN_WAIT_TIMEOUT_MS）：mint 失败或网络极慢时不永久占位，
 * 超时后照常渲 ImageLoader，走既有 401 → 换票重试链兜底。
 */
function useTokenReady(
  mediaToken: string | null,
  imageUrl: string,
): { ready: boolean; token: string | null } {
  const needsToken = isProxyUrl(imageUrl)
  // 初值：token 已有 OR 不需要 token → 立即就绪
  const [tokenState, setTokenState] = useState<{ ready: boolean; token: string | null }>(() => ({
    ready: !needsToken || mediaToken !== null,
    token: mediaToken,
  }))

  useEffect(() => {
    // prop 变化（包括 token 从 null 更新为有值）：同步到内部 state
    // 只接受「升级」（null → 有值），已有 token 或已降级（超时后 null 也 ready）不覆盖
    if (mediaToken !== null && tokenState.token === null) {
      setTokenState({ ready: true, token: mediaToken })
      return
    }
    // 已就绪（有 token 或不需要 token 或已超时）：不启动超时计时器
    if (tokenState.ready) return
    // token 为 null 且需要代理鉴权：启动超时计时器，超时后降级发请求走重试链
    const tid = setTimeout(() => {
      setTokenState((prev) => (prev.ready ? prev : { ready: true, token: null }))
    }, TOKEN_WAIT_TIMEOUT_MS)
    return () => clearTimeout(tid)
    // tokenState 故意不入 deps：若加入，每次 state 变化都会清掉并重建超时计时器（变相续期）。
    // 正确性由 setTokenState 的函数式更新（prev.ready ? prev : ...）与「ready 单向升级」保证，无 stale closure 风险。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaToken])

  return tokenState
}

/**
 * ready 状态的内部组件：调用 useTokenReady 决定是渲骨架占位还是 ImageLoader。
 * 独立成组件的原因：useTokenReady 是 Hook，不能在条件分支里调用，
 * 而父组件 ImagePlaceholder 在 pending/failed/ready 间条件渲染。
 */
function ImagePlaceholderReady({
  imageUrl,
  mediaToken,
  description,
  className,
  onExhausted,
}: {
  imageUrl: string
  mediaToken: string | null
  description: string
  className: string
  onExhausted?: (() => void) | null
}) {
  const { ready, token } = useTokenReady(mediaToken, imageUrl)

  if (!ready) {
    // token 尚未就绪：渲骨架占位，不发出无票请求
    return (
      <div
        className={`my-6 rounded-lg overflow-hidden ${className}`}
        style={{ backgroundColor: "var(--app-surface-muted)" }}
      >
        <div
          className="relative flex flex-col items-center justify-center animate-pulse aspect-video"
          style={{ minHeight: "200px", backgroundColor: "var(--app-surface-alt)" }}
        >
          <div
            className="flex flex-col items-center gap-3 p-6"
            style={{ color: "var(--app-text-muted)" }}
          >
            <div className="relative">
              <ImageIcon className="size-8 opacity-40" />
              <Loader2
                className="size-4 animate-spin absolute -bottom-1 -right-1"
                style={{ color: "var(--app-primary)" }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{description}</p>
              <p className="text-xs mt-1 opacity-60">正在加载图片...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // token 就绪（有值或超时降级）：key 锁定 token-less 原始 URL，token 刷新不重挂
  return (
    <ImageLoader
      key={imageUrl}
      baseUrl={imageUrl}
      mediaToken={token}
      description={description}
      className={className}
      onExhausted={onExhausted}
    />
  )
}

/**
 * ImagePlaceholder component for rendering AI-generated images in summaries.
 *
 * States:
 * - pending: Shows skeleton with "waiting" message
 * - generating: Shows skeleton with "generating" message
 * - ready (loading): Shows skeleton with "loading" message while image loads
 * - ready (loaded): Shows the actual image with fade-in effect
 * - failed: Shows fallback text
 *
 * Token race guard (公开详情页竞速修复):
 * 当 imageUrl 为代理 URL 且 mediaToken 尚未就绪（mint 尚未完成）时，
 * 持续渲骨架占位，不渲 ImageLoader，从而阻止无票必 401 的请求。
 * token 到达后用有效 token 初始化 ImageLoader，私有页行为零变化。
 */
export function ImagePlaceholder({
  description,
  status,
  imageUrl,
  mediaToken = null,
  fallbackUrl = null,
  className = "",
}: ImagePlaceholderProps) {
  // 直链过期回落（fallbackUrl，opt-in）：记录「已放弃的主 URL」而非布尔开关——imageUrl 一旦换新
  // （如重拉摘要拿到新预签名直链），failedPrimaryUrl 自动不再匹配，回到主 URL 重试，无需 effect 重置。
  // 切换经 effectiveUrl 反映到 ImagePlaceholderReady 的 key：整支重挂、状态清零，
  // useTokenReady 以代理 URL 语义重新初始化（需要票则等票/超时降级），干净走既有票链。
  const [failedPrimaryUrl, setFailedPrimaryUrl] = useState<string | null>(null)
  const usingFallback = Boolean(fallbackUrl && imageUrl && failedPrimaryUrl === imageUrl)

  // Failed state - show fallback text
  if (status === "failed") {
    return (
      <div
        className={`my-4 p-4 rounded-lg flex items-center gap-2 ${className}`}
        style={{
          backgroundColor: "var(--app-surface-muted)",
          color: "var(--app-text-muted)",
        }}
      >
        <AlertCircle className="size-4 shrink-0" style={{ color: "var(--app-warning)" }} />
        <span className="text-sm">[图片：{description}]</span>
      </div>
    )
  }

  // Ready state with valid image URL
  if (status === "ready" && imageUrl) {
    const effectiveUrl = usingFallback && fallbackUrl ? fallbackUrl : imageUrl
    return (
      <ImagePlaceholderReady
        key={effectiveUrl}
        imageUrl={effectiveUrl}
        mediaToken={mediaToken}
        description={description}
        className={className}
        // 仅主 URL 阶段且有回落 URL 时提供「耗尽即切换」出口；已在回落 URL 上（或无回落）则
        // 不提供——重试机会耗尽走既有「[图片：..]」显示回退，绝不无限循环切换。
        onExhausted={!usingFallback && fallbackUrl ? () => setFailedPrimaryUrl(imageUrl) : null}
      />
    )
  }

  // Pending or generating state - show skeleton with animation
  return (
    <div
      className={`my-6 rounded-lg overflow-hidden ${className}`}
      style={{
        backgroundColor: "var(--app-surface-muted)",
      }}
    >
      {/* Skeleton area with shimmer animation */}
      <div
        className="relative flex flex-col items-center justify-center animate-pulse aspect-video"
        style={{
          minHeight: "200px",
          backgroundColor: "var(--app-surface-alt)",
        }}
      >
        <div
          className="flex flex-col items-center gap-3 p-6"
          style={{ color: "var(--app-text-muted)" }}
        >
          <div className="relative">
            <ImageIcon className="size-8 opacity-40" />
            <Loader2
              className="size-4 animate-spin absolute -bottom-1 -right-1"
              style={{ color: "var(--app-primary)" }}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{description}</p>
            <p className="text-xs mt-1 opacity-60">
              {status === "generating" ? "正在生成图片..." : "等待生成..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImagePlaceholder
