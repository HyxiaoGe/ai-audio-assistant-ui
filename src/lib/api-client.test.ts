import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"
import { createAPIClient } from "./api-client"

// 后端/nginx 接受了连接却永不响应（过载、worker 卡死、上游断开）时，request() 之前没有超时，
// 返回的 Promise 永不 settle —— loading 永转、mutation 永不回报。这里锁定：请求必须在超时后
// 以 ApiError 拒绝，而不是无限挂起。
describe("api-client request timeout/abort", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it(
    "rejects with an ApiError instead of hanging forever when the backend never responds",
    async () => {
      // fetch 永不 resolve，但遵守 abort 信号：被中断时按 AbortError 拒绝（贴近真实 fetch 行为）。
      const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"))
          })
        })
      })
      vi.stubGlobal("fetch", fetchMock)

      // token 显式传入 → 跳过 getToken()，请求直接发起。
      const client = createAPIClient("test-token")
      // 同步挂上 catch，推进定时器期间不产生未处理拒绝。
      const settled = client.getTasks().catch((e: unknown) => e)

      // 推进到超时点：AbortController 触发 → fetch 拒绝 → request 捕获并抛 ApiError。
      await vi.advanceTimersByTimeAsync(30_000)

      const result = await settled
      expect(result).toBeInstanceOf(ApiError)
      expect((result as ApiError).code).toBe(50000)
    },
    2_000
  )
})
