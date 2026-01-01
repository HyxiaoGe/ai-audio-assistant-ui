"use client"

import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import type { RetryMode } from "@/types/api"

interface RetryTaskDialogProps {
  isOpen: boolean
  isRetrying: boolean
  onClose: () => void
  onRetry: (mode: RetryMode) => Promise<void>
}

interface RetryOption {
  value: RetryMode
  label: string
  description: string
  recommended?: boolean
}

export default function RetryTaskDialog({
  isOpen,
  isRetrying,
  onClose,
  onRetry,
}: RetryTaskDialogProps) {
  const { t } = useI18n()
  const [selectedMode, setSelectedMode] = useState<RetryMode>("auto")

  const options = useMemo<RetryOption[]>(
    () => [
      {
        value: "auto",
        label: t("task.retryDialog.options.auto.label"),
        description: t("task.retryDialog.options.auto.desc"),
        recommended: true,
      },
      {
        value: "full",
        label: t("task.retryDialog.options.full.label"),
        description: t("task.retryDialog.options.full.desc"),
      },
      {
        value: "from_transcribe",
        label: t("task.retryDialog.options.fromTranscribe.label"),
        description: t("task.retryDialog.options.fromTranscribe.desc"),
      },
      {
        value: "transcribe_only",
        label: t("task.retryDialog.options.transcribeOnly.label"),
        description: t("task.retryDialog.options.transcribeOnly.desc"),
      },
      {
        value: "summarize_only",
        label: t("task.retryDialog.options.summarizeOnly.label"),
        description: t("task.retryDialog.options.summarizeOnly.desc"),
      },
    ],
    [t]
  )

  if (!isOpen) return null

  const handleClose = () => {
    setSelectedMode("auto")
    onClose()
  }

  const handleRetry = async () => {
    try {
      await onRetry(selectedMode)
      onClose()
    } catch {
      // Errors are handled upstream
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(15, 23, 42, 0.4)" }}
        onClick={handleClose}
      />

      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border shadow-xl"
        style={{
          background: "var(--app-surface)",
          borderColor: "var(--app-glass-border)",
        }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg flex items-center gap-2" style={{ fontWeight: 600, color: "var(--app-text)" }}>
              <RefreshCw className="w-4 h-4" />
              {t("task.retryDialog.title")}
            </h2>
            <button
              onClick={handleClose}
              className="text-sm"
              style={{ color: "var(--app-text-subtle)" }}
            >
              {t("common.cancel")}
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {options.map((option) => {
              const isSelected = selectedMode === option.value
              return (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors"
                  style={{
                    borderColor: isSelected ? "var(--app-primary)" : "var(--app-glass-border)",
                    background: isSelected ? "var(--app-primary-soft-2)" : "var(--app-surface)",
                  }}
                >
                  <input
                    type="radio"
                    name="retry-mode"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setSelectedMode(option.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 600, color: "var(--app-text)" }}>
                        {option.label}
                      </span>
                      {option.recommended && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--app-success-bg)", color: "var(--app-success)" }}
                        >
                          {t("task.retryDialog.recommended")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1" style={{ color: "var(--app-text-muted)" }}>
                      {option.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={isRetrying}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{
                borderColor: "var(--app-glass-border)",
                color: "var(--app-text-muted)",
              }}
            >
              {t("task.retryDialog.cancel")}
            </button>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-4 py-2 rounded-lg text-sm text-white"
              style={{ background: "var(--app-primary)" }}
            >
              {isRetrying ? t("task.retryDialog.retrying") : t("task.retryDialog.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
