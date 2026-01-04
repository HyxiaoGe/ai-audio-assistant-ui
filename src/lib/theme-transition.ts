"use client"

type Theme = "light" | "dark" | "system"

function resolveTheme(target: Theme): "light" | "dark" {
  if (target === "system") {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return target
}

export function runThemeTransition(
  fromTheme: Theme,
  toTheme: Theme,
  onReady?: () => void
) {
  if (typeof document === "undefined") {
    onReady?.()
    return
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onReady?.()
    return
  }

  const existing = document.querySelector(".theme-transition-overlay")
  if (existing) {
    existing.remove()
  }

  const resolvedFrom = resolveTheme(fromTheme)
  const overlay = document.createElement("div")
  overlay.className = "theme-transition-overlay"
  overlay.style.background =
    resolvedFrom === "dark"
      ? "var(--app-page-gradient-dark)"
      : "var(--app-page-gradient-light)"

  document.body.appendChild(overlay)
  overlay.getBoundingClientRect()

  let readyFired = false
  const fireReady = () => {
    if (readyFired) return
    readyFired = true
    onReady?.()
  }

  requestAnimationFrame(() => {
    fireReady()
    overlay.classList.add("is-sweeping")
  })

  const fallbackTimeout = window.setTimeout(() => {
    fireReady()
    overlay.remove()
  }, 500)

  overlay.addEventListener(
    "animationend",
    () => {
      window.clearTimeout(fallbackTimeout)
      overlay.remove()
    },
    { once: true }
  )
}
