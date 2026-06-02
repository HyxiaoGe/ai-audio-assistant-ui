"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"
import { maybeSilentLogin } from "@/lib/sso-probe"

// 跨应用单点登出（SLO）落地窗口：别处登出后，本标签页手里的 access token 签名仍然有效、
// 本地无从察觉，直到它过期（<=15min）。标签页重新获得焦点 / 重新变为可见时，强制校验一次
// 令牌——revalidateToken 走 SDK refresh 做服务端往返，refresh token 已被吊销则定论失败、
// store 翻转为未登录。切回标签页常同时触发 focus + visibilitychange，用最小间隔去抖成一次。
const REVALIDATE_DEBOUNCE_MS = 3000

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
    const revalidate = () => {
      // 只在已登录态校验：未登录/加载中无 token 可验，且避免与首屏静默探测竞态。
      if (useAuthStore.getState().status !== "authenticated") return
      const now = Date.now()
      if (now - lastAt < REVALIDATE_DEBOUNCE_MS) return
      lastAt = now
      void useAuthStore.getState().revalidateToken()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") revalidate()
    }
    window.addEventListener("focus", revalidate)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", revalidate)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return <>{children}</>
}
