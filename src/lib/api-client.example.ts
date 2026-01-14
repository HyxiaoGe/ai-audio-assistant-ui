/**
 * API 客户端使用示例
 *
 * 本文件展示如何在不同场景下使用 API 客户端
 */

import { apiClient, createAPIClient } from "./api-client"
import { calculateFileHash, validateFileType, validateFileSize, FILE_TYPES, FILE_SIZE_LIMITS } from "./file-hash"
import { ApiError } from "@/types/api"

// ============================================================================
// 示例 1: 完整的文件上传流程
// ============================================================================

/**
 * 上传文件并创建任务
 */
export async function uploadFileAndCreateTask(
  file: File,
  token: string,
  onHashProgress?: (progress: number) => void,
  onUploadProgress?: (progress: number) => void
): Promise<string> {
  try {
    // 1. 验证文件
    if (!validateFileType(file, [...FILE_TYPES.MEDIA])) {
      throw new Error("不支持的文件格式")
    }

    if (!validateFileSize(file, FILE_SIZE_LIMITS.MAX_FILE_SIZE)) {
      throw new Error("文件大小超过限制（最大 500MB）")
    }

    // 2. 计算文件哈希
    const contentHash = await calculateFileHash(file, onHashProgress)

    // 3. 获取预签名 URL
    const client = createAPIClient(token)
    const presignResult = await client.getPresignUrl({
      filename: file.name,
      content_type: file.type,
      size_bytes: file.size,
      content_hash: contentHash,
    })

    // 4. 检查是否秒传
    if (presignResult.exists) {
      return presignResult.task_id
    }

    // 5. 上传文件到 S3/MinIO
    await client.uploadFile(
      presignResult.upload_url,
      file,
      onUploadProgress
    )

    // 6. 创建任务
    const task = await client.createTask({
      title: file.name.replace(/\.[^/.]+$/, ""), // 去除扩展名
      source_type: "upload",
      file_key: presignResult.file_key,
      content_hash: contentHash,
      options: {
        language: "auto",
        enable_speaker_diarization: true,
        summary_style: "meeting",
      },
    })

    return task.id
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw error
  }
}

// ============================================================================
// 示例 2: 使用 YouTube URL 创建任务
// ============================================================================

export async function createYouTubeTask(
  youtubeUrl: string,
  token: string
): Promise<string> {
  const client = createAPIClient(token)

  try {
    const task = await client.createTask({
      source_type: "youtube",
      source_url: youtubeUrl,
      options: {
        language: "auto",
        enable_speaker_diarization: false,
        summary_style: "learning",
      },
    })

    return task.id
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 40013) {
        throw new Error("无效的 YouTube 链接格式")
      }
      throw new Error(error.message)
    }
    throw error
  }
}

// ============================================================================
// 示例 3: 获取任务列表（服务端）
// ============================================================================

/**
 * 在服务端组件中获取任务列表
 */
export async function fetchTasksOnServer() {
  try {
    const tasks = await apiClient.getTasks({
      page: 1,
      page_size: 20,
      status: "all",
    })

    return tasks
  } catch (error) {
    if (error instanceof ApiError) {
      return null
    }
    throw error
  }
}

// ============================================================================
// 示例 4: 获取任务详情和相关数据
// ============================================================================

export async function fetchTaskDetails(taskId: string, token: string) {
  const client = createAPIClient(token)

  try {
    // 并行获取任务详情、转写和摘要
    const [task, transcript, summary] = await Promise.all([
      client.getTask(taskId),
      client.getTranscript(taskId, { page: 1, page_size: 50 }),
      client.getSummary(taskId).catch(() => null), // 摘要可能不存在
    ])

    return { task, transcript, summary }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 40401) {
        throw new Error("任务不存在")
      }
      if (error.code === 40102) {
        // Token 过期，需要重新登录
        throw new Error("登录已过期，请重新登录")
      }
      throw new Error(error.message)
    }
    throw error
  }
}

// ============================================================================
// 示例 5: 错误处理最佳实践
// ============================================================================

export async function handleAPIErrors() {
  const client = createAPIClient("your-token")

  try {
    const tasks = await client.getTasks()
    return tasks
  } catch (error) {
    if (error instanceof ApiError) {
      // 根据错误码范围处理
      if (error.code >= 40100 && error.code < 40200) {
        // 认证错误：跳转登录
        window.location.href = "/login"
      } else if (error.code >= 40000 && error.code < 40100) {
        // 参数错误：显示给用户
        alert(`参数错误: ${error.message}`)
      } else if (error.code >= 50000) {
        // 系统错误：显示通用提示
        alert("系统繁忙，请稍后重试")
      } else {
        // 其他错误
        alert(error.message)
      }
    } else {
      // 非 API 错误
      alert("发生未知错误")
    }
  }
}

// ============================================================================
// 示例 6: 在 React 组件中使用（客户端组件）
// ============================================================================

/*
'use client'

import { useAPIClient } from '@/lib/use-api-client'
import { useState } from 'react'
import { ApiError } from '@/types/api'
import { toast } from 'sonner'

export function TaskList() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const client = useAPIClient()

  const loadTasks = async () => {
    setLoading(true)
    try {
      const result = await client.getTasks({ page: 1, page_size: 20 })
      setTasks(result.items)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // ...
}
*/

// ============================================================================
// 示例 7: 在服务端组件中使用
// ============================================================================

/*
// app/tasks/page.tsx
import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/types/api'

export default async function TasksPage() {
  try {
    const tasks = await apiClient.getTasks({ page: 1, page_size: 20 })

    return (
      <div>
        {tasks.items.map(task => (
          <div key={task.id}>{task.title}</div>
        ))}
      </div>
    )
  } catch (error) {
    if (error instanceof ApiError) {
      return <div>加载失败: {error.message}</div>
    }
    return <div>发生错误</div>
  }
}
*/
