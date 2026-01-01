"use client"

import { createContext, useContext, useMemo } from "react"
import { useSettings } from "@/lib/settings-context"
import zh from "@/locales/zh.json"
import en from "@/locales/en.json"

interface Messages {
  [key: string]: string | Messages
}

interface I18nContextValue {
  locale: string
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function resolveMessages(locale: string): Messages {
  return locale.toLowerCase().startsWith("zh") ? (zh as Messages) : (en as Messages)
}

function getMessage(messages: Messages, key: string): string | undefined {
  const parts = key.split(".")
  let current: Messages | string | undefined = messages

  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined
    }
    current = (current as Messages)[part]
  }

  return typeof current === "string" ? current : undefined
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useSettings()
  const messages = useMemo(() => resolveMessages(locale), [locale])

  const value = useMemo<I18nContextValue>(() => {
    const translate = (key: string, vars?: Record<string, string | number>) => {
      const message = getMessage(messages, key)
      if (!message) return key
      return interpolate(message, vars)
    }

    return { locale, t: translate }
  }, [locale, messages])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return context
}
