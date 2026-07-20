"use client"

import { useEffect } from "react"
import { subscribe as subscribeSdkAuth } from "auth-client-web"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import { maybeSilentLogin } from "@/lib/sso-probe"
import { configureAuth } from "@/lib/auth-sdk"
import { beginAuthSessionTransition, blockAuthSessionTransition } from "@/lib/auth-session-transition"
import { useI18n } from "@/lib/i18n-context"
import { notifySuccess } from "@/lib/notify"
import { Button } from "@/components/ui/button"

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
  const router = useRouter()
  const { t } = useI18n()
  const initialize = useAuthStore((s) => s.initialize)
  const status = useAuthStore((s) => s.status)
  const accountSwitchError = useAuthStore((s) => s.accountSwitchError)
  const switchedAccountEmail = useAuthStore((s) => s.switchedAccountEmail)

  useEffect(() => {
    configureAuth()
    let cleanup = Promise.resolve()
    return subscribeSdkAuth((sdkState) => {
      if (sdkState.status === "synchronizing") {
        beginAuthSessionTransition()
        cleanup = useAuthStore.getState().prepareAccountSwitch()
        return
      }
      if (
        sdkState.status === "authenticated" &&
        sdkState.user &&
        useAuthStore.getState().status === "synchronizing"
      ) {
        void cleanup
          .then(() =>
            useAuthStore
              .getState()
              .syncCommittedAccount(sdkState.user as unknown as Record<string, unknown>)
          )
          .catch((error: unknown) => {
            blockAuthSessionTransition()
            useAuthStore.setState({
              status: "synchronizing",
              accountSwitchError:
                error instanceof Error ? error.message : "账户缓存清理未完成，请重试",
            })
          })
      }
    })
  }, [])

  useEffect(() => {
    // 无本地 token 时先做一次性静默 SSO 探测（跨应用免登）；命中则页面跳走，
    // 未命中/已探测/已有会话则照常初始化。
    const path = window.location.pathname + window.location.search
    if (maybeSilentLogin(path)) return
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (switchedAccountEmail === null) return
    router.replace("/tasks")
    notifySuccess(
      switchedAccountEmail
        ? t("auth.accountSwitch.completedWithEmail", { email: switchedAccountEmail })
        : t("auth.accountSwitch.completed")
    )
    useAuthStore.getState().acknowledgeAccountSwitch()
  }, [router, switchedAccountEmail, t])

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

  return (
    <>
      {children}
      {status === "synchronizing" && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-[var(--app-bg)]/90 px-6 backdrop-blur-sm"
          role="status"
          aria-live="assertive"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-primary)]" />
            <p className="font-medium text-[var(--app-text)]">
              {accountSwitchError
                ? t("auth.accountSwitch.blockedTitle")
                : t("auth.accountSwitch.syncingTitle")}
            </p>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {accountSwitchError || t("auth.accountSwitch.syncingDescription")}
            </p>
            {accountSwitchError && (
              <Button
                type="button"
                className="mt-5"
                onClick={() => void useAuthStore.getState().checkLiveness()}
              >
                {t("auth.accountSwitch.retry")}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
