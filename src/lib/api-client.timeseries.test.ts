import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAPIClient } from "./api-client"

// 时序:任务趋势逐日端点。锁定 api-client 打到正确端点、query 带 tz/time_range、
// 解包统一信封后直接返回 StatsTasksTimeseriesResponse(buckets 等)。
describe("api-client getTaskStatsTimeseries", () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("GETs /stats/tasks/timeseries with tz + time_range and unwraps buckets", async () => {
    let calledUrl = ""
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      calledUrl = String(input)
      return new Response(
        JSON.stringify({
          code: 0,
          message: "成功",
          data: {
            time_range: {
              start: "2026-06-15T00:00:00+08:00",
              end: "2026-06-22T00:00:00+08:00",
            },
            timezone: "Asia/Shanghai",
            granularity: "day",
            buckets: [
              {
                date: "2026-06-21",
                total: 5,
                completed: 3,
                failed: 1,
                processing: 1,
                pending: 0,
                audio_duration_seconds: 123.4,
                asr_cost: 0.0123,
              },
            ],
          },
          traceId: "t-ts",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    const result = await client.getTaskStatsTimeseries({
      time_range: "week",
      tz: "Asia/Shanghai",
    })

    expect(calledUrl).toContain("/stats/tasks/timeseries")
    expect(calledUrl).toContain("time_range=week")
    expect(calledUrl).toContain("tz=Asia%2FShanghai")
    expect(result.timezone).toBe("Asia/Shanghai")
    expect(result.buckets).toHaveLength(1)
    expect(result.buckets[0].asr_cost).toBe(0.0123)
  })
})
