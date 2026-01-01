/**
 * API 客户端
 *
 * 功能：
 * - 统一的请求/响应处理
 * - 自动添加认证头和语言头
 * - 错误处理和重试
 * - 类型安全的 API 调用
 */

import { getToken } from "@/lib/auth-token"
import { translateStatic } from "@/lib/i18n-static"
import {
  ApiError,
  ApiResponse,
  BatchDeleteResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  NotificationListRequest,
  NotificationListResponse,
  NotificationStatsResponse,
  PresignRequest,
  PresignResponse,
  SummaryRegenerateRequest,
  SummaryRegenerateResponse,
  SummaryResponse,
  TaskDetail,
  TaskListRequest,
  TaskListResponse,
  RetryMode,
  TaskRetryResponse,
  TranscriptRequest,
  TranscriptResponse,
  UserProfile,
} from "@/types/api"

// ============================================================================
// 配置
// ============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1"

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取当前语言
 */
function getLocale(): string {
  if (typeof window !== "undefined") {
    const locale = localStorage.getItem("locale")
    if (locale) {
      return locale.toLowerCase().startsWith("zh") ? "zh" : "en"
    }
    const language = localStorage.getItem("language")
    if (language === "zh" || language === "en") {
      return language
    }
    return "zh"
  }
  // 服务端：默认中文
  return "zh"
}

/**
 * 获取认证 token
 * 优先使用传入的 token，否则自动生成/获取存储的 token
 */
async function getAuthToken(token?: string): Promise<string | null> {
  if (token) {
    return token
  }

  // 客户端：自动获取或生成 JWT token
  if (typeof window !== "undefined") {
    return await getToken()
  }

  // 服务端：返回 null（SSR 场景暂不支持）
  return null
}

