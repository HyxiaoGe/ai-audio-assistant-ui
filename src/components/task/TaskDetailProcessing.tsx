import { Progress } from "@/components/ui/progress"
import { formatDuration } from "@/lib/utils"
import { useDateFormatter } from "@/lib/use-date-formatter"
import type { Task } from "@/types"
import { useI18n } from "@/lib/i18n-context"

interface TaskDetailProcessingProps {
  task: Task
}

export const TaskDetailProcessing = ({ task }: TaskDetailProcessingProps) => {
  const progress = task.progress ?? 0
  const { formatRelativeTime } = useDateFormatter()
  const { t } = useI18n()

  const getStageLabel = () => {
    if (task.status) {
      return t(`task.status.${task.status}`)
    }
    if (progress < 33) return t("task.stage.uploadDone")
    if (progress < 66) return t("task.stage.transcribing")
    if (progress < 100) return t("task.stage.summarizing")
    return t("task.stage.done")
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t("common.unknown")
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-lg p-4">
        <h1 className="text-xl font-semibold text-[var(--app-text)]">{task.title}</h1>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {formatDuration(task.duration)} · {formatRelativeTime(task.createdAt)}
        </p>
      </div>

      <div className="glass-panel rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--app-text-muted)]">{t("task.processingProgress")}</p>
            <p className="text-lg font-semibold text-[var(--app-text)]">{getStageLabel()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--app-text-muted)]">{t("task.fileSize")}</p>
            <p className="text-sm font-medium text-[var(--app-text)]">{formatFileSize(task.fileSize)}</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-[var(--app-text-muted)]">
            <span>{progress}%</span>
            <span>{t("task.eta", { minutes: 5 })}</span>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-lg p-4 text-sm text-[var(--app-primary)]" style={{ background: "var(--app-primary-soft-2)" }}>
        {t("task.error.processingTips")}
      </div>
    </div>
  )
}
