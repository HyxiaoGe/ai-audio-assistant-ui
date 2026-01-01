/**
 * TaskDetailHeader Component
 * Displays basic task information at the top of detail page
 */

"use client"

import { FileAudio, FileVideo, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDateFormatter } from "@/lib/use-date-formatter"
import type { TaskDetail, TaskStatus } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

interface TaskDetailHeaderProps {
  task: TaskDetail
}

const STATUS_VARIANTS: Partial<Record<
  TaskStatus,
  "default" | "secondary" | "destructive"
>> = {
  pending: "secondary",
  extracting: "default",
  transcribing: "default",
  summarizing: "default",
  completed: "default",
  failed: "destructive",
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "--:--"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

export function TaskDetailHeader({ task }: TaskDetailHeaderProps) {
  const router = useRouter()
  const { formatRelativeTime } = useDateFormatter()
  const { t } = useI18n()
  const isAudio = task.source_type === "upload" // Simplified for now
  const Icon = isAudio ? FileAudio : FileVideo

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/tasks")}
        className="gap-2"
      >
        <ArrowLeft className="size-4" />
        {t("task.actions.backToList")}
      </Button>

      {/* Header content */}
      <div className="flex items-start gap-4">
        {/* File icon */}
        <div
          className="glass-control flex items-center justify-center size-16 rounded-lg"
        >
          <Icon className="size-8" style={{ color: "var(--app-primary)" }} />
        </div>

        {/* Title and metadata */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold" style={{ color: "var(--app-text)" }}>
              {task.title}
            </h1>
            <Badge variant={STATUS_VARIANTS[task.status] || "default"}>
              {t(`task.status.${task.status}`)}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span style={{ color: "var(--app-text-muted)" }}>
              {t("task.createdAt")} {formatRelativeTime(task.created_at)}
            </span>
            {task.duration_seconds && task.duration_seconds > 0 && (
              <>
                <span style={{ color: "var(--app-text-faint)" }}>•</span>
                <span style={{ color: "var(--app-text-muted)" }}>
                  {t("task.duration")} {formatDuration(task.duration_seconds)}
                </span>
              </>
            )}
            {task.language && (
              <>
                <span style={{ color: "var(--app-text-faint)" }}>•</span>
                <span style={{ color: "var(--app-text-muted)" }}>
                  {t("task.language")}:{" "}
                  {task.language === "auto"
                    ? t("task.languageAuto")
                    : task.language === "zh"
                      ? t("task.languageZh")
                      : task.language === "en"
                        ? t("task.languageEn")
                        : task.language}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
