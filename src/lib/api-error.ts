import { ApiError, ErrorCode } from "@/types/api"

/**
 * 限流(40920)判定:前端按统一信封的业务码识别限流,不依赖 HTTP 状态码。
 * 用于在公开页等限流面显示后端本地化的友好文案(err.message),不在前端维护码→文案 map。
 */
export const isRateLimitError = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.code === ErrorCode.RATE_LIMIT