/**
 * 发送 HTTP 请求
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const authToken = await getAuthToken(token)
  const locale = getLocale()

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    "Accept-Language": locale,
    ...(options.headers as Record<string, string>),
  }

  // 添加认证头
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    // 解析响应
    const result: ApiResponse<T> = await response.json()

    // 检查业务状态码
    if (result.code !== 0) {
      throw new ApiError(result.code, result.message, result.traceId, result.data)
    }

    return result.data
  } catch (error) {
    // 如果已经是 ApiError，直接抛出
    if (error instanceof ApiError) {
      throw error
    }

    // 网络错误或其他错误
    if (error instanceof Error) {
      const isNetworkError =
        error instanceof TypeError ||
        /failed to fetch|networkerror|load failed/i.test(error.message)
      const message = isNetworkError
        ? translateStatic("errors.networkFailedDesc", locale)
        : error.message || translateStatic("errors.networkFailedDesc", locale)
      throw new ApiError(
        50000,
        message,
        "client_error",
        error
      )
    }

    throw new ApiError(
      50000,
      translateStatic("errors.unknownError", locale),
      "client_error"
    )
  }
}

// ============================================================================
// API 客户端类
// ============================================================================

export class APIClient {
  private token?: string

  constructor(token?: string) {
    this.token = token
  }

  /**
   * 设置认证 token（用于客户端组件）
   */
  setToken(token: string) {
    this.token = token
  }

  // ==========================================================================
  // 健康检查
  // ==========================================================================

  async healthCheck(): Promise<{ status: string }> {
    return request("/health", { method: "GET" })
  }

  // ==========================================================================
  // 上传相关
  // ==========================================================================

  /**
   * 获取上传预签名 URL
   */
  async getPresignUrl(data: PresignRequest): Promise<PresignResponse> {
    return request(
      "/upload/presign",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      this.token
    )
  }

  /**
   * 上传文件到 S3/MinIO
   * @param url 预签名 URL
   * @param file 文件对象
   * @param onProgress 进度回调
   */
  async uploadFile(
    url: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // 监听进度
      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            onProgress(progress)
          }
        })
      }

      // 监听完成
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(
            new ApiError(
              51201,
              `${translateStatic("upload.uploadError", getLocale())}: ${xhr.statusText}`,
              "upload_error"
            )
          )
        }
      })

      // 监听错误
      xhr.addEventListener("error", () => {
        reject(
          new ApiError(
            51201,
            translateStatic("upload.uploadError", getLocale()),
            "upload_error"
          )
        )
      })

      // 发送请求
      xhr.open("PUT", url)
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.send(file)
    })
  }

  // ==========================================================================
  // 任务相关
  // ==========================================================================

  /**
   * 创建任务
   */
  async createTask(data: CreateTaskRequest): Promise<CreateTaskResponse> {
    return request(
      "/tasks",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      this.token
    )
  }

  /**
   * 获取任务列表
   */
  async getTasks(params?: TaskListRequest): Promise<TaskListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size)
      queryParams.set("page_size", params.page_size.toString())
    if (params?.status && params.status !== "all")
      queryParams.set("status", params.status)

    const query = queryParams.toString()
    const endpoint = query ? `/tasks?${query}` : "/tasks"

    return request(endpoint, { method: "GET" }, this.token)
  }

  /**
   * 获取任务详情
   */
  async getTask(taskId: string): Promise<TaskDetail> {
    return request(`/tasks/${taskId}`, { method: "GET" }, this.token)
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    return request(`/tasks/${taskId}`, { method: "DELETE" }, this.token)
  }

  /**
   * 重试失败任务
   */
  async retryTask(
    taskId: string,
    options?: boolean | { mode?: RetryMode }
  ): Promise<TaskRetryResponse> {
    const queryParams = new URLSearchParams()
    let body = "{}"
    if (typeof options === "boolean") {
      if (options) {
        queryParams.set("force", "true")
      }
    } else if (options?.mode) {
      body = JSON.stringify({ mode: options.mode })
    }
    const query = queryParams.toString()
    const endpoint = query
      ? `/tasks/${taskId}/retry?${query}`
      : `/tasks/${taskId}/retry`

    return request(endpoint, { method: "POST", body }, this.token)
  }

  /**
   * 批量删除任务
   */
  async batchDeleteTasks(taskIds: string[]): Promise<BatchDeleteResponse> {
    return request(
      "/tasks/batch-delete",
      {
        method: "POST",
        body: JSON.stringify({ task_ids: taskIds }),
      },
      this.token
    )
  }

  // ==========================================================================
  // 转写相关
  // ==========================================================================

  /**
   * 获取转写结果
   */
  async getTranscript(
    taskId: string,
    params?: TranscriptRequest
  ): Promise<TranscriptResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size)
      queryParams.set("page_size", params.page_size.toString())

    const query = queryParams.toString()
    const endpoint = query
      ? `/transcripts/${taskId}?${query}`
      : `/transcripts/${taskId}`

    return request(endpoint, { method: "GET" }, this.token)
  }

  // ==========================================================================
  // 摘要相关
  // ==========================================================================

  /**
   * 获取摘要结果
   */
  async getSummary(taskId: string): Promise<SummaryResponse> {
    return request(`/summaries/${taskId}`, { method: "GET" }, this.token)
  }

  /**
   * 重新生成摘要（支持指定 summary_type）
   */
  async regenerateSummary(
    taskId: string,
    data: SummaryRegenerateRequest
  ): Promise<SummaryRegenerateResponse> {
    return request(
      `/summaries/${taskId}/regenerate`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      this.token
    )
  }

  // ==========================================================================
  // 用户相关
  // ==========================================================================

  /**
   * 获取当前用户信息
   * 注意：此接口可能尚未在后端实现，使用前请确认
   */
  async getCurrentUser(): Promise<UserProfile> {
    return request("/users/me", { method: "GET" }, this.token)
  }

  // ==========================================================================
  // 通知相关
  // ==========================================================================

  /**
   * 获取通知列表
   */
  async getNotifications(
    params?: NotificationListRequest
  ): Promise<NotificationListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size)
      queryParams.set("page_size", params.page_size.toString())
    if (params?.unread_only)
      queryParams.set("unread_only", params.unread_only.toString())
    if (params?.category) queryParams.set("category", params.category)

    const query = queryParams.toString()
    const endpoint = query ? `/notifications?${query}` : "/notifications"

    return request(endpoint, { method: "GET" }, this.token)
  }

  /**
   * 获取通知统计信息
   */
  async getNotificationStats(): Promise<NotificationStatsResponse> {
    return request("/notifications/stats", { method: "GET" }, this.token)
  }

  /**
   * 标记单条通知为已读
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    return request(
      `/notifications/${notificationId}/read`,
      { method: "PATCH" },
      this.token
    )
  }

  /**
   * 标记所有通知为已读
   */
  async markAllNotificationsRead(): Promise<void> {
    return request("/notifications/read-all", { method: "PATCH" }, this.token)
  }

  /**
   * 删除（dismiss）单条通知
   */
  async deleteNotification(notificationId: string): Promise<void> {
    return request(
      `/notifications/${notificationId}`,
      { method: "DELETE" },
      this.token
    )
  }

  /**
   * 清空所有通知
   */
  async clearAllNotifications(): Promise<void> {
    return request("/notifications/clear", { method: "DELETE" }, this.token)
  }
}

// ============================================================================
// 默认实例
// ============================================================================

/**
 * 默认 API 客户端实例
 * 用于服务端组件或不需要动态 token 的场景
 */
export const apiClient = new APIClient()

/**
 * 创建带 token 的 API 客户端
 * 用于客户端组件
 */
export function createAPIClient(token?: string): APIClient {
  return new APIClient(token)
}
