/**
 * ProcessingState Component
 * Displays current processing stage and progress
 */

"use client"

import { Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { TaskStatus } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

interface ProcessingStateProps {
  status: TaskStatus
  progress?: number
  stage?: string
}

export function ProcessingState({
  status,
  progress = 0,
  stage,
}: ProcessingStateProps) {
  const { t } = useI18n()
  const isProcessing =
    status === "pending" ||
    status === "extracting" ||
    status === "transcribing" ||
    status === "summarizing"

  if (!isProcessing) {
    return null
  }

  const stageLabels: Partial<Record<TaskStatus, string>> = {
    pending: t("processingState.pending"),
    extracting: t("processingState.extracting"),
    transcribing: t("processingState.transcribing"),
    summarizing: t("processingState.summarizing"),
    completed: t("task.status.completed"),
    failed: t("task.status.failed"),
  }

  const stageDescriptions: Partial<Record<TaskStatus, string>> = {
    pending: t("processingState.pendingDesc"),
    extracting: t("processingState.extractingDesc"),
    transcribing: t("processingState.transcribingDesc"),
    summarizing: t("processingState.summarizingDesc"),
    completed: t("processingState.completedDesc"),
    failed: t("processingState.failedDesc"),
  }

  const label = stage || stageLabels[status]
  const description = stageDescriptions[status]
  const displayProgress = Math.max(0, Math.min(100, progress))

  return (
    <div
      className="glass-panel p-8 rounded-lg"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Icon and title */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center size-12 rounded-full"
            style={{ backgroundColor: "var(--app-primary-soft)" }}
          >
            <Loader2
              className="size-6 animate-spin"
              style={{ color: "var(--app-primary)" }}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold" style={{ color: "var(--app-text)" }}>
              {label}
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--app-text-muted)" }}>
              {description}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "var(--app-text-muted)" }}>{t("task.processingProgress")}</span>
            <span
              className="font-medium tabular-nums"
              style={{ color: "var(--app-primary)" }}
            >
              {displayProgress}%
            </span>
          </div>
          <Progress value={displayProgress} className="h-2" />
        </div>

        {/* Stage timeline */}
        <div className="flex items-center justify-between pt-4">
          {(
            ["extracting", "transcribing", "summarizing"] as const
          ).map((stageStatus, index) => {
            const isActive = status === stageStatus
            const isPassed =
              (status === "transcribing" && index === 0) ||
              (status === "summarizing" && index <= 1)

            return (
              <div key={stageStatus} className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center size-8 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor:
                      isActive || isPassed
                        ? "var(--app-primary)"
                        : "var(--app-glass-border)",
                    color: isActive || isPassed
                      ? "var(--app-button-primary-text)"
                      : "var(--app-text-subtle)",
                  }}
                >
                  {index + 1}
                </div>
                <span
                  className="text-sm"
                  style={{
                    color: isActive || isPassed
                      ? "var(--app-text)"
                      : "var(--app-text-subtle)",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {stageLabels[stageStatus]}
                </span>
                {index < 2 && (
                  <div
                    className="w-12 h-0.5 mx-2"
                    style={{
                      backgroundColor: isPassed
                        ? "var(--app-primary)"
                        : "var(--app-glass-border)",
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
