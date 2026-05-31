import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ErrorBoundary from "./error"

// error.tsx 渲染在 root layout 的 Provider 树内，可用 useI18n；mock 返回 key 即可访问名。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "zh" }),
}))

describe("app error boundary", () => {
  beforeEach(() => {
    // error.tsx 会 console.error(error) 上报，测试里压掉噪音
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the error title and wires the retry button to reset()", () => {
    const reset = vi.fn()
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />)
    expect(screen.getByText("errors.unknownErrorTitle")).toBeInTheDocument()
    const retry = screen.getByRole("button", { name: "common.retry" })
    fireEvent.click(retry)
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("offers a full-page link back home", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={vi.fn()} />)
    const home = screen.getByRole("link", { name: "errors.backHome" })
    expect(home).toHaveAttribute("href", "/")
  })
})
