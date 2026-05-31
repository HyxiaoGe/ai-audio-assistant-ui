"use client"

import { Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"

/**
 * (main) 段的 Suspense 兜底：路由切换 / RSC 流式加载期间显示，
 * 避免内容就绪前的白屏闪烁。渲染在 Provider 树内，可用 useI18n。
 */
export default function Loading() {
  const { t } = useI18n()

  return (
    <div
      role="status"
      aria-label={t("common.loading")}
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--app-bg)" }}
    >
      <Loader2
        className="w-8 h-8 animate-spin"
        style={{ color: "var(--app-text-muted)" }}
        aria-hidden="true"
      />
    </div>
  )
}
