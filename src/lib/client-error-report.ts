/**
 * 前端未捕获错误上报(P3-3)。
 *
 * best-effort 遥测:把 error boundary / window.onerror / unhandledrejection 捕获的错误 POST 到
 * 后端 log-only sink(POST /api/v1/client-errors)。设计约束:
 * - **绝不抛错**:它本身跑在错误边界/全局监听里,自己再抛会雪上加霜。
 * - 优先 `navigator.sendBeacon`(页面卸载也能送达),不可用/队列满回落 keepalive fetch。
 * - 相对 URL(避免与 nginx 反代撞 CORS);不依赖 api-client(global-error 在 Provider 树之外)。
 * - 客户端去重 + 单会话上限:防错误循环把端点刷爆(后端另有按 IP 限流兜底)。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1"
const ENDPOINT = `${API_BASE}/client-errors`
// 构建标识(CI/Docker 注入时才有值),用于关联是哪个部署版本出错;dev 下为 undefined。
const RELEASE = process.env.NEXT_PUBLIC_BUILD_TAG

const MAX_REPORTS_PER_SESSION = 20
const DEDUPE_WINDOW_MS = 5000

let sentCount = 0
const recentKeys = new Map<string, number>()

export type ClientErrorSource = "error_boundary" | "global_error_boundary" | "window.onerror" | "unhandledrejection"

export interface ClientErrorInput {
  message: string
  source: ClientErrorSource | string
  stack?: string
  url?: string
  digest?: string
}

export function reportClientError(input: ClientErrorInput): void {
  try {
    if (typeof window === "undefined") return // SSR/构建期 no-op
    if (sentCount >= MAX_REPORTS_PER_SESSION) return

    const key = `${input.source}::${input.message}`
    const now = Date.now()
    const last = recentKeys.get(key)
    if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return
    recentKeys.set(key, now)
    sentCount += 1

    const payload = {
      message: input.message || "(no message)",
      source: input.source,
      stack: input.stack,
      url: input.url ?? (typeof location !== "undefined" ? location.href : undefined),
      digest: input.digest,
      release: RELEASE,
    }
    const body = JSON.stringify(payload)

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))
        if (ok) return // 送达(或已入队);否则(队列满返回 false)回落 fetch
      } catch {
        // sendBeacon 抛错(极少见)→ 回落 fetch
      }
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 上报失败就算了,绝不影响页面
    })
  } catch {
    // 任何意外都吞掉:上报器永远不能成为新的错误源。
  }
}

/**
 * 注册全局未捕获错误监听(window 'error' 与 'unhandledrejection'),捕获 React 错误边界
 * 之外的错误(异步回调/事件处理器/未 await 的 Promise)。返回卸载函数(组件 unmount 时调用)。
 */
export function installGlobalErrorListeners(): () => void {
  const onError = (event: ErrorEvent): void => {
    reportClientError({
      message: event.message || event.error?.message || "Unhandled error",
      source: "window.onerror",
      stack: event.error?.stack,
      url: event.filename || undefined,
    })
  }

  const onRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason as { message?: string; stack?: string } | undefined
    reportClientError({
      message: reason?.message || String(event.reason) || "Unhandled promise rejection",
      source: "unhandledrejection",
      stack: reason?.stack,
    })
  }

  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onRejection)
  return () => {
    window.removeEventListener("error", onError)
    window.removeEventListener("unhandledrejection", onRejection)
  }
}
