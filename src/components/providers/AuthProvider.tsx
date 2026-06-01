"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"
import { maybeSilentLogin } from "@/lib/sso-probe"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    // 无本地 token 时先做一次性静默 SSO 探测（跨应用免登）；命中则页面跳走，
    // 未命中/已探测/已有会话则照常初始化。
    const path = window.location.pathname + window.location.search
    if (maybeSilentLogin(path)) return
    initialize()
  }, [initialize])

  return <>{children}</>
}
