import { ApiError, ErrorCode } from "@/types/api"

export const isDiscoverDisabled = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.code === ErrorCode.DISCOVER_DISABLED
