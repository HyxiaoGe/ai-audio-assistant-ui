import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n-context";

/**
 * 全量 TaskStatus → badge 语义色变体。
 * badge.tsx 只有 pending/processing/completed/failed 四种专用配色,
 * 中间处理态(queued/extracting/transcribing/summarizing …)统一归 processing。
 */
const STATUS_BADGE_VARIANT: Record<string, "pending" | "processing" | "completed" | "failed"> = {
  pending: "pending",
  queued: "pending",
  processing: "processing",
  resolving: "processing",
  downloading: "processing",
  downloaded: "processing",
  transcoding: "processing",
  uploading: "processing",
  uploaded: "processing",
  resolved: "processing",
  extracting: "processing",
  asr_submitting: "processing",
  asr_polling: "processing",
  transcribing: "processing",
  polishing: "processing",
  summarizing: "processing",
  completed: "completed",
  failed: "failed",
};

/** 任务状态徽章:统一配色 + i18n 文案,跨页面复用。 */
export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status] ?? "outline"} className={className}>
      {t(`task.status.${status}`)}
    </Badge>
  );
}
