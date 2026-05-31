import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ActionItemToggle } from "./ActionItemToggle"

// audit a11y #34：待办项的完成开关原是只含 CheckSquare 图标（或空 div）的 <button>，
// 无可访问名、无 checkbox role/state，读屏既不知道它是什么也感知不到勾选状态。

describe("ActionItemToggle", () => {
  it("is a checkbox reflecting the completed state, named by the task", () => {
    render(<ActionItemToggle completed={false} label="Ship the report" onToggle={vi.fn()} />)
    const box = screen.getByRole("checkbox", { name: "Ship the report" })
    expect(box).toHaveAttribute("aria-checked", "false")
    expect(box).toHaveAttribute("type", "button")
  })

  it("announces aria-checked=true when completed", () => {
    render(<ActionItemToggle completed label="Ship the report" onToggle={vi.fn()} />)
    expect(screen.getByRole("checkbox", { name: "Ship the report" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("calls onToggle when activated", () => {
    const onToggle = vi.fn()
    render(<ActionItemToggle completed={false} label="Ship the report" onToggle={onToggle} />)
    fireEvent.click(screen.getByRole("checkbox", { name: "Ship the report" }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
