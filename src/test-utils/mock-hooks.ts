import { vi } from "vitest"

export const mockUseI18n = (
  overrides?: Partial<{ t: (key: string, vars?: Record<string, string | number>) => string }>
) => ({
  useI18n: () => ({
    t:
      overrides?.t ||
      ((key: string, vars?: Record<string, string | number>) =>
        vars?.count
          ? `${key}:${vars.count}`
          : vars?.minutes
            ? `${key}:${vars.minutes}`
            : key),
    locale: "en",
  }),
})

export const mockUseRouter = () => {
  const push = vi.fn()
  return {
    useRouter: () => ({ push }),
    push,
  }
}

export const mockUseDateFormatter = (
  value: string = "2 hours ago"
) => ({
  useDateFormatter: () => ({
    formatRelativeTime: () => value,
  }),
})
