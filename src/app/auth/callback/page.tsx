"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore, getAndClearRedirectPath } from "@/store/auth-store"
import { Loader2 } from "lucide-react"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const exchangeCode = useAuthStore((s) => s.exchangeCode)
  const [error, setError] = useState<string | null>(null)
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const code = searchParams.get("code")
    const redirect = getAndClearRedirectPath()

    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No authorization code received")
      return
    }

    exchangeCode(code)
      .then(() => {
        router.replace(redirect)
      })
      .catch(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError("Login failed. Please try again.")
      })
  }, [searchParams, exchangeCode, router])

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
