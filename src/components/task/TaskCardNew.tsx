/**
 * 任务卡片组件（API 版本）
 * 根据后端 TaskListItem 类型设计
 */

"use client"

import { FileAudio, Video, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useDateFormatter } from "@/lib/use-date-formatter"
import type { TaskListItem, TaskStatus } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

interface TaskCardNewProps {
  task: TaskListItem
  onClick?: () => void
  onRetry?: () => void
  isRetrying?: boolean
}

const STATUS_VARIANTS: Record<
  TaskStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "default",
  queued: "secondary",
  resolving: "default",
  downloading: "default",
  downloaded: "default",
  transcoding: "default",
  uploading: "default",
  uploaded: "default",
  resolved: "default",
  extracting: "default",
  asr_submitting: "default",
  asr_polling: "default",
  transcribing: "default",
  summarizing: "default",
  completed: "default",
  failed: "destructive",
}

/**
 * 格式化时长
 */
function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

export function TaskCardNew({
  task,
  onClick,
  onRetry,
  isRetrying = false,
}: TaskCardNewProps) {
  const { formatRelativeTime } = useDateFormatter()
  const { t } = useI18n()
  const isProcessing =
    task.status !== "completed" && task.status !== "failed"

  const getIcon = () => {
    if (task.source_type === "youtube") {
      return <Video className="size-6" />
    }
    return <FileAudio className="size-6" />
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick?.()
        }
      }}
      className="glass-item w-full rounded-xl p-5 flex flex-col gap-3 group"
    >
      {/* 顶部：图标 + 信息 + 状态 */}
      <div className="flex items-start justify-between gap-4">
        {/* 左侧：图标 + 信息 */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* 图标 */}
          <div
            className="size-6 flex items-center justify-center shrink-0 mt-0.5"
            style={{ color: "var(--app-text-muted)" }}
          >
            {getIcon()}
          </div>

          {/* 文字信息 */}
          <div className="flex-1 min-w-0 text-left">
            {/* 标题 */}
            <div
              className="text-base mb-1 truncate"
              style={{
                fontWeight: 500,
                color: "var(--app-text)",
              }}
            >
              {task.title}
            </div>

            {/* 副信息 */}
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--app-text-muted)" }}
            >
              <Clock className="size-3" />
              <span>{formatDuration(task.duration_seconds)}</span>
              <span>·</span>
              <span>{formatRelativeTime(task.created_at)}</span>
            </div>
            {task.status === "failed" && task.error_message && (
              <div
                className="text-xs mt-1 line-clamp-2"
                style={{ color: "var(--app-danger)" }}
              >
                {task.error_message}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：状态 Badge */}
        <div className="shrink-0">
          <Badge variant={STATUS_VARIANTS[task.status]}>
            {t(`task.status.${task.status}`)}
          </Badge>
        </div>
      </div>

      {/* 底部：进度条（仅处理中状态显示） */}
      {isProcessing && task.progress !== undefined && (
        <div className="space-y-2">
          <Progress value={task.progress} className="h-1.5" />
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: "var(--app-text-muted)" }}
          >
            <span>{t("task.processingProgress")}</span>
            <span>{task.progress}%</span>
          </div>
        </div>
      )}

      {task.status === "failed" && onRetry && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRetry()
            }}
            disabled={isRetrying}
            className="px-3 py-1.5 rounded text-xs transition-colors bg-[var(--app-danger)] hover:bg-[#b91c1c] active:bg-[#991b1b] dark:hover:bg-[#f87171] dark:active:bg-[#ef4444] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              color: "var(--app-button-primary-text)",
              fontWeight: 500,
            }}
          >
            {isRetrying ? t("common.processing") : t("common.retry")}
          </button>
        </div>
      )}
    </div>
  )
}
