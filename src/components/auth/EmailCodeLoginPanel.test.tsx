import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Dialog, DialogContent } from "@/components/ui/dialog"

import {
  EmailCodeLoginPanel,
  type EmailCodeLoginPanelProps,
} from "./EmailCodeLoginPanel"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "zh",
    t: (key: string, vars?: Record<string, string | number>) => {
      const messages: Record<string, string> = {
        "auth.emailCode.backToMethods": "返回其他登录方式",
        "auth.emailCode.title": "邮箱验证码登录",
        "auth.emailCode.description": "输入邮箱地址，首次使用将自动创建账户。",
        "auth.emailCode.emailLabel": "邮箱地址",
        "auth.emailCode.emailPlaceholder": "name@example.com",
        "auth.emailCode.send": "发送验证码",
        "auth.emailCode.sending": "正在发送...",
        "auth.emailCode.changeEmail": "更换邮箱",
        "auth.emailCode.codeTitle": "输入邮箱验证码",
        "auth.emailCode.codeDescription": "验证码已发送至 {email}",
        "auth.emailCode.codeLabel": "验证码",
        "auth.emailCode.codePlaceholder": "输入 {count} 位验证码",
        "auth.emailCode.verify": "验证并登录",
        "auth.emailCode.verifying": "正在验证...",
        "auth.emailCode.resend": "重新发送验证码",
        "auth.emailCode.resending": "正在重新发送...",
        "auth.emailCode.resendCountdown": "{seconds} 秒后可重新发送",
        "auth.emailCode.retryCountdown": "{seconds} 秒后重试",
        "auth.emailCode.codeExpiresIn": "验证码将在 {seconds} 秒后过期",
        "auth.emailCode.codeResent": "新的验证码已发送",
        "auth.emailCode.errors.invalid_email": "请输入有效的邮箱地址",
        "auth.emailCode.errors.invalid_code": "验证码不正确，请重新输入",
        "auth.emailCode.errors.code_expired": "验证码已过期，请重新发送",
        "auth.emailCode.errors.rate_limited": "请求过于频繁，请在 {seconds} 秒后重试",
      }
      return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
        String(vars?.[name] ?? `{${name}}`)
      )
    },
  }),
}))

const challenge = {
  interactionToken: "interaction-1",
  maskedDestination: "u***@example.com",
  expiresInSeconds: 300,
  resendAfterSeconds: 60,
  codeLength: 6,
}

function createProps(overrides: Partial<EmailCodeLoginPanelProps> = {}): EmailCodeLoginPanelProps {
  return {
    active: true,
    start: vi.fn(async () => challenge),
    resend: vi.fn(async () => ({ ...challenge, interactionToken: "interaction-2" })),
    verify: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    onBackToMethods: vi.fn(),
    onAuthenticated: vi.fn(),
    onCriticalOperationChange: vi.fn(),
    ...overrides,
  }
}

function PanelHarness(props: EmailCodeLoginPanelProps) {
  return (
    <Dialog open>
      <DialogContent>
        <EmailCodeLoginPanel {...props} />
      </DialogContent>
    </Dialog>
  )
}

async function reachCodeEntry(props: EmailCodeLoginPanelProps) {
  render(<PanelHarness {...props} />)
  fireEvent.change(screen.getByLabelText("邮箱地址"), {
    target: { value: " user@example.com " },
  })
  fireEvent.click(screen.getByRole("button", { name: "发送验证码" }))
  return screen.findByLabelText("验证码")
}

