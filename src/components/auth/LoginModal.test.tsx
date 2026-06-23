import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import LoginModal from "./LoginModal"

// audit #2：登录模态此前是手搓 overlay，无 role=dialog / 焦点陷阱 / Esc 关闭。
// 改用 Radix Dialog 后这些必须成立。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "zh" }),
}))
vi.mock("@/store/auth-store", () => ({
  loginWithGoogle: vi.fn(),
  loginWithGitHub: vi.fn(),
}))

describe("LoginModal a11y", () => {
  it("renders nothing when closed", () => {
    render(<LoginModal isOpen={false} onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("exposes an accessible, labelled dialog when open", () => {
    render(<LoginModal isOpen={true} onClose={() => {}} />)
    const dialog = screen.getByRole("dialog")
    // 有可访问名称（来自 DialogTitle），读屏才能宣告这是什么对话框
    expect(dialog).toHaveAccessibleName()
  })

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn()
    render(<LoginModal isOpen={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })

  it("calls onClose when the close button is activated", () => {
    const onClose = vi.fn()
    render(<LoginModal isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it("协议区不含 href=\"#\" 死链(条款/隐私渲染为纯文本)", () => {
    render(<LoginModal isOpen={true} onClose={() => {}} />)
    // Radix Dialog 将内容渲染到 document.body Portal，需用 document.body 查询
    expect(document.body.querySelector('a[href="#"]')).toBeNull()
    // 文案仍在
    expect(screen.getByText("auth.agreementLink")).toBeTruthy()
    expect(screen.getByText("auth.privacyPolicy")).toBeTruthy()
  })
})
