"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react"
import type { StreamingImage } from "@/types/api"
import { appendMediaToken } from "@/lib/media-url"
import { getMediaTicket } from "@/lib/media-ticket"

/**
 * 公开详情页媒体票等待超时：票签发失败或 mint 后 N 毫秒仍未到达时，
 * 放弃等待、直接渲 ImageLoader（无票请求走既有 401 → 换票重试链）。
 * 私有页热票走 getMediaTicketSync 挂载即有值，基本不触发此超时。
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
}: {
  baseUrl: string
  mediaToken: string | null
  description: string
  className: string
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
    // 仅对走鉴权的媒体代理 URL 做「换票 + 重试」；非代理 URL 没有 token 问题，直接回退。
    const isProxy = appendMediaToken(baseUrl, "probe") !== baseUrl
    if (!isProxy || attempt >= MAX_IMAGE_RETRIES) {
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
}: {
  imageUrl: string
  mediaToken: string | null
  description: string
  className: string
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
  className = "",
}: ImagePlaceholderProps) {
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
    return (
      <ImagePlaceholderReady
        imageUrl={imageUrl}
        mediaToken={mediaToken}
        description={description}
        className={className}
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
