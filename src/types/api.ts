/**
 * API 类型定义
 * 基于后端实际返回结构（以实际后端为准，非文档）
 */

// ============================================================================
// 统一响应格式
// ============================================================================

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  traceId: string
}

// ============================================================================
// 错误码范围
// ============================================================================

export enum ErrorCode {
  SUCCESS = 0,

  // 40000-40099: 参数错误
  INVALID_PARAM = 40000,
  MISSING_PARAM = 40001,
  PARAM_TYPE_ERROR = 40002,
  UNSUPPORTED_FILE_FORMAT = 40010,
  FILE_TOO_LARGE = 40011,
  INVALID_URL = 40012,
  INVALID_YOUTUBE_URL = 40013,

  // 40100-40199: 认证错误
  TOKEN_NOT_PROVIDED = 40100,
  INVALID_TOKEN = 40101,
  TOKEN_EXPIRED = 40102,

  // 40300-40399: 权限错误
  PERMISSION_DENIED = 40300,
  NO_ACCESS = 40301,

  // 40400-40499: 资源不存在
  USER_NOT_FOUND = 40400,
  TASK_NOT_FOUND = 40401,
  TRANSCRIPT_NOT_FOUND = 40402,
  SUMMARY_NOT_FOUND = 40403,

  // 40900-40999: 业务冲突
  TASK_ALREADY_EXISTS = 40900,
  TASK_PROCESSING = 40901,
  TASK_COMPLETED = 40902,
  TASK_RETRY_NOT_ALLOWED = 40903,
  TASK_RETRY_LIMIT = 40904,

  // 50000-50099: 系统异常
  INTERNAL_ERROR = 50000,
  DATABASE_ERROR = 50001,
  CACHE_ERROR = 50002,
  FILE_PROCESSING_ERROR = 50003,

  // 51000-51999: 第三方服务异常
  ASR_UNAVAILABLE = 51000,
  ASR_TIMEOUT = 51001,
  ASR_FAILED = 51002,
  LLM_UNAVAILABLE = 51100,
  LLM_TIMEOUT = 51101,
  LLM_FAILED = 51102,
  STORAGE_ERROR = 51200,
  UPLOAD_FAILED = 51201,
  YOUTUBE_DOWNLOAD_FAILED = 51300,
  YOUTUBE_UNAVAILABLE = 51301,
}

export class ApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public traceId: string,
    public data?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ============================================================================
// 上传相关
// ============================================================================

export interface PresignRequest {
  filename: string
  content_type: string
  size_bytes: number
  content_hash: string
}

export interface PresignResponseExists {
  exists: true
  task_id: string
}

export interface PresignResponseNew {
  exists: false
  upload_url: string
  file_key: string
  expires_in: number
}

export type PresignResponse = PresignResponseExists | PresignResponseNew

// ============================================================================
// ASR 额度
// ============================================================================

export type AsrQuotaStatus = "active" | "inactive" | "expired" | "exhausted"

export interface AsrQuotaItem {
  provider: string
  variant?: string
  window_type: "day" | "month" | "total" | "week" | "year"
  window_start?: string
  window_end?: string
  quota_seconds: number
  used_seconds: number
  status: AsrQuotaStatus
}

export interface AsrQuotaListResponse {
  items: AsrQuotaItem[]
}

export interface AsrQuotaRefreshRequest {
  provider: string
  variant?: string
  window_type: AsrQuotaItem["window_type"]
  quota_seconds?: number
  quota_hours?: number
  reset: boolean
  window_start?: string
  window_end?: string
  used_seconds?: number
}

export interface AsrQuotaRefreshResponse {
  item: AsrQuotaItem
}

// ============================================================================
// 任务相关
// ============================================================================

export type TaskStatus =
  | "pending"
  | "processing"
  | "queued"
  | "resolving"
  | "downloading"
  | "downloaded"
  | "transcoding"
  | "uploading"
  | "uploaded"
  | "resolved"
  | "extracting"
  | "asr_submitting"
  | "asr_polling"
  | "transcribing"
  | "summarizing"
  | "completed"
  | "failed"

export type SourceType = "upload" | "youtube"

export type Language = "auto" | "zh" | "en"

export type SummaryStyle = "meeting" | "learning" | "interview"

export interface TaskOptions {
  language?: Language
  enable_speaker_diarization?: boolean
  summary_style?: SummaryStyle
  provider?: string | null
  model_id?: string | null
}

