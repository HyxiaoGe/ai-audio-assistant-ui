import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Loading from "./loading"

// loading.tsx 是 (main) 段的 Suspense 兜底，渲染在 Provider 树内，可用 useI18n。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "zh" }),
}))

describe("(main) loading fallback", () => {
  it("exposes an accessible loading status", () => {
    render(<Loading />)
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-label", "common.loading")
  })
})
