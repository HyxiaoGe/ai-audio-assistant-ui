import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { DeleteTaskDialog } from "./DeleteTaskDialog"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(" ")}` : key,
  }),
}))

describe("DeleteTaskDialog", () => {
  it("打开时渲染确认文案与标题块", () => {
    render(<DeleteTaskDialog open isDeleting={false} onClose={() => {}} onConfirm={() => {}} title="待删任务" />)
    expect(screen.getByText("task.deleteConfirmTitle")).toBeInTheDocument()
    expect(screen.getByText("待删任务")).toBeInTheDocument()
  })

  it("点击删除按钮触发 onConfirm", () => {
    const onConfirm = vi.fn()
    render(<DeleteTaskDialog open isDeleting={false} onClose={() => {}} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText("common.delete"))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("isDeleting 时两个按钮禁用、删除文案为处理中", () => {
    render(<DeleteTaskDialog open isDeleting onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.getByText("common.cancel")).toBeDisabled()
    expect(screen.getByText("task.deleteProcessing")).toBeDisabled()
  })
})
