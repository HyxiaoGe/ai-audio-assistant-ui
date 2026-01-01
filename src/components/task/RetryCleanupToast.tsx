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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--app-warning)" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
