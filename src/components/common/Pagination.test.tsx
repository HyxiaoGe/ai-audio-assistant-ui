import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Pagination } from "./Pagination"

// audit a11y #29-#32：任务列表分页的「上一页/下一页」是只含 ChevronLeft/Right 图标的
// 按钮，无可访问名。TaskListAPI 与 TaskList 两处分页结构完全相同，抽成共享组件。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))

describe("Pagination a11y", () => {
  it("renders nothing when there is a single page", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("gives prev/next icon buttons accessible names and explicit type", () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />)
    const prev = screen.getByRole("button", { name: "pagination.previous" })
    const next = screen.getByRole("button", { name: "pagination.next" })
    expect(prev).toHaveAttribute("type", "button")
    expect(next).toHaveAttribute("type", "button")
  })

  it("disables prev on the first page and next on the last page", () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />
    )
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled()

    rerender(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled()
  })

  it("calls onPageChange for prev/next", () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
    fireEvent.click(screen.getByRole("button", { name: "pagination.next" }))
    expect(onPageChange).toHaveBeenLastCalledWith(4)
  })

  it("marks the active page with aria-current=page", () => {
    render(<Pagination currentPage={2} totalPages={3} onPageChange={vi.fn()} />)
    const active = screen.getByRole("button", { name: "2" })
    expect(active).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "1" })).not.toHaveAttribute("aria-current")
  })
})
