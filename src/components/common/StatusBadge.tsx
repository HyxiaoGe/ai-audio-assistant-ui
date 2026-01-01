import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/types"
import { useI18n } from "@/lib/i18n-context"

interface StatusBadgeProps {
  status: TaskStatus
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { t } = useI18n()
  const statusConfig: Partial<Record<TaskStatus, { label: string; className: string }>> = {
    pending: {
      label: t("task.status.pending"),
      className: "bg-[var(--app-glass-bg-strong)] text-[var(--app-text-muted)]"
    },
    processing: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    queued: {
      label: t("task.status.pending"),
      className: "bg-[var(--app-glass-bg-strong)] text-[var(--app-text-muted)]"
    },
    resolving: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    downloading: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    downloaded: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    transcoding: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    uploading: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    uploaded: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    resolved: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    extracting: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    asr_submitting: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    asr_polling: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    transcribing: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    summarizing: {
      label: t("status.processing"),
      className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
    },
    completed: {
      label: t("task.status.completed"),
      className: "bg-[var(--app-success-bg)] text-[var(--app-success)]"
    },
    failed: {
      label: t("task.status.failed"),
      className: "bg-[var(--app-danger-bg)] text-[var(--app-danger)]"
    },
  }
  const config = statusConfig[status] || statusConfig.pending!
  return (
    <Badge variant="secondary" className={cn("font-normal", config.className)}>
      {config.label}
    </Badge>
  )
}
