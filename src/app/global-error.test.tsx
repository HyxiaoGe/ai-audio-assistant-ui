import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import GlobalError from "./global-error"

// global-error.tsx 替换整个 root layout（自带 html/body），在 Provider 树之外 ——
// 不能用 useI18n，故文案双语硬编码。它会渲染 <html>，jsdom 里嵌在容器 div 中会触发
// React 的 DOM 嵌套告警，测试里压掉 console.error 噪音；仍验证 reset 接线这一真实行为。
describe("global error boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders a self-contained retry button wired to reset()", () => {
    const reset = vi.fn()
    render(<GlobalError error={new Error("fatal")} reset={reset} />)
    const retry = screen.getByRole("button", { name: /重试|retry/i })
    fireEvent.click(retry)
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
