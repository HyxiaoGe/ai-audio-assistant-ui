"use client"

import { Github, KeyRound, Loader2, Mic } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { EmailCodeLoginPanel } from "@/components/auth/EmailCodeLoginPanel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  cancelEmailCodeLogin,
  resendEmailCodeLogin,
  startEmailCodeLogin,
  verifyEmailCodeLogin,
} from "@/lib/auth/emailCodeAuth"
import {
  getEmailLoginCapabilities,
  type EmailLoginCapabilities,
} from "@/lib/auth-sdk"
import { useI18n } from "@/lib/i18n-context"
import {
  loginWithGitHub,
  loginWithGoogle,
  useAuthStore,
} from "@/store/auth-store"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthenticated?: () => void
  callbackUrl?: string
}

interface LoginModalContentProps {
  active: boolean
  callbackUrl: string
  onAuthenticated?: () => void
  onClose: () => void
  onCriticalOperationChange: (critical: boolean) => void
}

const EMAIL_LOGIN_UNAVAILABLE: EmailLoginCapabilities = { headless: false }

function LoginModalContent({
  active,
  callbackUrl,
  onAuthenticated,
  onClose,
  onCriticalOperationChange,
}: LoginModalContentProps) {
  const [loading, setLoading] = useState<"google" | "github" | null>(null)
  const [view, setView] = useState<"methods" | "email">("methods")
  const [emailCapabilities, setEmailCapabilities] = useState(EMAIL_LOGIN_UNAVAILABLE)
  const completeEmailCodeLogin = useAuthStore((state) => state.completeEmailCodeLogin)
  const { t } = useI18n()

  useEffect(() => {
    let current = true
    void getEmailLoginCapabilities()
      .then((capabilities) => {
        if (current) setEmailCapabilities(capabilities)
      })
      .catch(() => {
        if (current) setEmailCapabilities(EMAIL_LOGIN_UNAVAILABLE)
      })
    return () => { current = false }
  }, [])

  const handleSocialLogin = (provider: "google" | "github") => {
    setLoading(provider)
    if (provider === "google") {
      loginWithGoogle(callbackUrl)
    } else {
      loginWithGitHub(callbackUrl)
    }
  }

  const handleVerifyEmailCode = async (
    input: Parameters<typeof verifyEmailCodeLogin>[0]
  ) => {
    const result = await verifyEmailCodeLogin(input)
    completeEmailCodeLogin(result.user as unknown as Record<string, unknown>)
  }

  const handleEmailAuthenticated = () => {
    if (onAuthenticated) {
      onAuthenticated()
      return
    }
    onClose()
  }

  if (view === "email") {
    return (
      <EmailCodeLoginPanel
        active={active}
        start={startEmailCodeLogin}
        resend={resendEmailCodeLogin}
        verify={handleVerifyEmailCode}
        cancel={cancelEmailCodeLogin}
        onBackToMethods={() => setView("methods")}
        onAuthenticated={handleEmailAuthenticated}
        onCriticalOperationChange={onCriticalOperationChange}
      />
    )
  }

  return (
    <>
      <DialogTitle className="sr-only">{t("auth.loginTitle")}</DialogTitle>
      <DialogDescription className="sr-only">
        {t("auth.loginSubtitle")}
      </DialogDescription>

      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-[image:var(--app-brand-gradient)]">
          <Mic className="size-6 text-white" />
        </div>
        <h1 className="text-h1 mb-2 text-[var(--app-text)]">
          {t("app.name")}
        </h1>
        <p className="text-body-default text-[var(--app-text-muted)]">
          {t("app.tagline")}
        </p>
      </div>

      <div className="mb-8 space-y-4">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full text-base"
          onClick={() => handleSocialLogin("google")}
          disabled={loading !== null}
        >
          {loading === "google" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19.8 10.2273C19.8 9.51819 19.7364 8.83637 19.6182 8.18182H10.2V12.05H15.6382C15.4 13.3 14.6727 14.3591 13.5864 15.0682V17.5773H16.8182C18.7091 15.8364 19.8 13.2727 19.8 10.2273Z" fill="#4285F4" />
              <path d="M10.2 20C12.9 20 15.1682 19.1045 16.8182 17.5773L13.5864 15.0682C12.6864 15.6682 11.5455 16.0227 10.2 16.0227C7.59545 16.0227 5.38182 14.2636 4.58636 11.9H1.25455V14.4909C2.89545 17.7591 6.30909 20 10.2 20Z" fill="#34A853" />
              <path d="M4.58636 11.9C4.38636 11.3 4.27273 10.6591 4.27273 10C4.27273 9.34091 4.38636 8.7 4.58636 8.1V5.50909H1.25455C0.572727 6.86364 0.2 8.38636 0.2 10C0.2 11.6136 0.572727 13.1364 1.25455 14.4909L4.58636 11.9Z" fill="#FBBC04" />
              <path d="M10.2 3.97727C11.6682 3.97727 12.9818 4.48182 14.0227 5.47273L16.8909 2.60455C15.1636 0.986364 12.8955 0 10.2 0C6.30909 0 2.89545 2.24091 1.25455 5.50909L4.58636 8.1C5.38182 5.73636 7.59545 3.97727 10.2 3.97727Z" fill="#EA4335" />
            </svg>
          )}
          {loading === "google" ? t("auth.redirecting") : t("auth.loginWithGoogle")}
        </Button>

        <Button
          type="button"
          size="lg"
          className="w-full bg-[var(--app-github-bg)] text-base text-white hover:bg-[var(--app-github-hover)]"
          onClick={() => handleSocialLogin("github")}
          disabled={loading !== null}
        >
          {loading === "github" ? <Loader2 className="animate-spin" /> : <Github />}
          {loading === "github" ? t("auth.redirecting") : t("auth.loginWithGitHub")}
        </Button>

        {emailCapabilities.headless ? (
          <Button
            type="button"
            size="lg"
            className="w-full text-base"
            onClick={() => setView("email")}
            disabled={loading !== null}
          >
            <KeyRound />
            {t("auth.emailCodeLogin")}
          </Button>
        ) : null}
      </div>

      <p className="text-caption text-center text-[var(--app-text-subtle)]">
        {t("auth.agreementPrefix")} {" "}
        <span className="text-[var(--app-primary)]">{t("auth.agreementLink")}</span>
        {" "}{t("auth.agreementAnd")} {" "}
        <span className="text-[var(--app-primary)]">{t("auth.privacyPolicy")}</span>
      </p>
    </>
  )
}

export default function LoginModal({
  isOpen,
  onClose,
  onAuthenticated,
  callbackUrl = "/tasks",
}: LoginModalProps) {
  const [criticalOperation, setCriticalOperation] = useState(false)
  const criticalOperationRef = useRef(false)
  const dialogOpen = criticalOperation ? true : isOpen

  const handleCriticalOperationChange = (critical: boolean) => {
    criticalOperationRef.current = critical
    setCriticalOperation(critical)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && criticalOperationRef.current) return
    if (!open) onClose()
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="block w-full max-w-md rounded-2xl p-8 sm:max-w-md sm:p-12"
        showCloseButton={!criticalOperation}
        onEscapeKeyDown={(event) => {
          if (criticalOperationRef.current) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (criticalOperationRef.current) event.preventDefault()
        }}
      >
        {dialogOpen ? (
          <LoginModalContent
            active={dialogOpen}
            callbackUrl={callbackUrl}
            onClose={onClose}
            onAuthenticated={onAuthenticated}
            onCriticalOperationChange={handleCriticalOperationChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
