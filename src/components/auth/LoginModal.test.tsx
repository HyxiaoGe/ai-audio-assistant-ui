import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginModal from "./LoginModal"

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  completeEmailCodeLogin: vi.fn(),
  getCapabilities: vi.fn(),
  loginWithGitHub: vi.fn(),
  loginWithGoogle: vi.fn(),
  resend: vi.fn(),
  start: vi.fn(),
  verify: vi.fn(),
}))

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "zh" }),
}))

vi.mock("@/lib/auth-sdk", () => ({
  getEmailLoginCapabilities: mocks.getCapabilities,
}))

vi.mock("@/lib/auth/emailCodeAuth", () => ({
  cancelEmailCodeLogin: mocks.cancel,
  resendEmailCodeLogin: mocks.resend,
  startEmailCodeLogin: mocks.start,
  verifyEmailCodeLogin: mocks.verify,
}))

vi.mock("@/store/auth-store", () => ({
  loginWithGoogle: mocks.loginWithGoogle,
  loginWithGitHub: mocks.loginWithGitHub,
  useAuthStore: (
    selector: (state: { completeEmailCodeLogin: typeof mocks.completeEmailCodeLogin }) => unknown
  ) => selector({ completeEmailCodeLogin: mocks.completeEmailCodeLogin }),
}))

const challenge = {
  interactionToken: "interaction-1",
  maskedDestination: "u***@example.com",
  expiresInSeconds: 300,
  resendAfterSeconds: 0,
  codeLength: 6,
}

async function reachCodeEntry() {
  fireEvent.click(await screen.findByRole("button", { name: "auth.emailCodeLogin" }))
  fireEvent.change(screen.getByLabelText("auth.emailCode.emailLabel"), {
    target: { value: "user@example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: "auth.emailCode.send" }))
  return screen.findByLabelText("auth.emailCode.codeLabel")
}

describe("LoginModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCapabilities.mockResolvedValue({ headless: true })
    mocks.start.mockResolvedValue(challenge)
    mocks.resend.mockResolvedValue(challenge)
    mocks.verify.mockResolvedValue({
      status: "authenticated",
      user: { id: "user-1", email: "user@example.com", name: "Audio User" },
      redirectPath: "/tasks",
    })
  })

  it("关闭时不渲染对话框", () => {
    render(<LoginModal isOpen={false} onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("打开时提供可访问名称", () => {
    render(<LoginModal isOpen={true} onClose={() => {}} />)
    expect(screen.getByRole("dialog")).toHaveAccessibleName("auth.loginTitle")
  })

  it("Escape 和关闭按钮会关闭弹窗", () => {
    const onClose = vi.fn()
    render(<LoginModal isOpen={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it("协议区不包含 href 井号死链", () => {
    render(<LoginModal isOpen={true} onClose={() => {}} />)
    expect(document.body.querySelector('a[href="#"]')).toBeNull()
    expect(screen.getByText("auth.agreementLink")).toBeTruthy()
    expect(screen.getByText("auth.privacyPolicy")).toBeTruthy()
  })

  it("保留 Google 和 GitHub 登录入口及回跳路径", () => {
    render(<LoginModal isOpen={true} onClose={() => {}} callbackUrl="/settings" />)
    fireEvent.click(screen.getByRole("button", { name: "auth.loginWithGoogle" }))
    expect(mocks.loginWithGoogle).toHaveBeenCalledWith("/settings")
  })

  it("auth-service 未开放能力时隐藏邮箱入口", async () => {
    mocks.getCapabilities.mockResolvedValue({ headless: false })
    render(<LoginModal isOpen={true} onClose={() => {}} />)

    await waitFor(() => expect(mocks.getCapabilities).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("button", { name: "auth.emailCodeLogin" })).toBeNull()
    expect(screen.getByRole("button", { name: "auth.loginWithGoogle" })).toBeEnabled()
  })

  it("关闭后重新打开会回到登录方式页并清理邮箱草稿", async () => {
    const { rerender } = render(<LoginModal isOpen={true} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole("button", { name: "auth.emailCodeLogin" }))
    fireEvent.change(screen.getByLabelText("auth.emailCode.emailLabel"), {
      target: { value: "user@example.com" },
    })

    rerender(<LoginModal isOpen={false} onClose={() => {}} />)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    rerender(<LoginModal isOpen={true} onClose={() => {}} />)

    expect(await screen.findByRole("button", { name: "auth.emailCodeLogin" })).toBeEnabled()
    expect(screen.queryByLabelText("auth.emailCode.emailLabel")).toBeNull()
  })

  it("邮箱验证码成功后同步用户并调用独立成功回调", async () => {
    const onAuthenticated = vi.fn()
    render(
      <LoginModal
        isOpen={true}
        onClose={() => {}}
        onAuthenticated={onAuthenticated}
      />
    )
    const codeInput = await reachCodeEntry()
    fireEvent.change(codeInput, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "auth.emailCode.verify" }))

    await waitFor(() => {
      expect(mocks.completeEmailCodeLogin).toHaveBeenCalledWith({
        id: "user-1",
        email: "user@example.com",
        name: "Audio User",
      })
      expect(onAuthenticated).toHaveBeenCalledTimes(1)
    })
  })

  it("验证码已消费到换码完成期间禁止关闭弹窗", async () => {
    let resolveVerify: ((value: unknown) => void) | undefined
    mocks.verify.mockImplementation(() =>
      new Promise((resolve) => { resolveVerify = resolve })
    )
    const onClose = vi.fn()
    const onAuthenticated = vi.fn()
    render(
      <LoginModal
        isOpen={true}
        onClose={onClose}
        onAuthenticated={onAuthenticated}
      />
    )
    const codeInput = await reachCodeEntry()
    fireEvent.change(codeInput, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "auth.emailCode.verify" }))

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /close/i })).toBeNull()
    })
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      resolveVerify?.({
        status: "authenticated",
        user: { id: "user-1", email: "user@example.com", name: "Audio User" },
        redirectPath: "/tasks",
      })
    })
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
  })
})
