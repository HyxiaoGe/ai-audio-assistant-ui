/**
 * 文件上传 Hook
 * 管理完整的文件上传流程：hash 计算 → 预签名 → S3 上传 → 创建任务
 */

"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { notifyError, notifySuccess } from "@/lib/notify"
import { useAPIClient } from "@/lib/use-api-client"
import {
  calculateFileHash,
  validateFileType,
  validateFileSize,
  FILE_TYPES,
  FILE_SIZE_LIMITS,
} from "@/lib/file-hash"
import { ApiError, TaskOptions } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

export type UploadStage =
  | "idle"
  | "validating"
  | "hashing"
  | "checking"
  | "uploading"
  | "creating"
  | "success"
  | "error"

export interface UploadState {
  stage: UploadStage
  progress: number
  file: File | null
  error: string | null
  taskId: string | null
}

export function useFileUpload() {
  const router = useRouter()
  const client = useAPIClient()
  const { t } = useI18n()

  const [state, setState] = useState<UploadState>({
    stage: "idle",
    progress: 0,
    file: null,
    error: null,
    taskId: null,
  })

  /**
   * 重置上传状态
   */
  const reset = useCallback(() => {
    setState({
      stage: "idle",
      progress: 0,
      file: null,
      error: null,
      taskId: null,
    })
  }, [])

  /**
   * 上传文件
   */
  const uploadFile = useCallback(
    async (file: File, options?: TaskOptions) => {
      try {
        // 1. 验证文件
        setState((prev) => ({ ...prev, stage: "validating", file, error: null }))

        if (!validateFileType(file, [...FILE_TYPES.MEDIA])) {
          throw new Error(t("upload.errors.invalidType"))
        }

        if (!validateFileSize(file, FILE_SIZE_LIMITS.MAX_FILE_SIZE)) {
          throw new Error(t("upload.errors.tooLarge"))
        }

        // 2. 计算文件哈希
        setState((prev) => ({ ...prev, stage: "hashing", progress: 0 }))

        const hash = await calculateFileHash(file, (progress) => {
          setState((prev) => ({ ...prev, progress }))
        })

        // 3. 获取预签名 URL（检查秒传）
        setState((prev) => ({ ...prev, stage: "checking", progress: 0 }))

        const presignResult = await client.getPresignUrl({
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          content_hash: hash,
        })

        // 4. 检查秒传
        if (presignResult.exists) {
          setState({
            stage: "success",
            progress: 100,
            file,
            error: null,
            taskId: presignResult.task_id,
          })
          notifySuccess(t("upload.errors.instantSuccess"))
          // 跳转到任务详情页
          router.push(`/tasks/${presignResult.task_id}`)
          return presignResult.task_id
        }

        // 5. 上传文件到 S3
        setState((prev) => ({ ...prev, stage: "uploading", progress: 0 }))

        await client.uploadFile(presignResult.upload_url, file, (progress) => {
          setState((prev) => ({ ...prev, progress }))
        })

        // 6. 创建任务
        setState((prev) => ({ ...prev, stage: "creating", progress: 90 }))

        const task = await client.createTask({
          title: file.name.replace(/\.[^/.]+$/, ""), // 去除扩展名
          source_type: "upload",
          file_key: presignResult.file_key,
          content_hash: hash,
          options: options || {
            language: "auto",
            enable_speaker_diarization: true,
            summary_style: "general",
          },
        })

        // 7. 完成
        setState({
          stage: "success",
          progress: 100,
          file,
          error: null,
          taskId: task.id,
        })

        notifySuccess(t("upload.uploadSuccessProcessing"))
        // 跳转到任务详情页
        router.push(`/tasks/${task.id}`)

        return task.id
      } catch (error) {
        let errorMessage = t("upload.uploadError")

        if (error instanceof ApiError) {
          errorMessage = error.message
        } else if (error instanceof Error) {
          errorMessage = error.message
        }

        setState({
          stage: "error",
          progress: 0,
          file,
          error: errorMessage,
          taskId: null,
        })

        notifyError(errorMessage)
        throw error
      }
    },
    [client, router, t]
  )

  return {
    state,
    uploadFile,
    reset,
    isUploading:
      state.stage !== "idle" &&
      state.stage !== "success" &&
      state.stage !== "error",
  }
}
