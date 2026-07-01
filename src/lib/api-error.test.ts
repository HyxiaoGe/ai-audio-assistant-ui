import { describe, expect, it } from "vitest"
import { ApiError, ErrorCode } from "@/types/api"
import { isDiscoverDisabled } from "./api-error"

describe("isDiscoverDisabled", () => {
  it("true for DISCOVER_DISABLED ApiError", () => {
    expect(isDiscoverDisabled(new ApiError(ErrorCode.DISCOVER_DISABLED, "off", "t"))).toBe(true)
  })
  it("false for other errors", () => {
    expect(isDiscoverDisabled(new ApiError(40000, "x", "t"))).toBe(false)
    expect(isDiscoverDisabled(new Error("nope"))).toBe(false)
  })
})
