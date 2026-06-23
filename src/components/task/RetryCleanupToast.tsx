import { AlertTriangle, X } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"

interface RetryCleanupToastProps {
  failedCount: number
  isCleaning: boolean
  onCleanup: () => void
  onDismiss: () => void
}

export default function RetryCleanupToast({
  failedCount,
  isCleaning,
  onCleanup,
  onDismiss,
}: RetryCleanupToastProps) {
  const { t } = useI18n()

  if (failedCount <= 0) {
    return null
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-md shadow-lg rounded-lg p-4 flex items-start gap-3"
      style={{
        background: "var(--app-glass-bg)",
        borderColor: "var(--app-glass-border)",
        borderWidth: "1px",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "var(--app-warning-soft-2)" }}
      >
        <AlertTriangle className="w-5 h-5" style={{ color: "var(--app-warning)" }} />
      </div>

      <div className="flex-1">
        <h4
          className="text-sm mb-1"
          style={{ fontWeight: 600, color: "var(--app-text)" }}
        >
          {t("task.cleanupPromptTitle")}
        </h4>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--app-text-muted)" }}
        >
          {t("task.cleanupPromptMessage", { count: failedCount })}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCleanup}
            disabled={isCleaning}
            className="px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--app-warning)",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            {isCleaning ? t("common.processing") : t("task.cleanupNow")}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded text-xs border transition-colors hover:bg-[var(--app-glass-bg-strong)]"
            style={{
              borderColor: "var(--app-glass-border)",
              color: "var(--app-text-muted)",
            }}
          >
            {t("common.dismiss")}
          </button>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label={t("common.dismiss")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
