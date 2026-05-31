"use client"

import Link from "next/link"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n-context"

/**
 * App Router 根 not-found 边界：未匹配的 URL 及 notFound() 调用都会落到这里，
 * 渲染在 root layout 的 Provider 树内（可用 useI18n / 主题）。
 */
export default function NotFound() {
  const { t } = useI18n()

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--app-bg)" }}
    >
      <div
        className="glass-panel flex flex-col items-center text-center rounded-2xl border max-w-md w-full"
        style={{ borderColor: "var(--app-glass-border)", padding: "48px 24px" }}
      >
        <div className="mb-4 text-6xl font-semibold" style={{ color: "var(--app-text-faint)" }}>
          404
        </div>
        <h1 className="text-h2 mb-2" style={{ color: "var(--app-text)" }}>
          {t("errors.pageNotFoundTitle")}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--app-text-muted)" }}>
          {t("errors.pageNotFoundDesc")}
        </p>
        <Button asChild>
          <Link href="/">
            <Home aria-hidden="true" />
            {t("errors.backHome")}
          </Link>
        </Button>
      </div>
    </div>
  )
}
