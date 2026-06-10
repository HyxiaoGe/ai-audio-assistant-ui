/**
 * 服务端专用公开接口取数(server-only 语义:仅供服务器组件 import,勿进客户端 bundle)。
 *
 * 背景:UI 容器与后端容器同机同 Docker 网络,容器内直连
 * `http://ai-audio-assistant-web-api:8000` 是 LAN 级延迟(<10ms);而浏览器侧每个公开接口
 * 要经 cloudflared 隧道 ~1.5s 往返。服务器组件预取能把数据段的隧道往返整段消掉。
 *
 * 设计要点:
 * - 不能复用浏览器侧 api-client(依赖相对路径与 window),这里用原生 fetch 自己拆统一信封
 *   `{code, message, data, traceId}`。
 * - 不带 Accept-Language:服务端不知道用户语言,且数据字段本身语言无关。
 * - `cache: "no-store"`:公开任务可被作者随时撤回,不做 Next Data Cache。
 *   (Next Router Cache 默认 30s 内往返仍可能看到刚撤回的任务——窗口极小,且客户端
 *   loader 重试仍会拉到 40401 纠正,属已接受取舍,勿在此层修。)
 * - 失败永不抛出(超时/非 200/信封非 0/网络错):返回 unavailable/undefined,由客户端
 *   既有 loader 兜底照常拉取。回落是静默的(无遥测);本地 npm run dev 不在 docker
 *   网络,容器名解析失败是常态,永远走回落属预期。
 */

import type { PublicSummaryResponse, PublicTaskDetail } from "@/types/api"

/** 内网 base:默认值=容器 DNS(已实测可达);env 留覆盖口。每次调用读取,便于测试与运行时覆盖。 */
function internalApiBase(): string {
  return process.env.AUDIO_API_INTERNAL_URL || "http://ai-audio-assistant-web-api:8000/api/v1"
}

/** 短超时:LAN 正常 <10ms,3s 还没回来说明内网路径不可用,赶紧回落客户端,别拖住 RSC 渲染。 */
const SERVER_FETCH_TIMEOUT_MS = 3_000

/** 后端统一响应信封。 */
interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  traceId: string
}

/**
 * 服务端取公开信封接口:返回 {code, data},任何传输层/解析失败返回 undefined。
 * 业务码语义(0=成功/40401=不存在)由各调用方自行解释。
 */
async function fetchPublicEnvelope<T>(path: string): Promise<{ code: number; data: T } | undefined> {
  try {
    const res = await fetch(`${internalApiBase()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const envelope = (await res.json()) as ApiEnvelope<T> | null
    // 非信封形状(网关错误页/空体)按失败处理
    if (!envelope || typeof envelope.code !== "number") return undefined
    return { code: envelope.code, data: envelope.data }
  } catch {
    // 超时(TimeoutError)/ DNS 解析失败 / 连接拒绝 / JSON 解析失败:静默回落客户端拉取
    return undefined
  }
}

/**
 * detail 预取结果三态:
 * - ok:        拿到数据,作为 initialDetail 传给客户端
 * - not_found: 信封 code=40401(任务不存在/未公开/已收回),页面应服务端直接 notFound()
 * - unavailable: 其余一切失败,回落客户端既有 loader
 */
export type ServerPublicTaskDetailResult =
  | { status: "ok"; data: PublicTaskDetail }
  | { status: "not_found" }
  | { status: "unavailable" }

/** 服务端预取公开任务详情(GET /public/tasks/{id})。 */
export async function fetchPublicTaskDetail(id: string): Promise<ServerPublicTaskDetailResult> {
  const result = await fetchPublicEnvelope<PublicTaskDetail>(
    `/public/tasks/${encodeURIComponent(id)}`
  )
  if (!result) return { status: "unavailable" }
  if (result.code === 40401) return { status: "not_found" }
  if (result.code !== 0) return { status: "unavailable" }
  return { status: "ok", data: result.data }
}

/**
 * 服务端预取公开摘要(GET /public/tasks/{id}/summaries)。
 * 任何失败(含 40401——是否 404 由 detail 路统一裁决)返回 undefined,回落客户端拉取。
 */
export async function fetchPublicSummary(id: string): Promise<PublicSummaryResponse | undefined> {
  const result = await fetchPublicEnvelope<PublicSummaryResponse>(
    `/public/tasks/${encodeURIComponent(id)}/summaries`
  )
  if (!result || result.code !== 0) return undefined
  return result.data
}
