"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import { Loader2 } from "lucide-react"

function AuthCallbackContent() {
  const router = useRouter()
  const completeLogin = useAuthStore((s) => s.completeLogin)
  const [error, setError] = useState<string | null>(null)
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    // SDK 的 handleCallback 自己从 window.location 读 code/state 并校验 state、换 token。
    completeLogin()
      .then((result) => {
        if (result.ok) {
          router.replace(result.redirectPath)
        } else if (result.error === "login_required") {
          // 静默探测未命中 IdP 会话（P3.2b）：无声落到登录页，不报错。
          router.replace("/login")
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
