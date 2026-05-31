"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n-context"

/**
 * App Router 段级错误边界：捕获 root layout 之下任意页面渲染抛出的错误，
 * 渲染在 root layout 的 Provider 树内（可用 useI18n / 主题）。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    // 上报到控制台/监控，便于排查（digest 为 Next 生成的服务端错误指纹）
    console.error(error)
  }, [error])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--app-bg)" }}
    >
      <div
        className="glass-panel flex flex-col items-center text-center rounded-2xl border max-w-md w-full"
        style={{ borderColor: "var(--app-glass-border)", padding: "48px 24px" }}
      >
        <div className="mb-4 text-5xl" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="text-h2 mb-2" style={{ color: "var(--app-text)" }}>
          {t("errors.unknownErrorTitle")}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--app-text-muted)" }}>
          {t("errors.unknownError")}
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={reset}>
            <RotateCw aria-hidden="true" />
            {t("common.retry")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home aria-hidden="true" />
              {t("errors.backHome")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