describe("EmailCodeLoginPanel", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it("无效邮箱显示行内错误且不发请求", () => {
    const props = createProps()
    render(<PanelHarness {...props} />)
    const input = screen.getByLabelText("邮箱地址")
    fireEvent.change(input, { target: { value: "invalid" } })
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }))

    expect(props.start).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("请输入有效的邮箱地址")
    expect(input).toHaveFocus()
  })

  it("发送时使用 trim 后邮箱，成功后只展示脱敏地址", async () => {
    const props = createProps()
    await reachCodeEntry(props)

    expect(props.start).toHaveBeenCalledWith({
      email: "user@example.com",
      signal: expect.any(AbortSignal),
    })
    expect(screen.getByText("验证码已发送至 u***@example.com")).toBeInTheDocument()
    expect(screen.queryByText("user@example.com")).toBeNull()
  })

  it("验证码只保留数字，达到服务端长度后才允许登录", async () => {
    const props = createProps()
    const input = await reachCodeEntry(props)
    expect(input).toHaveAttribute("autocomplete", "one-time-code")
    expect(input).toHaveAttribute("maxlength", "6")

    fireEvent.change(input, { target: { value: "12a34 56" } })
    expect(input).toHaveValue("123456")
    fireEvent.click(screen.getByRole("button", { name: "验证并登录" }))

    await waitFor(() => {
      expect(props.verify).toHaveBeenCalledWith({
        interactionToken: "interaction-1",
        verificationCode: "123456",
        signal: expect.any(AbortSignal),
      })
      expect(props.onAuthenticated).toHaveBeenCalledTimes(1)
    })
  })

  it("验证码错误时清空输入并恢复焦点", async () => {
    const props = createProps({
      verify: vi.fn(async () => { throw { code: "invalid_code" } }),
    })
    const input = await reachCodeEntry(props)
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "验证并登录" }))

    await waitFor(() => {
      expect(input).toHaveValue("")
      expect(input).toHaveFocus()
      expect(screen.getByRole("alert")).toHaveTextContent("验证码不正确，请重新输入")
    })
  })

  it("重发严格遵守冷却并轮换 interaction", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"))
    const props = createProps({
      start: vi.fn(async () => ({ ...challenge, resendAfterSeconds: 2 })),
    })
    render(<PanelHarness {...props} />)
    fireEvent.change(screen.getByLabelText("邮箱地址"), { target: { value: "user@example.com" } })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "发送验证码" }))
      await Promise.resolve()
    })
    expect(screen.getByRole("button", { name: "2 秒后可重新发送" })).toBeDisabled()

    await act(async () => vi.advanceTimersByTime(2_000))
    fireEvent.click(screen.getByRole("button", { name: "重新发送验证码" }))
    await act(async () => Promise.resolve())

    expect(props.resend).toHaveBeenCalledWith({
      interactionToken: "interaction-1",
      signal: expect.any(AbortSignal),
    })
    expect(screen.getByRole("status")).toHaveTextContent("新的验证码已发送")
  })

  it("限流提示按 retryAfterSeconds 倒计时后自动解除", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"))
    const props = createProps({
      start: vi.fn(async () => { throw { code: "rate_limited", retryAfterSeconds: 2 } }),
    })
    render(<PanelHarness {...props} />)
    fireEvent.change(screen.getByLabelText("邮箱地址"), { target: { value: "user@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }))
    await act(async () => Promise.resolve())

    expect(screen.getByRole("alert")).toHaveTextContent("请求过于频繁，请在 2 秒后重试")
    expect(screen.getByRole("button", { name: "2 秒后重试" })).toBeDisabled()
    await act(async () => vi.advanceTimersByTime(2_000))
    expect(screen.getByRole("button", { name: "发送验证码" })).toBeEnabled()
  })

  it("关闭会中止在途请求并取消迟到事务", async () => {
    let resolveStart: ((value: typeof challenge) => void) | undefined
    let observedSignal: AbortSignal | undefined
    const start = vi.fn(({ signal }: { signal: AbortSignal }) => {
      observedSignal = signal
      return new Promise<typeof challenge>((resolve) => { resolveStart = resolve })
    })
    const props = createProps({ start })
    const { rerender } = render(<PanelHarness {...props} />)
    fireEvent.change(screen.getByLabelText("邮箱地址"), { target: { value: "user@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }))

    rerender(<PanelHarness {...props} active={false} />)
    expect(observedSignal?.aborted).toBe(true)
    expect(props.cancel).toHaveBeenCalledWith({ interactionToken: null })
    await act(async () => resolveStart?.(challenge))
    expect(props.cancel).toHaveBeenCalledWith({ interactionToken: "interaction-1" })
  })
})
