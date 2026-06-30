import { describe, expect, it } from "vitest"
import { ApiError, ErrorCode } from "@/types/api"
import { isRateLimitError } from "./api-error"

describe("isRateLimitError", () => {
  it("RATE_LIMIT 常量为 40920", () => {
    expect(ErrorCode.RATE_LIMIT).toBe(40920)
  })

  it("对限流码 ApiError 返回 true,并带 retryAfter", () => {
    const err = new ApiError(40920, "操作过于频繁，请60秒后再试", "trace", undefined, undefined, 60)
    expect(isRateLimitError(err)).toBe(true)
    expect(err.retryAfter).toBe(60)
  })

  it("对其它码 ApiError 返回 false", () => {
    expect(isRateLimitError(new ApiError(40401, "not found", "t"))).toBe(false)
  })

  it("对非 ApiError 返回 false", () => {
    expect(isRateLimitError(new Error("x"))).toBe(false)
    expect(isRateLimitError(null)).toBe(false)
  })
})
