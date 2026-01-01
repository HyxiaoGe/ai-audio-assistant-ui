/**
 * 上传进度显示组件
 * 显示不同阶段的进度和状态
 */

"use client"

import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { UploadStage } from "@/hooks/use-file-upload"
import { useI18n } from "@/lib/i18n-context"

interface UploadProgressProps {
  stage: UploadStage
  progress: number
  fileName: string
  error?: string | null
}

const STAGE_COLORS: Record<UploadStage, string> = {
  idle: "var(--app-text-muted)",
  validating: "var(--app-primary)",
  hashing: "var(--app-primary)",
  checking: "var(--app-primary)",
  uploading: "var(--app-primary)",
  creating: "var(--app-primary)",
  success: "var(--app-success)",
  error: "var(--app-danger)",
}

export function UploadProgress({
  stage,
  progress,
  fileName,
  error,
}: UploadProgressProps) {
  const isProcessing =
    stage !== "idle" && stage !== "success" && stage !== "error"
  const isSuccess = stage === "success"
  const isError = stage === "error"
  const { t } = useI18n()

  const stageLabels: Record<UploadStage, string> = {
    idle: t("upload.stageIdle"),
    validating: t("upload.stageValidating"),
    hashing: t("upload.stageHashing"),
    checking: t("upload.stageChecking"),
    uploading: t("upload.stageUploading"),
    creating: t("upload.stageCreating"),
    success: t("upload.stageSuccess"),
    error: t("upload.stageError"),
  }

  return (
    <div className="w-full space-y-4">
      {/* 文件名和状态 */}
      <div className="flex items-center gap-3">
        {isProcessing && (
          <Loader2
            className="size-5 animate-spin shrink-0"
            style={{ color: STAGE_COLORS[stage] }}
          />
        )}
        {isSuccess && (
          <CheckCircle2
            className="size-5 shrink-0"
            style={{ color: STAGE_COLORS.success }}
          />
        )}
        {isError && (
          <AlertCircle
            className="size-5 shrink-0"
            style={{ color: STAGE_COLORS.error }}
          />
        )}

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--app-text)" }}
          >
            {fileName}
          </p>
          <p className="text-xs" style={{ color: STAGE_COLORS[stage] }}>
            {stageLabels[stage]}
          </p>
        </div>

        <span className="text-sm font-medium" style={{ color: "var(--app-text-muted)" }}>
          {progress}%
        </span>
      </div>

      {/* 进度条 */}
      <Progress value={progress} className="h-2" />

      {/* 错误信息 */}
      {isError && error && (
        <div
          className="text-sm p-3 rounded-lg"
          style={{ color: "var(--app-danger)", backgroundColor: "var(--app-danger-bg-soft)" }}
        >
          {error}
        </div>
      )}

      {/* 阶段提示 */}
      {isProcessing && (
        <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
          {stage === "hashing" && t("upload.hashingTip")}
          {stage === "checking" && t("upload.checkingTip")}
          {stage === "uploading" && t("upload.uploadingTip")}
          {stage === "creating" && t("upload.creatingTip")}
        </p>
      )}
    </div>
  )
}
