"use client"

import { useEffect } from "react"
import { recordFrontendVersion } from "@/store/version-store"

export const VERSION_POLL_INTERVAL_MS = 5 * 60 * 1000

// 拉一次 /version → 喂 record。失败/非 2xx 静默(网络抖动不报警,下周期重试)。
export async function pollVersionOnce(
  record: (v: string | null) => void = recordFrontendVersion,
): Promise<void> {
  try {
    const res = await fetch("/version", { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as { version?: string }
    record(data.version ?? null)
  } catch {
    // 静默
  }
}

// 可见时才轮询:隐藏标签页不发请求。返回是否执行了一次拉取(便于测试)。
export function pollWhenVisible(poll: () => void = () => void pollVersionOnce()): boolean {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return false
  }
  poll()
  return true
}

export function useVersionCheck(): void {
  useEffect(() => {
    pollWhenVisible()
    const interval = setInterval(() => pollWhenVisible(), VERSION_POLL_INTERVAL_MS)
    const onWake = () => pollWhenVisible()
    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("focus", onWake)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("focus", onWake)
    }
  }, [])
}
