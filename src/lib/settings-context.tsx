"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTheme } from "next-themes"
import { runThemeTransition } from "@/lib/theme-transition"

type Language = "zh" | "en"
type Theme = "light" | "dark" | "system"
type HourCycle = "auto" | "h12" | "h23"

interface SettingsState {
  language: Language
  theme: Theme
  locale: string
  timeZone: string
  hourCycle: HourCycle
}

interface SettingsContextValue extends SettingsState {
  setLanguage: (language: Language) => void
  setTheme: (theme: Theme) => void
  setLocale: (locale: string) => void
  setTimeZone: (timeZone: string) => void
  setHourCycle: (hourCycle: HourCycle) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function deriveLanguage(locale: string): Language {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en"
}

function getDefaultLocale(): string {
  if (typeof window === "undefined") return "zh-CN"
  return navigator.language || "zh-CN"
}

const DEFAULT_SETTINGS: SettingsState = {
  language: "zh",
  theme: "system",
  locale: "zh-CN",
  timeZone: "auto",
  hourCycle: "auto",
}

function loadSettings(): SettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS

  const storedLocale = localStorage.getItem("locale")
  const storedLanguage = localStorage.getItem("language")
  const storedTheme = localStorage.getItem("theme")
  const storedTimeZone = localStorage.getItem("timeZone")
  const storedHourCycle = localStorage.getItem("hourCycle") as HourCycle | null

  const locale = storedLocale || getDefaultLocale()
  const language = storedLanguage === "zh" || storedLanguage === "en"
    ? storedLanguage
    : deriveLanguage(locale)

  return {
    language,
    theme:
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : storedTheme === "auto"
          ? "system"
          : "system",
    locale,
    timeZone: storedTimeZone || "auto",
    hourCycle: storedHourCycle === "h12" || storedHourCycle === "h23" ? storedHourCycle : "auto",
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const { setTheme: setNextTheme } = useTheme()
  const previousTheme = useRef<Theme>(DEFAULT_SETTINGS.theme)
  const skipNextTransition = useRef(true)

  useEffect(() => {
    const loaded = loadSettings()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loaded)
    setNextTheme(loaded.theme)
    previousTheme.current = loaded.theme
    skipNextTransition.current = true
  }, [setNextTheme])

  const persist = useCallback((next: SettingsState) => {
    localStorage.setItem("language", next.language)
    localStorage.setItem("theme", next.theme)
    localStorage.setItem("locale", next.locale)
    localStorage.setItem("timeZone", next.timeZone)
    localStorage.setItem("hourCycle", next.hourCycle)
  }, [])

  const updateSettings = useCallback(
    (partial: Partial<SettingsState>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial }
        if (partial.locale) {
          next.language = deriveLanguage(partial.locale)
        }
        if (partial.language) {
          next.locale = partial.language === "zh" ? "zh-CN" : "en-US"
        }
        persist(next)
        return next
      })
    },
    [persist]
  )

  useEffect(() => {
    if (skipNextTransition.current) {
      skipNextTransition.current = false
      return
    }
    const fromTheme = previousTheme.current
    previousTheme.current = settings.theme
    runThemeTransition(fromTheme, settings.theme, () => {
      setNextTheme(settings.theme)
    })
  }, [settings.theme, setNextTheme])

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      setLanguage: (language) => updateSettings({ language }),
      setTheme: (theme) => updateSettings({ theme }),
      setLocale: (locale) => updateSettings({ locale }),
      setTimeZone: (timeZone) => updateSettings({ timeZone }),
      setHourCycle: (hourCycle) => updateSettings({ hourCycle }),
    }),
    [settings, updateSettings]
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider")
  }
  return context
}
