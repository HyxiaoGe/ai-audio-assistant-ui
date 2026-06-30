import { afterEach, describe, expect, it, vi } from "vitest"
import { createAPIClient } from "./api-client"
import { ApiError } from "@/types/api"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function stub429(headers: Record<string, string>) {
  const body = JSON.stringify({
    code: 40920,
    message: "操作过于频繁，请60秒后再试",
    data: null,
    traceId: "t",
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status: 429, headers: { "Content-Type": "application/json", ...headers } })),
  )
}

describe("api-client 解析限流 429 的 Retry-After", () => {
  it("带 Retry-After 头:ApiError.code=40920 且 retryAfter=60(httpStatus 仍 undefined)", async () => {
    stub429({ "Retry-After": "60" })
    const client = createAPIClient("test-token")
    await expect(client.getTaskStatusCounts()).rejects.toMatchObject({
      code: 40920,
      retryAfter: 60,
    })
    // 统一信封路径不污染 httpStatus
    try {
      await client.getTaskStatusCounts()
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).httpStatus).toBeUndefined()
    }
  })

  it("无 Retry-After 头:retryAfter 为 undefined,不崩", async () => {
    stub429({})
    const client = createAPIClient("test-token")
    await expect(client.getTaskStatusCounts()).rejects.toMatchObject({ code: 40920 })
    try {
      await client.getTaskStatusCounts()
    } catch (e) {
      expect((e as ApiError).retryAfter).toBeUndefined()
    }
  })
})