export interface CreateTaskRequest {
  title?: string
  source_type: SourceType
  file_key?: string // 当 source_type = "upload" 时必填
  source_url?: string // 当 source_type = "youtube" 时必填
  content_hash?: string
  options?: TaskOptions
}

export interface CreateTaskResponse {
  id: string
  status: TaskStatus
  progress: number
  created_at: string
}

export interface TaskListRequest {
  page?: number
  page_size?: number
  status?: "all" | TaskStatus
}

export interface TaskListItem {
  id: string
  title: string
  source_type: SourceType
  status: TaskStatus
  progress: number
  duration_seconds?: number
  created_at: string
  updated_at: string
  error_message?: string
}

export interface TaskListResponse {
  items: TaskListItem[]
  total: number
  page: number
  page_size: number
}

export interface TaskDetail {
  id: string
  title: string
  source_type: SourceType
  source_key?: string
  source_url?: string
  audio_url?: string  // 音频播放 URL（后端生成的可访问 URL）
  file_size_bytes?: number
  status: TaskStatus
  progress: number
  stage?: string
  duration_seconds?: number
  language?: string
  created_at: string
  updated_at: string
  error_message?: string
  error_code?: number
}

export type TaskRetryResponse =
  | {
      task_id: string
      status: string
    }
  | {
      action: "retrying" | "duplicate_found"
      task_id: string
      duplicate_task_id: string | null
      failed_task_ids?: string[]
      message: string
    }

export interface BatchDeleteResponse {
  deleted_count: number
  failed_ids: string[]
}

// ============================================================================
// 转写相关
// ============================================================================

/**
 * 转写片段
 * 根据后端实际返回结构定义
 */
export interface TranscriptSegment {
  id: string
  speaker_id: string | null
  speaker_label: string | null
  content: string
  start_time: number
  end_time: number
  confidence: number | null
  words: TranscriptWord[] | null
  sequence: number
  is_edited: boolean
  original_content: string | null
  created_at: string
  updated_at: string
}

export interface TranscriptWord {
  word: string
  start_time: number
  end_time: number
  confidence: number | null
}

export interface TranscriptRequest {
  page?: number
  page_size?: number
}

/**
 * 转写响应
 * 根据后端实际返回结构定义
 */
export interface TranscriptResponse {
  task_id: string
  total: number
  items: TranscriptSegment[]
}

// ============================================================================
// 摘要相关
// ============================================================================

/**
 * 摘要类型
 */
export type SummaryType = "overview" | "key_points" | "action_items"

/**
 * 摘要项
 * 根据后端实际返回结构定义
 */
export interface SummaryItem {
  id: string
  summary_type: SummaryType
  version: number
  is_active: boolean
  content: string
  model_used: string | null
  prompt_version: string | null
  token_count: number | null
  created_at: string
}

/**
 * 摘要响应
 * 根据后端实际返回结构定义
 */
export interface SummaryResponse {
  task_id: string
  total: number
  items: SummaryItem[]
}

export type SummaryRegenerateType = "overview" | "key_points" | "action_items"

export interface SummaryRegenerateRequest {
  summary_type: SummaryRegenerateType
  provider?: string | null
  model_id?: string | null
}

export interface SummaryRegenerateResponse {
  task_id: string
  summary_type: SummaryRegenerateType
  provider?: string | null
  model_id?: string | null
  status: string
}

// ============================================================================
// LLM 模型相关
// ============================================================================

export interface LLMModel {
  provider: string
  model_id?: string
  display_name: string
  description: string
  cost_per_million_tokens: number
  priority: number
  status: "healthy" | "unhealthy" | "unknown"
  is_recommended: boolean
  is_available: boolean
}

export interface LLMModelsResponse {
  models: LLMModel[]
}

export interface CompareSummariesRequest {
  summary_type: SummaryRegenerateType
  models: Array<{
    provider: string
    model_id?: string | null
  }>
}

export interface CompareSummariesResponse {
  comparison_id: string
  task_id: string
  summary_type: SummaryRegenerateType
  models: Array<{
    provider: string
    model_id?: string | null
  }>
  status: string
}

export interface ComparisonResult {
  model: string
  content: string
  token_count: number | null
  created_at: string
  status: "completed" | "generating" | "failed"
  summary_id?: string | null
}

export interface ComparisonResultsResponse {
  comparison_id: string
  task_id: string
  summary_type: SummaryRegenerateType
  models: Array<{
    provider: string
    model_id?: string | null
  }>
  results: ComparisonResult[]
}

