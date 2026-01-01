import zh from "@/locales/zh.json"
import en from "@/locales/en.json"

interface Messages {
  [key: string]: string | Messages
}

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

function getStoredLocale(): string {
  if (typeof window === "undefined") return "zh"

  const storedLocale = localStorage.getItem("locale")
  if (storedLocale) {
    return storedLocale
  }

  const storedLanguage = localStorage.getItem("language")
  if (storedLanguage === "zh" || storedLanguage === "en") {
    return storedLanguage
  }

  return "zh"
}

export function translateStatic(key: string, locale?: string): string {
  const resolvedLocale = locale || getStoredLocale()
  const messages = resolveMessages(resolvedLocale)
  return getMessage(messages, key) || key
}
