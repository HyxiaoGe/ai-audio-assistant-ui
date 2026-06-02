"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import { hasPendingSsoReturn } from "@/lib/sso-probe"
import { Loader2 } from "lucide-react"

function AuthCallbackContent() {
  const router = useRouter()
  const completeLogin = useAuthStore((s) => s.completeLogin)
  const [error, setError] = useState<string | null>(null)
  const processed = useRef(false)
  // 是否为静默探测中转：在 completeLogin 消费 RETURN 之前（首帧）一次性判定。
  // 中转 ⇒ 渲染中性加载态（用户没主动登录，不该看到「登录中」）；交互式登录 ⇒ 显示「登录中」。
  const [isSilent] = useState(hasPendingSsoReturn)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    // SDK 的 handleCallback 自己从 window.location 读 code/state 并校验 state、换 token。
    completeLogin()
      .then((result) => {
        if (result.ok || result.error === "login_required" || result.error === "no_callback") {
          // 成功 → 目标页；静默探测未命中（login_required）→ 软回到原页；无回调参数
          // （no_callback，如单点登出后从 /auth/logout 302 裸回跳）→ 软回 /login。
          // 仅真实 OAuth 错误才落到下方错误屏。回跳路径都已由 store 算入 result.redirectPath。
          router.replace(result.redirectPath)
        } else {
          setError("Login failed. Please try again.")
        }
      })
      .catch(() => {
        setError("Login failed. Please try again.")
      })
  }, [completeLogin, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: "var(--app-error)" }}>{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="glass-control px-4 py-2 rounded-lg"
            style={{ color: "var(--app-text)" }}
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  // 静默探测中转：中性加载态，不显示「登录中」误导文案（用户只是刷新了已登录页）。
  if (isSilent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--app-text-muted)" }} />
      </div>
    )
  }

  // 用户主动发起的交互式登录：正常显示「登录中」。
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3" style={{ color: "var(--app-text-muted)" }}>
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Logging in...</span>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--app-text-muted)" }} />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
