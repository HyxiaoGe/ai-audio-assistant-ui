/**
 * FailedState Component
 * Displays error information and retry option
 */

"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n-context"

interface FailedStateProps {
  error?: string
  onRetry?: () => void
}

export function FailedState({ error, onRetry }: FailedStateProps) {
  const { t } = useI18n()
  const errorMessage = error || t("errors.processFailedDesc")

  return (
    <div
      className="glass-panel p-8 rounded-lg"
      style={{
        backgroundColor: "var(--app-danger-bg-soft)",
        border: "1px solid var(--app-danger-bg)",
      }}
    >
      <div className="max-w-2xl mx-auto text-center space-y-6">
        {/* Error icon */}
        <div
          className="flex items-center justify-center size-16 rounded-full mx-auto"
          style={{ backgroundColor: "var(--app-danger-bg)" }}
        >
          <AlertCircle className="size-8" style={{ color: "var(--app-danger)" }} />
        </div>

        {/* Error title */}
        <div>
          <h3 className="text-xl font-semibold" style={{ color: "var(--app-danger-strong)" }}>
            {t("errors.processFailedTitle")}
          </h3>
          <p className="text-sm mt-2" style={{ color: "var(--app-danger-deep)" }}>
            {errorMessage}
          </p>
        </div>

        {/* Retry button */}
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="destructive"
            size="lg"
            className="gap-2"
          >
            <RefreshCw className="size-5" />
            {t("common.retry")}
          </Button>
        )}

        {/* Additional info */}
        <div
          className="glass-panel-strong text-xs p-4 rounded-lg text-left"
          style={{
            border: "1px solid var(--app-danger-bg)",
            color: "var(--app-danger-deep)",
          }}
        >
          <p className="font-medium mb-2">{t("failedState.possibleReasons")}</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{t("failedState.reasonFormat")}</li>
            <li>{t("failedState.reasonQuality")}</li>
            <li>{t("failedState.reasonService")}</li>
            <li>{t("failedState.reasonNetwork")}</li>
          </ul>
          <p className="mt-3">
            {t("failedState.contactSupport")}
          </p>
        </div>
      </div>
    </div>
  )
}
