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
  AsrUserFreeQuotaResponse,
  AsrAdminOverviewResponse,
  BatchDeleteResponse,
  CompareSummariesRequest,
  CompareSummariesResponse,
  ComparisonResultsResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  LLMModelsResponse,
  NotificationListRequest,
  NotificationListResponse,
  NotificationStatsResponse,
  PresignRequest,
  PresignResponse,
  SummaryRegenerateRequest,
  SummaryRegenerateResponse,
  SummaryActivateResponse,
  SummaryResponse,
  SummaryStylesResponse,
  StatsServicesOverviewResponse,
  StatsTasksOverviewResponse,
  TaskDetail,
  TaskListRequest,
  TaskListResponse,
  TaskRetryResponse,
  TranscriptRequest,
  TranscriptResponse,
  UserProfile,
  UserPreferences,
  UserPreferencesUpdateRequest,
  VisualSummaryRequest,
  VisualSummaryResponse,
  VisualType,
  YouTubeAuthResponse,
  YouTubeChannelSyncStatus,
  YouTubeBatchAutoTranscribeRequest,
  YouTubeBatchStarRequest,
  YouTubeChannelVideosRequest,
  YouTubeChannelVideosSyncRequest,
  YouTubeConnectionStatus,
  YouTubeDisconnectResponse,
  YouTubeLatestVideosRequest,
  YouTubeSubscriptionListRequest,
  YouTubeSubscriptionListResponse,
  YouTubeSubscriptionSettings,
  YouTubeSubscriptionSettingsUpdateRequest,
  YouTubeSyncOverview,
  YouTubeSyncResponse,
  YouTubeTaskStatusResponse,
  YouTubeTranscribeRequest,
  YouTubeTranscribeResponse,
  YouTubeVideoListResponse,
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

