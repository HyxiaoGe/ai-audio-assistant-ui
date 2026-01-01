/**
 * 文件上传主组件
 * 功能：
 * - 拖拽上传 + 点击选择
 * - 文件类型和大小验证
 * - 完整的上传流程（hash → presign → S3 → task）
 * - 进度显示
 */

"use client"

import { useState, useRef, DragEvent, ChangeEvent } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { UploadProgress } from "./UploadProgress"
import { useFileUpload } from "@/hooks/use-file-upload"
import type { TaskOptions } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

interface FileUploaderProps {
  /** 任务选项 */
  options?: TaskOptions
  /** 上传成功回调 */
  onSuccess?: (taskId: string) => void
  /** 上传失败回调 */
  onError?: (error: Error) => void
}

export function FileUploader({
  options,
  onSuccess,
  onError,
}: FileUploaderProps) {
  const { t } = useI18n()
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { state, uploadFile, reset, isUploading } = useFileUpload()

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (file: File) => {
    try {
      const taskId = await uploadFile(file, options)
      onSuccess?.(taskId)
    } catch (error) {
      onError?.(error as Error)
    }
  }

  /**
   * 拖拽相关处理
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isUploading && state.stage !== "success") {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    if (isUploading || state.stage === "success") return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  /**
   * 点击上传
   */
  const handleClick = () => {
    if (!isUploading && state.stage !== "success") {
      fileInputRef.current?.click()
    }
  }

  /**
   * 文件输入框变化
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  /**
   * 取消上传
   */
  const handleCancel = () => {
    reset()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // 上传中或已成功状态
  if (state.file && (isUploading || state.stage === "success")) {
    return (
      <Card className="w-full p-6">
        <UploadProgress
          stage={state.stage}
          progress={state.progress}
          fileName={state.file.name}
          error={state.error}
        />

        {/* 操作按钮 */}
        {state.stage !== "success" && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
          </div>
        )}

        {state.stage === "success" && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleCancel}>
              {t("upload.uploadNewFile")}
            </Button>
          </div>
        )}
      </Card>
    )
  }

  // 错误状态
  if (state.stage === "error") {
    return (
      <Card className="w-full p-6">
        <UploadProgress
          stage={state.stage}
          progress={state.progress}
          fileName={state.file?.name || t("upload.unknownFile")}
          error={state.error}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            {t("upload.chooseAgain")}
          </Button>
          {state.file && (
            <Button
              size="sm"
              onClick={() => handleFileSelect(state.file!)}
            >
              {t("common.retry")}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // 默认状态：拖拽区域
  return (
    <div
      className="glass-panel relative w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all"
      style={{
        borderColor: isDragOver ? "var(--app-primary)" : "var(--app-glass-border)",
        backgroundColor: isDragOver
          ? "var(--app-primary-soft-2)"
          : "var(--app-glass-bg)",
        minHeight: "240px",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.webm"
        onChange={handleFileChange}
      />

      <div className="h-full flex flex-col items-center justify-center px-8 py-12 gap-4">
        <Upload
          className="size-12"
          style={{ color: isDragOver ? "var(--app-primary)" : "var(--app-text-muted)" }}
        />

        <div className="text-center space-y-2">
          <p
            className="text-base font-medium"
            style={{ color: isDragOver ? "var(--app-primary)" : "var(--app-text)" }}
          >
            {t("upload.dropHere")}{" "}
            <span style={{ color: "var(--app-primary)" }}>{t("upload.clickToUpload")}</span>
          </p>

          <p
            className="text-sm"
            style={{ color: isDragOver ? "var(--app-primary)" : "var(--app-text-subtle)" }}
          >
            {t("upload.supportedFormats")}
          </p>
        </div>
      </div>
    </div>
  )
}
