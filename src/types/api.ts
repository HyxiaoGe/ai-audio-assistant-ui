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

  // 51900-51904: YouTube OAuth 错误
  YOUTUBE_NOT_CONNECTED = 51900,
  YOUTUBE_OAUTH_FAILED = 51901,
  YOUTUBE_TOKEN_EXPIRED = 51902,
  YOUTUBE_API_ERROR = 51903,
  YOUTUBE_OAUTH_STATE_INVALID = 51904,
}

export class ApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public traceId: string,
    public data?: unknown,
    // 真实 HTTP 状态码：仅当响应不是统一信封（网关 5xx/HTML/空体）时由 api-client 填入，
    // 便于把传输层故障与业务错误区分开并定位线上问题。
    public httpStatus?: number
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
// ASR 使用量
// ============================================================================

// 用户免费额度信息
export interface AsrUserFreeQuotaResponse {
  free_quota_seconds: number    // 总免费额度（秒），-1 表示无限制
  free_quota_hours: number      // 总免费额度（小时），-1 表示无限制
  used_seconds: number          // 已消耗（秒）
  used_hours: number            // 已消耗（小时）
  remaining_seconds: number     // 剩余免费额度（秒），-1 表示无限制
  remaining_hours: number       // 剩余免费额度（小时），-1 表示无限制
  is_unlimited: boolean         // 是否不受配额限制（管理员）
}

// ============================================================================
// ASR 配额（管理员）
// ============================================================================

export type AsrQuotaStatus = "active" | "exhausted"

export interface AsrQuotaItem {
  provider: string
  variant: string
  window_type: "day" | "month" | "total"
  window_start: string
  window_end: string
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
  reset?: boolean
  window_start?: string
  window_end?: string
  used_seconds?: number
}

export interface AsrQuotaRefreshResponse {
  item: AsrQuotaItem
}

// 管理员 ASR 概览

// 免费额度状态（只关心免费额度本身）
export interface AsrFreeQuotaStatus {
  provider: string              // 提供商 ID
  variant: string               // 变体 (file, file_fast)
  display_name: string          // 显示名称
  free_quota_hours: number      // 免费额度（小时）
  used_hours: number            // 已使用（小时）
  remaining_hours: number       // 剩余（小时）
  usage_percent: number         // 使用百分比 0-100
  reset_period: string          // 刷新周期 (monthly, yearly)
  period_start: string          // 当前周期开始时间
  period_end: string            // 当前周期结束时间
}

// 提供商付费使用统计（所有提供商）
export interface AsrProviderUsage {
  provider: string              // 提供商 ID
  variant: string               // 变体 (file, file_fast)
  display_name: string          // 显示名称
  cost_per_hour: number         // 单价（元/小时）
  paid_hours: number            // 付费时长（小时）
  paid_cost: number             // 付费金额（元）
  is_enabled: boolean           // 是否启用
}

export interface AsrUsageSummary {
  total_used_hours: number      // 总使用量（小时）
  total_free_hours: number      // 免费额度消耗（小时）
  total_paid_hours: number      // 付费时长（小时）
  total_cost: number            // 总成本（元）
}

export interface AsrAdminOverviewResponse {
  summary: AsrUsageSummary
  free_quota_status: AsrFreeQuotaStatus[]    // 免费额度状态
  providers_usage: AsrProviderUsage[]        // 所有提供商付费使用统计
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
  | "polishing"
  | "summarizing"
  | "completed"
  | "failed"

export type SourceType = "upload" | "youtube"

export type Language = "auto" | "zh" | "en"

// SummaryStyle is now dynamic - use string for flexibility
export type SummaryStyle = string

// ============================================================================
// 摘要风格（动态获取）
// ============================================================================

/**
 * 摘要风格项
 * 从后端动态获取，支持国际化
 */
export interface SummaryStyleItem {
  id: string                        // 风格标识符
  name: string                      // 显示名称（已国际化）
  description: string               // 风格描述（已国际化）
  focus: string                     // 摘要侧重点（已国际化）
  icon?: string                     // 图标标识符
  recommended_visual_types: string[] // 推荐的可视化类型
}

/**
 * 摘要风格列表响应
 */
export interface SummaryStylesResponse {
  version: string
  styles: SummaryStyleItem[]
}

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
  is_public?: boolean
}

export interface TaskListResponse {
  items: TaskListItem[]
  total: number
  page: number
  page_size: number
}

/**
 * 任务状态计数（列表页筛选 tab 角标）
 * 一次请求返回全部，替代为四个 tab 各发一次 page_size=1 查询。
 */
export interface TaskStatusCounts {
  all: number
  processing: number
  completed: number
  failed: number
}

