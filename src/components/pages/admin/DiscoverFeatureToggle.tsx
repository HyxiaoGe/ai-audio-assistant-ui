"use client"

import { useEffect, useState } from "react"
import { useAPIClient } from "@/lib/use-api-client"
import { useI18n } from "@/lib/i18n-context"
import { Button } from "@/components/ui/button"
import { notifyError, notifySuccess } from "@/lib/notify"

export default function DiscoverFeatureToggle() {
  const client = useAPIClient()
  const { t } = useI18n()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let alive = true
    client
      .getDiscoverConfig()
      .then((c) => {
        if (alive) setEnabled(c.enabled)
      })
      .catch(() => {
        if (alive) setEnabled(true) // 无配置行 / 读取失败 → 默认开
      })
    return () => {
      alive = false
    }
  }, [client])

  const apply = async (next: boolean) => {
    setBusy(true)
    try {
      const c = await client.setDiscoverEnabled(next)
      setEnabled(c.enabled)
      notifySuccess(next ? t("admin.discover.enabledToast") : t("admin.discover.disabledToast"))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : t("admin.discover.actionFailed"))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const onClick = () => {
    if (enabled === null) return
    if (enabled) {
      if (!confirming) {
        setConfirming(true)
        return
      }
      void apply(false)
    } else {
      void apply(true)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-[var(--app-text)]">{t("admin.discover.title")}</p>
        <p className="text-sm text-[var(--app-text-muted)]">{t("admin.discover.description")}</p>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {t("admin.discover.statusLabel")}:{" "}
          {enabled === null ? "…" : enabled ? t("admin.discover.on") : t("admin.discover.off")}
        </p>
      </div>
      <Button onClick={onClick} disabled={busy || enabled === null}>
        {enabled
          ? confirming
            ? t("admin.discover.confirmDisable")
            : t("admin.discover.disableAction")
          : t("admin.discover.enableAction")}
      </Button>
    </div>
  )
}
