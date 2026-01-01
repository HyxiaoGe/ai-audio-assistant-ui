import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { translateStatic } from "@/lib/i18n-static"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function getUserLocale(): string {
  if (typeof window !== "undefined") {
    const locale = localStorage.getItem("locale")
    if (locale) return locale

    const language = localStorage.getItem("language")
    if (language === "zh") return "zh-CN"
    if (language === "en") return "en-US"

    return navigator.language || "zh-CN"
  }

  return "zh-CN"
}

export function getUserTimeZone(): string {
  if (typeof window !== "undefined") {
    const timeZone = localStorage.getItem("timeZone")
    if (timeZone && timeZone !== "auto") return timeZone

    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  }

  return "UTC"
}

export function getUserHourCycle(): "h12" | "h23" | null {
  if (typeof window !== "undefined") {
    const hourCycle = localStorage.getItem("hourCycle")
    if (hourCycle === "h12" || hourCycle === "h23") {
      return hourCycle
    }
  }

  return null
}

export interface DateFormatSettings {
  locale: string
  timeZone: string
  hourCycle: "h12" | "h23" | null
}

function resolveTimeZone(timeZone: string): string {
  if (timeZone && timeZone !== "auto") {
    return timeZone
  }
  if (typeof window !== "undefined") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  }
  return "UTC"
}

export function formatDateWithSettings(
  input: Date | string,
  options: Intl.DateTimeFormatOptions,
  settings: DateFormatSettings
): string {
  const date = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return "--"

  const timeZone = resolveTimeZone(settings.timeZone)

  return new Intl.DateTimeFormat(settings.locale, {
    timeZone,
    ...(settings.hourCycle ? { hourCycle: settings.hourCycle } : {}),
    ...options,
  }).format(date)
}

export function formatDateTimeWithSettings(
  input: Date | string,
  options: Intl.DateTimeFormatOptions,
  settings: DateFormatSettings
): string {
  return formatDateWithSettings(input, options, settings)
}

export function formatRelativeTimeWithSettings(
  input: Date | string,
  settings: DateFormatSettings
): string {
  const date = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return "--"

  const now = new Date()
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const locale = settings.locale

  if (absSeconds < 10) {
    return translateStatic("common.justNow", locale)
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  if (absSeconds < 60) {
    return rtf.format(diffSeconds, "second")
  }

  const diffMinutes = Math.round(diffSeconds / 60)
  if (absSeconds < 3600) {
    return rtf.format(diffMinutes, "minute")
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (absSeconds < 86400) {
    return rtf.format(diffHours, "hour")
  }

  const diffDays = Math.round(diffHours / 24)
  if (absSeconds < 604800) {
    return rtf.format(diffDays, "day")
  }

  const diffWeeks = Math.round(diffDays / 7)
  if (absSeconds < 2419200) {
    return rtf.format(diffWeeks, "week")
  }

  const diffMonths = Math.round(diffDays / 30)
  if (absSeconds < 31536000) {
    return rtf.format(diffMonths, "month")
  }

  const diffYears = Math.round(diffDays / 365)
  return rtf.format(diffYears, "year")
}

export function formatDate(
  input: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  return formatDateWithSettings(
    input,
    options,
    {
      locale: getUserLocale(),
      timeZone: getUserTimeZone(),
      hourCycle: getUserHourCycle(),
    }
  )
}

export function formatDateTime(
  input: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  return formatDate(input, options)
}

export function formatRelativeTime(input: Date | string): string {
  return formatRelativeTimeWithSettings(input, {
    locale: getUserLocale(),
    timeZone: getUserTimeZone(),
    hourCycle: getUserHourCycle(),
  })
}