/**
 * YouTube 视频信息
 * 当任务来源是 YouTube 时返回
 */
export interface YouTubeVideoInfo {
  video_id: string            // YouTube 视频 ID
  channel_id: string          // 频道 ID
  channel_title?: string      // 频道名称
  channel_thumbnail?: string  // 频道头像 URL
  title: string               // 视频标题
  description?: string        // 视频描述
  thumbnail_url?: string      // 视频缩略图 URL
  published_at?: string       // 发布时间 (ISO 8601)
  duration_seconds?: number   // 视频时长（秒）
  view_count?: number         // 播放量
  like_count?: number         // 点赞数
  comment_count?: number      // 评论数
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
  youtube_info?: YouTubeVideoInfo  // YouTube 视频元数据（仅 YouTube 来源任务）
  detected_summary_style?: string | null  // 后台自动识别得到的摘要风格 key（用户显式选风格时为 null）
  // 公开可见性(探索广场;后端 feature/public-explore 起返回)
  is_public?: boolean
  published_at?: string | null
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
export type SummaryType =
  | "overview"
  | "key_points"
  | "action_items"

/**
 * 摘要项（v1.3 新增可视化字段）
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

  // v1.3 新增可视化字段
  visual_format?: "mermaid" | "json" | null
  image_url?: string | null  // 修复：后端返回的是 image_url 不是 image_key
  image_format?: "png" | "svg" | null
  image_model_used?: string | null

  // 渐进式展示：overview 配图持久化图集（非 overview/无图时为 null 或 []）。
  images?: SummaryImage[] | null
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

// 短期作用域票据（media / stream）：拼到媒体代理或 SSE 的 ?token=，替代长效 access JWT。
export interface MediaTicketResponse {
  token: string
  expires_in: number
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
  // LiteLLM 目录新增的元数据（后端 /api/v1/llm/models 返回）
  cost_tier?: "low" | "mid" | "high"
  recommended_for?: string[]
  provider_display?: string
  // unhealthy 时后端给的中文友好原因（"服务商认证失败..." 等），FE 直接展示在 tooltip
  health_error?: string | null
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
 */
export interface UserProfile {
  id: string
  email: string
  name: string | null
  avatar_url?: string | null
  image_url?: string | null
  locale?: string
  timezone?: string
  is_admin?: boolean
  created_at?: string
}

export interface UserPreferencesTaskDefaults {
  language?: Language
  summary_style?: SummaryStyle
  enable_speaker_diarization?: boolean
  asr_provider?: string | null
  asr_variant?: string | null
  llm_provider?: string | null
  llm_model_id?: string | null
}

export interface UserPreferencesUI {
  locale?: string
  timezone?: string
}

export interface UserPreferencesNotifications {
  task_completed?: boolean
  task_failed?: boolean
}

export interface UserPreferences {
  task_defaults: UserPreferencesTaskDefaults
  ui: UserPreferencesUI
  notifications: UserPreferencesNotifications
}

export interface UserPreferencesUpdateRequest {
  task_defaults?: Partial<UserPreferencesTaskDefaults>
  ui?: Partial<UserPreferencesUI>
  notifications?: Partial<UserPreferencesNotifications>
}

// ============================================================================
// 通知相关
// ============================================================================

/**
 * 通知分类（粗分组，用于筛选/索引）
 */
export type NotificationCategory = "task" | "system" | "youtube"

/**
 * 通知优先级
 */
export type NotificationPriority = "normal" | "high"

/**
 * 通知对象
 * 匹配后端 NotificationResponse schema（type + 语言无关 params 渲染）
 */
export interface Notification {
  id: string
  type: string
  category: string
  priority: string
  params: Record<string, unknown>
  action_url: string | null
  // 过渡期后端默认语言(zh)兜底串；主渲染走 type+params
  title?: string | null
  message?: string | null
  created_at: string
  read_at: string | null
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
}

// ============================================================================
// YouTube 订阅同步
// ============================================================================

/**
 * YouTube OAuth 授权 URL 响应
 */
export interface YouTubeAuthResponse {
  auth_url: string
}

/**
 * YouTube 连接状态
 */
export interface YouTubeConnectionStatus {
  connected: boolean
  channel_id?: string
  subscription_count: number
  last_synced_at?: string
  token_expires_at?: string
  needs_reauth: boolean // true 表示 refresh token 已失效，需要重新授权
}

/**
 * YouTube 断开连接响应
 */
export interface YouTubeDisconnectResponse {
  disconnected: boolean
}

/**
 * YouTube 订阅项
 */
export interface YouTubeSubscriptionItem {
  channel_id: string
  channel_title: string
  channel_thumbnail?: string
  channel_description?: string
  subscribed_at?: string
  // 定制化字段
  is_starred: boolean
  auto_transcribe: boolean
  is_hidden: boolean
}

/**
 * YouTube 订阅列表请求
 */
export interface YouTubeSubscriptionListRequest {
  page?: number
  page_size?: number
  show_hidden?: boolean
  starred_only?: boolean
}

/**
 * YouTube 订阅列表响应
 */
export interface YouTubeSubscriptionListResponse {
  items: YouTubeSubscriptionItem[]
  total: number
  page: number
  page_size: number
}

/**
 * YouTube 同步触发响应
 */
export interface YouTubeSyncResponse {
  task_id: string
  message: string
}

/**
 * YouTube 视频项
 */
export interface YouTubeVideoItem {
  video_id: string
  channel_id: string
  title: string
  description?: string
  thumbnail_url?: string
  published_at: string
  duration_seconds?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  transcribed: boolean
  task_id?: string
}

/**
 * YouTube 视频列表请求
 */
export interface YouTubeChannelVideosRequest {
  page?: number
  page_size?: number
}

/**
 * YouTube 最新视频列表请求
 */
export interface YouTubeLatestVideosRequest {
  page?: number
  page_size?: number
}

/**
 * YouTube 视频列表响应
 */
export interface YouTubeVideoListResponse {
  items: YouTubeVideoItem[]
  total: number
  page: number
  page_size: number
  last_synced_at?: string
}

/**
 * YouTube 摘要风格推荐
 */
export interface YouTubeSummaryStyleRecommendation {
  style: SummaryStyle
  confidence: number
  reason: string
  cached: boolean
}

/**
 * YouTube 摘要风格推荐预热请求
 */
export interface YouTubeSummaryStylePrewarmRequest {
  video_ids: string[]
}

/**
 * YouTube 摘要风格推荐预热响应
 */
export interface YouTubeSummaryStylePrewarmResponse {
  task_id: string
  queued_count: number
  skipped_count: number
}

/**
 * YouTube 频道同步状态
 */
export interface YouTubeChannelSyncStatus {
  subscribed: boolean
  channel_title?: string
  video_count: number
  last_synced_at?: string
}

/**
 * YouTube 频道视频同步请求
 */
export interface YouTubeChannelVideosSyncRequest {
  max_videos?: number
}

/**
 * YouTube 视频转写请求
 */
export interface YouTubeTranscribeRequest {
  language?: string
  output_format?: string
}

/**
 * YouTube 视频转写响应
 */
export interface YouTubeTranscribeResponse {
  task_id: string
  video_id: string
  title: string
  message: string
}

/**
 * YouTube 同步进度概览
 */
export interface YouTubeSyncOverview {
  total_subscriptions: number
  synced_subscriptions: number
  pending_subscriptions: number
  total_videos: number
  channels_with_videos: number
  fully_synced: boolean
  last_sync_at?: string
}

/**
 * YouTube 异步任务状态
 */
export type YouTubeTaskStatus = 'pending' | 'started' | 'success' | 'failure' | 'revoked'

/**
 * YouTube 任务状态响应
 */
export interface YouTubeTaskStatusResponse {
  task_id: string
  status: YouTubeTaskStatus
  result?: {
    synced_count?: number
    message?: string
  }
  error?: string | null
}

/**
 * YouTube 订阅设置
 */
export interface YouTubeSubscriptionSettings {
  is_starred: boolean
  auto_transcribe: boolean
  is_hidden: boolean
}

/**
 * YouTube 订阅设置更新请求
 */
export interface YouTubeSubscriptionSettingsUpdateRequest {
  is_starred?: boolean
  auto_transcribe?: boolean
  is_hidden?: boolean
}

/**
 * YouTube 批量设置特别关注请求
 */
export interface YouTubeBatchStarRequest {
  channel_ids: string[]
  is_starred: boolean
}

/**
 * YouTube 批量设置自动转写请求
 */
export interface YouTubeBatchAutoTranscribeRequest {
  channel_ids: string[]
  auto_transcribe: boolean
}

// ============================================================================
// SSE 摘要流式图片事件
// ============================================================================

/**
 * SSE images.processing 事件数据
 * 当后端开始生成图片时发送
 */
export interface SSEImagesProcessingEvent {
  status: "generating"
  total: number
}

/**
 * SSE image.ready 事件数据（单数）
 * 每张图片生成完成时单独发送
 */
export interface SSEImageReadyEvent {
  placeholder: string  // e.g., "{{IMAGE: 供应链时间轴}}"
  url: string | null   // null if failed
  status: "success" | "failed"
  current: number      // 当前是第几张，如 2
  total: number        // 总共几张，如 3
}

/**
 * 全局 WS（user:{uid}:updates）image_ready 事件的 data 形状（渐进式展示：图就地补）。
 * 与旧 SSE SSEImageReadyEvent 区别：① 走全局 WS 而非 summary SSE；
 * ② status 为 "ready"|"failed"（SSE 是 "success"|"failed"）；③ 带 task_id/summary_id/summary_type。
 * 字段命名必须与后端 image_ready payload 完全一致。
 */
export interface WsImageReadyData {
  task_id: string
  summary_id: string
  summary_type: "overview"
  placeholder: string
  status: "ready" | "failed"
  url: string | null
  model_id: string | null
}

/**
 * SSE images.completed 事件数据
 * 所有图片生成完成时发送
 */
export interface SSEImagesCompletedEvent {
  total: number
  success_count: number
  failed_count: number
}

/**
 * 后端 summaries.images JSONB 列的单项结构（渐进式展示：overview 配图持久化）。
 * placeholder 字符串本身即 content 里的 {{IMAGE:..}} 锚点 + 前端 Map 的 key（无额外 id）。
 * 字段命名必须与后端 SummaryItem.images 完全一致。
 */
export interface SummaryImage {
  placeholder: string
  status: "pending" | "ready" | "failed"
  url: string | null
  alt: string
  model_id: string | null
  error: string | null
}

/**
 * 流式图片状态
 * 用于前端追踪每个占位符的状态
 */
export interface StreamingImage {
  placeholder: string
  description: string
  url: string | null
  status: "pending" | "generating" | "ready" | "failed"
}

// ============================================================================
// 公开探索(/api/v1/public/*,匿名只读;对应后端 app/schemas/public.py 白名单裁剪字段)
// ============================================================================

export interface PublicTaskListItem {
  id: string
  title: string | null
  source_type: SourceType
  duration_seconds: number | null
  detected_language: string | null
  detected_summary_style: string | null
  published_at: string | null
}

export interface PublicTaskListResponse {
  items: PublicTaskListItem[]
  total: number
  page: number
  page_size: number
}

/**
 * 公开详情的 YouTube 元数据(裁剪面)。
 *
 * 与私有 {@link YouTubeVideoInfo} 的关键差异:channel_id / channel_title 可空——
 * 公开侧抓取失败/无频道信息时后端直接给 null,前端必须容忍并降级(不渲染 /channel/null 链接)。
 * 该字段在后端 feature 分支上线前可能整体缺失(undefined),消费方须按 null 同义处理。
 */
export interface PublicYouTubeInfo {
  video_id: string
  title: string
  thumbnail_url: string | null
  duration_seconds: number | null
  channel_id: string | null
  channel_title: string | null
}

export interface PublicTaskDetail {
  id: string
  title: string | null
  source_type: SourceType
  source_url: string | null
  audio_url: string | null // 媒体需配合 mintPublicMediaTicket 的 ?token= 使用,不可直接作 src
  /**
   * OSS 预签名音频直链(3600s,完整 https URL,绕开隧道):有值时优先作播放源,**不拼媒体票**;
   * 播放失败回落 audio_url 代理路径。后端 feature 上线前可能整体缺失(undefined=null 同义)。
   */
  audio_direct_url?: string | null
  duration_seconds: number | null
  detected_language: string | null
  detected_summary_style: string | null
  published_at: string | null
  created_at: string
  // YouTube 视频封面卡元数据(仅 YouTube 来源任务;后端 feature 分支上线前可能整体缺失=null 同义)。
  youtube_info?: PublicYouTubeInfo | null
}

export interface PublicTranscriptItem {
  sequence: number
  speaker_id: string | null
  speaker_label: string | null
  content: string
  start_time: number
  end_time: number
}

export interface PublicTranscriptResponse {
  task_id: string
  total: number
  items: PublicTranscriptItem[]
}

/** 公开摘要配图(裁剪面:无 model_id/error)。 */
export interface PublicSummaryImage {
  placeholder: string
  status: "pending" | "ready" | "failed"
  url: string | null
  alt: string
}

export interface PublicSummaryItem {
  summary_type: SummaryType
  version: number
  content: string
  image_url: string | null
  images: PublicSummaryImage[] | null
  created_at: string
}

export interface PublicSummaryResponse {
  task_id: string
  total: number
  items: PublicSummaryItem[]
}

/** PATCH /tasks/{id}/visibility 出参。 */
export interface TaskVisibilityResponse {
  id: string
  is_public: boolean
  published_at: string | null
}
