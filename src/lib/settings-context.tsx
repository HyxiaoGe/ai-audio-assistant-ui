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

interface SettingsActions {
  setLanguage: (language: Language) => void
  setTheme: (theme: Theme) => void
  setLocale: (locale: string) => void
  setTimeZone: (timeZone: string) => void
  setHourCycle: (hourCycle: HourCycle) => void
}

interface SettingsContextValue extends SettingsState, SettingsActions {}

// 状态与动作拆成两个 context：动作对象身份恒定（只依赖稳定的 updateSettings），
// 故只取动作的消费者（如 8 个页面只用 setTheme 给 Header 传主题切换回调）不会随
// 任一设置字段变化而重渲染。切主题/语言/时区的视觉效果本就走 CSS 变量（next-themes
// 切 <html> class），这些 React 重渲染纯属浪费——拆分后被彻底消除。
const SettingsStateContext = createContext<SettingsState | null>(null)
const SettingsActionsContext = createContext<SettingsActions | null>(null)

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

  // 动作只依赖 updateSettings（稳定），故身份恒定、跨设置变化不变——这是拆分省去无谓重渲染的关键。
  const actions = useMemo<SettingsActions>(
    () => ({
      setLanguage: (language) => updateSettings({ language }),
      setTheme: (theme) => updateSettings({ theme }),
      setLocale: (locale) => updateSettings({ locale }),
      setTimeZone: (timeZone) => updateSettings({ timeZone }),
      setHourCycle: (hourCycle) => updateSettings({ hourCycle }),
    }),
    [updateSettings]
  )

  return (
    <SettingsStateContext.Provider value={settings}>
      <SettingsActionsContext.Provider value={actions}>
        {children}
      </SettingsActionsContext.Provider>
    </SettingsStateContext.Provider>
  )
}

export function useSettingsState(): SettingsState {
  const context = useContext(SettingsStateContext)
  if (!context) {
    throw new Error("useSettingsState must be used within SettingsProvider")
  }
  return context
}

export function useSettingsActions(): SettingsActions {
  const context = useContext(SettingsActionsContext)
  if (!context) {
    throw new Error("useSettingsActions must be used within SettingsProvider")
  }
  return context
}

// 兼容入口：同时需要状态与动作的消费者（如 Settings 页）。订阅了状态 context，
// 故仍会随设置变化重渲染——这对需要读取设置值的组件是必要且正确的。
export function useSettings(): SettingsContextValue {
  const state = useSettingsState()
  const actions = useSettingsActions()
  return useMemo(() => ({ ...state, ...actions }), [state, actions])
}
