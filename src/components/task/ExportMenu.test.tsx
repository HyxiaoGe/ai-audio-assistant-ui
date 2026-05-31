import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExportMenu } from "./ExportMenu"

// audit a11y #11/#12：导出下拉触发器原无 aria-haspopup/expanded/controls，
// 下拉容器无 role="menu"、子项无 role="menuitem"，且打开后既不能 Escape 关闭
// 也无外点关闭逻辑（连 mousedown 监听都没有）。

function items(onSelect = vi.fn()) {
  return [
    { key: "pdf", label: "PDF", onSelect },
    { key: "word", label: "Word" },
    { key: "md", label: "Markdown" },
  ]
}

describe("ExportMenu a11y", () => {
  it("exposes the trigger with popup semantics and starts collapsed", () => {
    render(<ExportMenu label="Export" items={items()} />)
    const trigger = screen.getByRole("button", { name: "Export" })
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("opens a role=menu with role=menuitem children", () => {
    render(<ExportMenu label="Export" items={items()} />)
    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(screen.getAllByRole("menuitem")).toHaveLength(3)
  })

  it("invokes the item's onSelect and closes on selection", () => {
    const onSelect = vi.fn()
    render(<ExportMenu label="Export" items={items(onSelect)} />)
    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "PDF" }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("closes on Escape and restores focus to the trigger", () => {
    render(<ExportMenu label="Export" items={items()} />)
    const trigger = screen.getByRole("button", { name: "Export" })
    fireEvent.click(trigger)
    expect(screen.getByRole("menu")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("closes on outside pointer-down", () => {
    render(
      <div>
        <ExportMenu label="Export" items={items()} />
        <button type="button">Outside</button>
      </div>
    )
    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    expect(screen.getByRole("menu")).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }))
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
})
