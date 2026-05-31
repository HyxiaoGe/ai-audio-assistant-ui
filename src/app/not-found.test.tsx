import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import NotFound from "./not-found"

// not-found.tsx 渲染在 root layout 的 Provider 树内（未匹配路由 / notFound()），可用 useI18n。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "zh" }),
}))

describe("app not-found boundary", () => {
  it("shows the 404 title and a link back home", () => {
    render(<NotFound />)
    expect(screen.getByText("errors.pageNotFoundTitle")).toBeInTheDocument()
    const home = screen.getByRole("link", { name: "errors.backHome" })
    expect(home).toHaveAttribute("href", "/")
  })
})
