"use client"

import { useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n-context"
import { notifyInfo } from "@/lib/notify"
import { useVersionCheck } from "@/hooks/use-version-check"
import { useVersionStore, dismissBackend, dismissFrontend } from "@/store/version-store"

/**
 * 版本更新提示(唯一渲染者,单组件双呈现):
 * - 前端过期 → 顶部非阻塞横幅 + 「刷新」(刷新是拿到新 bundle 的唯一解)。
 * - 后端过期 → sonner 软 toast(API 通常兼容,不强制刷新),同一新版本只弹一次。
 * 挂 (main)/layout,仅登录用户可见。
 */
export function UpdateBanner() {
  const { t } = useI18n()
  const frontendOutdated = useVersionStore((s) => s.frontendOutdated)
  const backendOutdated = useVersionStore((s) => s.backendOutdated)

  useVersionCheck()

  useEffect(() => {
    if (backendOutdated) {
      notifyInfo(t("version.backendUpdated"))
      dismissBackend()
    }
  }, [backendOutdated, t])

  if (!frontendOutdated) return null

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--app-primary)] bg-[var(--app-primary-soft)] px-4 py-2.5 text-sm text-[var(--app-text-strong)]">
      <span className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 shrink-0" />
        {t("version.frontendUpdated")}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={() => window.location.reload()}>
          {t("version.refresh")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => dismissFrontend()}>
          {t("common.dismiss")}
        </Button>
      </span>
    </div>
  )
}