export interface SummaryActivateResponse {
  summary_id: string
  task_id: string
  summary_type: SummaryRegenerateType
  version: number
  model_used: string | null
  is_active: boolean
  comparison_id: string | null
}

// ============================================================================
// 统计（Stats）
// ============================================================================

export type StatsTimeRange = "today" | "week" | "month" | "all"

export interface StatsTimeRangeWindow {
  start: string
  end: string
}

export interface StatsServiceOverviewItem {
  service_type: string
  provider?: string | null
  call_count: number
  success_rate: number
  failure_rate: number
  success_count?: number
  failure_count?: number
  pending_count?: number
  processing_count?: number
  avg_stage_seconds: number
  median_stage_seconds: number
  total_audio_duration_seconds?: number
}

export interface StatsServiceProviderOverviewItem extends StatsServiceOverviewItem {
  provider: string
}

export interface StatsServicesOverviewResponse {
  time_range: StatsTimeRangeWindow
  total_calls?: number
  success_rate?: number
  failure_rate?: number
  usage_by_service_type:
    | StatsServiceOverviewItem[]
    | Record<string, StatsServiceOverviewItem>
  usage_by_provider?:
    | StatsServiceProviderOverviewItem[]
    | Record<string, StatsServiceProviderOverviewItem>
  asr_usage_by_provider?:
    | StatsServiceProviderOverviewItem[]
    | Record<string, StatsServiceProviderOverviewItem>
  llm_usage_by_provider?:
    | StatsServiceProviderOverviewItem[]
    | Record<string, StatsServiceProviderOverviewItem>
}

export interface StatsTasksOverviewResponse {
  time_range: StatsTimeRangeWindow
  total_tasks: number
  status_distribution: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
  success_rate: number
  failure_rate: number
  avg_processing_time_seconds: number
  median_processing_time_seconds: number
  processing_time_by_stage: Record<string, number>
  total_audio_duration_seconds: number
  total_audio_duration_formatted: string
}

// ============================================================================
// WebSocket 消息
// ============================================================================

export type WebSocketMessageType = "progress" | "completed" | "error"

export interface WebSocketProgressData {
  type: "progress"
  status: TaskStatus
  stage: string
  progress: number
}

export interface WebSocketCompletedData {
  type: "completed"
  status: "completed"
  progress: 100
  result: {
    duration_seconds: number
    transcript_count: number
    summary_types: string[]
  }
}

export interface WebSocketErrorData {
  type: "error"
  status: "failed"
}

export type WebSocketData =
  | WebSocketProgressData
  | WebSocketCompletedData
  | WebSocketErrorData

export type WebSocketMessage = ApiResponse<WebSocketData>

// ============================================================================
// 用户相关（API 文档中有定义，但后端可能未实现）
// ============================================================================

/**
 * 用户信息
 * 注意：/users/me 接口可能尚未实现
 */
export interface UserProfile {
  id: string
  email: string
  name: string
  image_url?: string
  locale: string
  timezone: string
  created_at: string
}

// ============================================================================
// 通知相关
// ============================================================================

/**
 * 通知分类
 */
export type NotificationCategory = "task" | "system"

/**
 * 通知操作
 */
export type NotificationAction = "completed" | "failed" | "progress"

/**
 * 通知优先级
 */
export type NotificationPriority = "urgent" | "high" | "normal" | "low"

/**
 * 通知对象
 * 匹配后端 NotificationResponse schema
 */
export interface Notification {
  id: string
  user_id: string
  task_id: string | null

  // Core fields
  category: NotificationCategory
  action: NotificationAction
  title: string
  message: string
  action_url: string | null

  // Status fields
  read_at: string | null
  dismissed_at: string | null

  // Extension fields
  extra_data: Record<string, unknown>
  priority: NotificationPriority
  expires_at: string | null

  // Timestamps
  created_at: string
  updated_at: string
}

/**
 * 通知列表请求参数
 */
export interface NotificationListRequest {
  page?: number
  page_size?: number
  unread_only?: boolean
  category?: NotificationCategory
}

/**
 * 通知列表响应（分页）
 */
export interface NotificationListResponse {
  items: Notification[]
  total: number
  page: number
  page_size: number
}

/**
 * 通知统计信息
 */
export interface NotificationStatsResponse {
  total: number
  unread: number
  dismissed: number
}
