"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"
import { maybeSilentLogin } from "@/lib/sso-probe"

// 跨应用单点登出（SLO）落地：别处登出后，本标签页手里的 access token 签名仍然有效、本地无从
// 察觉。本组件用【只读存活探测】感知它——绝不强制轮换 refresh token。旧实现每次 focus 都走
// SDK refresh 轮换，慢/丢响应隧道下极易令客户端与服务端 refresh token 失同步、被重用检测误判
// 盗用而撤销该用户全部令牌 → 偶发被动登出。改用 store.checkLiveness：只读本地 token + 打一次
// denylist 受保护端点，被吊销则翻未登录，不轮换。
// 触发两路：① focus/可见性恢复 → 回到标签页即时探测（切回常同时触发两事件，用最小间隔去抖成
// 一次）；② 低频定时兜底 → 覆盖「纯播放/纯 SSE 等长时间不发受保护请求、也无 focus 事件」的空闲
// 可见页，把感知延迟封顶在该间隔（scoped media 短票不查 denylist，否则最坏要等 token 过期）。
const REVALIDATE_DEBOUNCE_MS = 3000
const LIVENESS_INTERVAL_MS = 5 * 60 * 1000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    // 无本地 token 时先做一次性静默 SSO 探测（跨应用免登）；命中则页面跳走，
    // 未命中/已探测/已有会话则照常初始化。
    const path = window.location.pathname + window.location.search
    if (maybeSilentLogin(path)) return
    initialize()
  }, [initialize])

  useEffect(() => {
    let lastAt = 0
    const probe = () => {
      // 只在已登录态探测：未登录/加载中无 token 可验，且避免与首屏静默探测竞态。
      if (useAuthStore.getState().status !== "authenticated") return
      const now = Date.now()
      if (now - lastAt < REVALIDATE_DEBOUNCE_MS) return
      lastAt = now
      void useAuthStore.getState().checkLiveness()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") probe()
    }
    window.addEventListener("focus", probe)
    document.addEventListener("visibilitychange", onVisibility)
    const interval = window.setInterval(probe, LIVENESS_INTERVAL_MS)
    return () => {
      window.removeEventListener("focus", probe)
      document.removeEventListener("visibilitychange", onVisibility)
      window.clearInterval(interval)
    }
  }, [])

  return <>{children}</>
}
