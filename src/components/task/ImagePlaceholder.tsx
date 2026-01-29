"use client"

import { useState } from "react"
import { Loader2, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react"
import type { StreamingImage } from "@/types/api"

interface ImagePlaceholderProps {
  description: string
  status: StreamingImage["status"]
  imageUrl?: string | null
  className?: string
}

/**
 * Inner component that handles image loading state.
 * Separated to allow resetting via key prop when URL changes.
 */
function ImageLoader({
  imageUrl,
  description,
  className,
}: {
  imageUrl: string
  description: string
  className: string
}) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

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
        className="rounded-lg overflow-hidden relative"
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
          className={`w-full h-auto object-contain max-h-96 transition-opacity duration-500 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ minHeight: imageLoaded ? "auto" : "200px" }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
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

  // Ready state with valid image URL - use key to reset state when URL changes
  if (status === "ready" && imageUrl) {
    return (
      <ImageLoader
        key={imageUrl}
        imageUrl={imageUrl}
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
        className="relative flex flex-col items-center justify-center animate-pulse"
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
