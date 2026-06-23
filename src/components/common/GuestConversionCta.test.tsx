import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import GuestConversionCta from "@/components/common/GuestConversionCta"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

describe("GuestConversionCta", () => {
  it("渲染标题/副标/按钮,点击按钮调用 onLogin", () => {
    const onLogin = vi.fn()
    render(<GuestConversionCta onLogin={onLogin} />)
    expect(screen.getByText("explore.guestCtaTitle")).toBeInTheDocument()
    expect(screen.getByText("explore.guestCtaSubtitle")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "explore.guestCtaButton" }))
    expect(onLogin).toHaveBeenCalledTimes(1)
  })
})
