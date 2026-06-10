import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchPublicSummary, fetchPublicTaskDetail } from "./server-api"

// ============================================================================
// 测试夹具:后端统一信封 {code, message, data, traceId}
// ============================================================================

const DETAIL_DATA = {
  id: "t1",
  title: "公开详情标题",
  source_type: "upload",
  source_url: null,
  audio_url: null,
  duration_seconds: 60,
  detected_language: "zh",
  detected_summary_style: "general",
  published_at: "2026-06-10T00:00:00Z",
  created_at: "2026-06-09T00:00:00Z",
}

const SUMMARY_DATA = {
  task_id: "t1",
  total: 1,
  items: [
    {
      summary_type: "overview",
      version: 1,
      content: "摘要正文",
      image_url: null,
      images: [],
      created_at: "2026-06-10T00:00:00Z",
    },
  ],
}

function envelope(code: number, data: unknown) {
  return { code, message: code === 0 ? "ok" : "error", data, traceId: "trace-1" }
}

/** 构造最小 Response 桩:只实现 server-api 用到的 ok/status/json()。 */
function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function stubFetch(impl: (...args: Parameters<typeof fetch>) => Promise<Response>) {
  const mock = vi.fn(impl)
  vi.stubGlobal("fetch", mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("fetchPublicTaskDetail(服务端 LAN 预取 detail)", () => {
  it("信封 code=0:拆出 data 返回 ok", async () => {
    const mock = stubFetch(() => Promise.resolve(jsonResponse(envelope(0, DETAIL_DATA))))
    const result = await fetchPublicTaskDetail("t1")
    expect(result).toEqual({ status: "ok", data: DETAIL_DATA })
    // 默认内网 base = 容器 DNS;cache no-store(公开任务可撤回)+ 超时信号
    expect(mock).toHaveBeenCalledTimes(1)
    const [url, init] = mock.mock.calls[0]
    expect(url).toBe("http://ai-audio-assistant-web-api:8000/api/v1/public/tasks/t1")
    expect(init?.cache).toBe("no-store")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    // 服务端不知道用户语言,数据字段语言无关 → 不带 Accept-Language
    expect(init?.headers).toBeUndefined()
  })

  it("AUDIO_API_INTERNAL_URL 可覆盖内网 base", async () => {
    vi.stubEnv("AUDIO_API_INTERNAL_URL", "http://127.0.0.1:8000/api/v1")
    const mock = stubFetch(() => Promise.resolve(jsonResponse(envelope(0, DETAIL_DATA))))
    await fetchPublicTaskDetail("t1")
    expect(mock.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/v1/public/tasks/t1")
  })

  it("信封 code=40401(不存在/未公开/已收回)→ not_found", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(envelope(40401, null))))
    const result = await fetchPublicTaskDetail("t1")
    expect(result).toEqual({ status: "not_found" })
  })

  it("信封其他非 0 业务码 → unavailable(回落客户端)", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(envelope(50000, null))))
    expect(await fetchPublicTaskDetail("t1")).toEqual({ status: "unavailable" })
  })

  it("HTTP 非 200(网关 5xx)→ unavailable", async () => {
    stubFetch(() => Promise.resolve(jsonResponse("Bad Gateway", false, 502)))
    expect(await fetchPublicTaskDetail("t1")).toEqual({ status: "unavailable" })
  })

  it("响应体不是信封(无数字 code)→ unavailable", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ hello: "world" })))
    expect(await fetchPublicTaskDetail("t1")).toEqual({ status: "unavailable" })
  })

  it("响应体不是合法 JSON → unavailable", async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      } as unknown as Response)
    )
    expect(await fetchPublicTaskDetail("t1")).toEqual({ status: "unavailable" })
  })

  it("超时(AbortError)→ unavailable,绝不抛出", async () => {
    stubFetch(() => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")))
    expect(await fetchPublicTaskDetail("t1")).toEqual({ status: "unavailable" })
  })

  it("网络错(本地 dev 不在 docker 网络,容器名解析失败)→ unavailable", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")))
    expect(await fetchPublicTaskDetail("t1")).toEqual({ status: "unavailable" })
  })
})

describe("fetchPublicSummary(服务端 LAN 预取 summary)", () => {
  it("信封 code=0:拆出 data 返回", async () => {
    const mock = stubFetch(() => Promise.resolve(jsonResponse(envelope(0, SUMMARY_DATA))))
    const result = await fetchPublicSummary("t1")
    expect(result).toEqual(SUMMARY_DATA)
    expect(mock.mock.calls[0][0]).toBe(
      "http://ai-audio-assistant-web-api:8000/api/v1/public/tasks/t1/summaries"
    )
  })

  it("信封非 0(含 40401)→ undefined(回落客户端,40401 由 detail 路负责 404)", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(envelope(40401, null))))
    expect(await fetchPublicSummary("t1")).toBeUndefined()
  })

  it("HTTP 非 200 → undefined", async () => {
    stubFetch(() => Promise.resolve(jsonResponse("oops", false, 503)))
    expect(await fetchPublicSummary("t1")).toBeUndefined()
  })

  it("超时/网络错 → undefined,绝不抛出", async () => {
    stubFetch(() => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")))
    expect(await fetchPublicSummary("t1")).toBeUndefined()
  })
})
