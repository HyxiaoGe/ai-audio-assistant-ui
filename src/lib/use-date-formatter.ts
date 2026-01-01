"use client"

import { useMemo } from "react"
import { useSettings } from "@/lib/settings-context"
import {
  formatDateWithSettings,
  formatDateTimeWithSettings,
  formatRelativeTimeWithSettings,
} from "@/lib/utils"

export function useDateFormatter() {
  const { locale, timeZone, hourCycle } = useSettings()

  const settings = useMemo(
    () => ({
      locale,
      timeZone,
      hourCycle: hourCycle === "auto" ? null : hourCycle,
    }),
    [locale, timeZone, hourCycle]
  )

  return {
    formatDate: (input: Date | string, options?: Intl.DateTimeFormatOptions) =>
      formatDateWithSettings(
        input,
        options || {
          year: "numeric",
          month: "short",
          day: "numeric",
        },
        settings
      ),
    formatDateTime: (input: Date | string, options?: Intl.DateTimeFormatOptions) =>
      formatDateTimeWithSettings(
        input,
        options || {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
        settings
      ),
    formatRelativeTime: (input: Date | string) =>
      formatRelativeTimeWithSettings(input, settings),
  }
}
