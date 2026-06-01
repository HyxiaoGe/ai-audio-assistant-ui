import type { APIClient } from "@/lib/api-client"

/**
 * 取 SSE（regenerate/compare）用的 stream 短票 token：签票成功返回 token，失败返回 null。
 *
 * 失败时**不回退**长效 access JWT —— 调用方会改走 HTTP + 轮询兜底。这避免在签票失败时
 * 把长效凭证拼进 EventSource 的 `?token=`（URL 会落进 nginx 日志/Referer/历史，正是短票
 * 改造要消除的泄露向量；后端 Phase 3 起也不再双接受长 JWT）。
 */
export async function resolveStreamToken(
  client: Pick<APIClient, "mintStreamTicket">,
  taskId: string,
  summaryType: string,
): Promise<string | null> {
  try {
    return (await client.mintStreamTicket(taskId, summaryType)).token
  } catch {
    return null
  }
}
