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
  overlay.classList.add("is-fading-in")

  let readyFired = false
  const fireReady = () => {
    if (readyFired) return
    readyFired = true
    onReady?.()
  }

  const fadeInTimer = window.setTimeout(() => {
    fireReady()
    overlay.classList.add("is-sweeping")
  }, 200)

  const fallbackTimeout = window.setTimeout(() => {
    window.clearTimeout(fadeInTimer)
    fireReady()
    overlay.remove()
  }, 1100)

  overlay.addEventListener(
    "animationend",
    () => {
      window.clearTimeout(fallbackTimeout)
      window.clearTimeout(fadeInTimer)
      overlay.remove()
    },
    { once: true }
  )
}
