"use client"

import { useMemo, useState } from "react"
import { Loader2, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react"
import type { StreamingImage } from "@/types/api"
import { appendMediaToken } from "@/lib/media-url"
import { getMediaTicket } from "@/lib/media-ticket"

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
 * ImagePlaceholder component for rendering AI-generated images in summaries.
 *
 * States:
 * - pending: Shows skeleton with "waiting" message
 * - generating: Shows skeleton with "generating" message
 * - ready (loading): Shows skeleton with "loading" message while image loads
 * - ready (loaded): Shows the actual image with fade-in effect
 * - failed: Shows fallback text
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

  // Ready state with valid image URL - key by the token-less base url so a token refresh
  // (retry) doesn't remount and lose load state; only a genuinely new image resets.
  if (status === "ready" && imageUrl) {
    return (
      <ImageLoader
        key={imageUrl}
        baseUrl={imageUrl}
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
