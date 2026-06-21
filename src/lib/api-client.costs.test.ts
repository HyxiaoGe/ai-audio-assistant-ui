import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAPIClient } from "./api-client"

// 成本可见:管理员按用户成本看板。锁定 api-client 方法打到正确端点、解包统一信封后
// 直接返回 AdminCostsResponse(items/llm_source 等)。
describe("api-client getCostsByUser", () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("GETs /admin/costs/by-user and unwraps the envelope data", async () => {
    let calledUrl = ""
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      calledUrl = String(input)
      return new Response(
        JSON.stringify({
          code: 0,
          message: "成功",
          data: {
            items: [
              {
                user_id: "u-1",
                display_name: "小明",
                asr_cny: 3.0,
                asr_paid_cny: 1.0,
                asr_calls: 5,
                image_cny: 0.5,
                cny_total: 3.5,
                llm_usd: 0.0064,
              },
            ],
            llm_source: "litellm",
            period_start: null,
            period_end: null,
            currency_note: "两列不可相加",
          },
          traceId: "t-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    const result = await client.getCostsByUser()

    expect(calledUrl).toContain("/admin/costs/by-user")
    expect(result.llm_source).toBe("litellm")
    expect(result.items).toHaveLength(1)
    expect(result.items[0].cny_total).toBe(3.5)
    expect(result.items[0].llm_usd).toBe(0.0064)
  })
})