function buildStatsQuery(params?: {
  time_range?: string
  start_date?: string
  end_date?: string
  granularity?: string
}): string {
  const queryParams = new URLSearchParams()
  if (params?.time_range) queryParams.set("time_range", params.time_range)
  if (params?.start_date) queryParams.set("start_date", params.start_date)
  if (params?.end_date) queryParams.set("end_date", params.end_date)
  if (params?.granularity) queryParams.set("granularity", params.granularity)
  return queryParams.toString()
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
  // ASR 使用量
  // ==========================================================================

  async getAsrFreeQuota(): Promise<AsrUserFreeQuotaResponse> {
    return request("/asr/quotas", { method: "GET" }, this.token)
  }

  // ==========================================================================
  // ASR 配额（管理员）
  // ==========================================================================

  async getAsrAdminOverview(): Promise<AsrAdminOverviewResponse> {
    return request("/asr/quotas/admin/overview", { method: "GET" }, this.token)
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
    options?: boolean | { force?: boolean }
  ): Promise<TaskRetryResponse> {
    const queryParams = new URLSearchParams()
    if (typeof options === "boolean") {
      if (options) {
        queryParams.set("force", "true")
      }
    } else if (options?.force) {
      queryParams.set("force", "true")
    }
    const query = queryParams.toString()
    const endpoint = query
      ? `/tasks/${taskId}/retry?${query}`
      : `/tasks/${taskId}/retry`

    return request(endpoint, { method: "POST" }, this.token)
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

  /**
   * 多模型对比生成摘要
   */
  async compareSummaries(
    taskId: string,
    data: CompareSummariesRequest
  ): Promise<CompareSummariesResponse> {
    return request(
      `/summaries/${taskId}/compare`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      this.token
    )
  }

  /**
   * 获取对比结果
   */
  async getSummaryComparison(
    taskId: string,
    comparisonId: string
  ): Promise<ComparisonResultsResponse> {
    return request(
      `/summaries/${taskId}/compare/${comparisonId}`,
      { method: "GET" },
      this.token
    )
  }

  /**
   * 将摘要设置为当前版本
   */
  async activateSummary(
    taskId: string,
    summaryId: string
  ): Promise<SummaryActivateResponse> {
    return request(
      `/summaries/${taskId}/${summaryId}/activate`,
      { method: "POST" },
      this.token
    )
  }

  /**
   * 获取可用 LLM 模型列表
   */
  async getLLMModels(): Promise<LLMModelsResponse> {
    return request("/llm/models", { method: "GET" }, this.token)
  }

  /**
   * 获取摘要风格列表
   * 后端返回已国际化的风格名称和描述
   */
  async getSummaryStyles(): Promise<SummaryStylesResponse> {
    return request("/summary-styles", { method: "GET" }, this.token)
  }

  // ==========================================================================
  // 统计（Stats）
  // ==========================================================================

  async getServiceStatsOverview(params?: {
    time_range?: string
    start_date?: string
    end_date?: string
  }): Promise<StatsServicesOverviewResponse> {
    const query = buildStatsQuery(params)
    const endpoint = query
      ? `/stats/services/overview?${query}`
      : "/stats/services/overview"
    return request(endpoint, { method: "GET" }, this.token)
  }

  async getTaskStatsOverview(params?: {
    time_range?: string
    start_date?: string
    end_date?: string
  }): Promise<StatsTasksOverviewResponse> {
    const query = buildStatsQuery(params)
    const endpoint = query ? `/stats/tasks/overview?${query}` : "/stats/tasks/overview"
    return request(endpoint, { method: "GET" }, this.token)
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

  async getUserPreferences(): Promise<UserPreferences> {
    return request("/users/me/preferences", { method: "GET" }, this.token)
  }

  async updateUserPreferences(
    payload: UserPreferencesUpdateRequest
  ): Promise<UserPreferences> {
    return request(
      "/users/me/preferences",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      this.token
    )
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

  // ==========================================================================
  // 可视化摘要相关 (v1.3)
  // ==========================================================================

  /**
   * 生成可视化摘要（异步任务）
   */
  async generateVisualSummary(
    taskId: string,
    data: VisualSummaryRequest
  ): Promise<ApiResponse<{ task_id: string; status: string }>> {
    return request(
      `/summaries/${taskId}/visual`,
      { method: "POST", body: JSON.stringify(data) },
      this.token
    )
  }

  /**
   * 获取已生成的可视化摘要
   */
  async getVisualSummary(
    taskId: string,
    visualType: VisualType
  ): Promise<ApiResponse<VisualSummaryResponse>> {
    return request(
      `/summaries/${taskId}/visual/${visualType}`,
      { method: "GET" },
      this.token
    )
  }

  /**
   * 获取图片 URL（如果后端生成了图片）
   * @param imageKey - Summary 对象中的 image_key 字段
   */
  getVisualImageUrl(imageKey: string): string {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    return `${baseUrl}/api/v1/media/${imageKey}`
  }

  /**
   * 轮询可视化摘要生成状态
   * 由于后端没有 SSE 端点，使用轮询方式检查生成是否完成
   * @param taskId 任务 ID
   * @param visualType 可视化类型
   * @param options 轮询配置
   * @returns Promise<VisualSummaryResponse> 成功获取到可视化摘要
   * @throws ApiError 超时或获取失败
   */
  async pollVisualSummary(
    taskId: string,
    visualType: VisualType,
    options: {
      maxAttempts?: number // 最大尝试次数，默认 30
      interval?: number // 轮询间隔（毫秒），默认 2000ms
      onProgress?: (attempt: number, maxAttempts: number) => void // 进度回调
    } = {}
  ): Promise<VisualSummaryResponse> {
    const { maxAttempts = 30, interval = 2000, onProgress } = options

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        onProgress?.(attempt, maxAttempts)

        const result = await this.getVisualSummary(taskId, visualType)

        if (result.code === 0 && result.data) {
          return result.data
        }

        // 如果是 404（未找到），继续轮询
        if (result.code === 40402) {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, interval))
            continue
          }
        }

        // 其他错误直接抛出
        throw new ApiError(result.code, result.message, result.traceId)
      } catch (error) {
        // 最后一次尝试，抛出错误
        if (attempt >= maxAttempts) {
          if (error instanceof ApiError) {
            throw error
          }
          throw new ApiError(
            50001,
            "可视化摘要生成超时，请稍后手动刷新查看",
            ""
          )
        }

        // 如果是 404（未生成完成），继续轮询
        if (
          error instanceof ApiError &&
          (error.code === 40402 || error.code === 40401)
        ) {
          await new Promise((resolve) => setTimeout(resolve, interval))
          continue
        }

        // 其他错误直接抛出
        throw error
      }
    }

    throw new ApiError(
      50001,
      "可视化摘要生成超时，请稍后手动刷新查看",
      ""
    )
  }

  // ==========================================================================
  // YouTube 订阅同步
  // ==========================================================================

  /**
   * 获取 YouTube OAuth 授权 URL
   */
  async getYouTubeAuthUrl(): Promise<YouTubeAuthResponse> {
    return request("/youtube/auth", { method: "GET" }, this.token)
  }

  /**
   * 获取 YouTube 连接状态
   */
  async getYouTubeStatus(): Promise<YouTubeConnectionStatus> {
    return request("/youtube/status", { method: "GET" }, this.token)
  }

  /**
   * 断开 YouTube 账号连接
   */
  async disconnectYouTube(): Promise<YouTubeDisconnectResponse> {
    return request("/youtube/disconnect", { method: "DELETE" }, this.token)
  }

  /**
   * 获取 YouTube 订阅列表
   */
  async getYouTubeSubscriptions(
    params?: YouTubeSubscriptionListRequest
  ): Promise<YouTubeSubscriptionListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size)
      queryParams.set("page_size", params.page_size.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/youtube/subscriptions?${query}` : "/youtube/subscriptions"

    return request(endpoint, { method: "GET" }, this.token)
  }

  /**
   * 触发 YouTube 订阅同步
   */
  async syncYouTubeSubscriptions(): Promise<YouTubeSyncResponse> {
    return request("/youtube/subscriptions/sync", { method: "POST" }, this.token)
  }

  /**
   * 获取所有订阅频道的最新视频（聚合信息流）
   */
  async getYouTubeLatestVideos(
    params?: YouTubeLatestVideosRequest
  ): Promise<YouTubeVideoListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size)
      queryParams.set("page_size", params.page_size.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/youtube/videos/latest?${query}` : "/youtube/videos/latest"

    return request(endpoint, { method: "GET" }, this.token)
  }

  /**
   * 获取指定频道的视频列表
   */
  async getYouTubeChannelVideos(
    channelId: string,
    params?: YouTubeChannelVideosRequest
  ): Promise<YouTubeVideoListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size)
      queryParams.set("page_size", params.page_size.toString())

    const query = queryParams.toString()
    const endpoint = query
      ? `/youtube/channels/${channelId}/videos?${query}`
      : `/youtube/channels/${channelId}/videos`

    return request(endpoint, { method: "GET" }, this.token)
  }

  /**
   * 获取频道同步状态
   */
  async getYouTubeChannelSyncStatus(
    channelId: string
  ): Promise<YouTubeChannelSyncStatus> {
    return request(
      `/youtube/channels/${channelId}/sync-status`,
      { method: "GET" },
      this.token
    )
  }

  /**
   * 触发频道视频同步
   */
  async syncYouTubeChannelVideos(
    channelId: string,
    params?: YouTubeChannelVideosSyncRequest
  ): Promise<YouTubeSyncResponse> {
    const queryParams = new URLSearchParams()
    if (params?.max_videos)
      queryParams.set("max_videos", params.max_videos.toString())

    const query = queryParams.toString()
    const endpoint = query
      ? `/youtube/channels/${channelId}/videos/sync?${query}`
      : `/youtube/channels/${channelId}/videos/sync`

    return request(endpoint, { method: "POST" }, this.token)
  }

  /**
   * 一键转写 YouTube 视频
   */
  async transcribeYouTubeVideo(
    videoId: string,
    params?: YouTubeTranscribeRequest
  ): Promise<YouTubeTranscribeResponse> {
    return request(
      `/youtube/videos/${videoId}/transcribe`,
      {
        method: "POST",
        body: JSON.stringify(params || {}),
      },
      this.token
    )
  }

  /**
   * 获取 YouTube 异步任务状态
   */
  async getYouTubeTaskStatus(taskId: string): Promise<YouTubeTaskStatusResponse> {
    return request(
      `/youtube/tasks/${taskId}/status`,
      { method: "GET" },
      this.token
    )
  }

  /**
   * 获取 YouTube 同步进度概览
   */
  async getYouTubeSyncOverview(): Promise<YouTubeSyncOverview> {
    return request(
      `/youtube/sync-overview`,
      { method: "GET" },
      this.token
    )
  }

  /**
   * 获取 YouTube 频道订阅设置
   */
  async getYouTubeSubscriptionSettings(channelId: string): Promise<YouTubeSubscriptionSettings> {
    return request(
      `/youtube/subscriptions/${channelId}/settings`,
      { method: "GET" },
      this.token
    )
  }

  /**
   * 更新 YouTube 频道订阅设置
   */
  async updateYouTubeSubscriptionSettings(
    channelId: string,
    settings: YouTubeSubscriptionSettingsUpdateRequest
  ): Promise<YouTubeSubscriptionSettings> {
    return request(
      `/youtube/subscriptions/${channelId}/settings`,
      {
        method: "PATCH",
        body: JSON.stringify(settings),
      },
      this.token
    )
  }

  /**
   * 批量设置 YouTube 订阅特别关注
   */
  async batchStarYouTubeSubscriptions(params: YouTubeBatchStarRequest): Promise<void> {
    return request(
      `/youtube/subscriptions/batch/star`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
      this.token
    )
  }

  /**
   * 批量设置 YouTube 订阅自动转写
   */
  async batchAutoTranscribeYouTubeSubscriptions(params: YouTubeBatchAutoTranscribeRequest): Promise<void> {
    return request(
      `/youtube/subscriptions/batch/auto-transcribe`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
      this.token
    )
  }

  /**
   * 获取特别关注频道的视频
   */
  async getYouTubeStarredVideos(params?: YouTubeLatestVideosRequest): Promise<YouTubeVideoListResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set("page", params.page.toString())
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString())
    const query = searchParams.toString()
    return request(
      `/youtube/videos/starred${query ? `?${query}` : ""}`,
      { method: "GET" },
      this.token
    )
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
