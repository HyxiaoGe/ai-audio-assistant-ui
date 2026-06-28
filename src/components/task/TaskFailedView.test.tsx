import { fireEvent, render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TaskFailedView } from "./TaskFailedView"
import type { TaskDetail } from "@/types/api"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

const failedTask = {
  id: "t-failed",
  title: "坏掉的任务",
  status: "failed",
  error_message: "Submit task failed (HTTP 400): File too large!",
} as unknown as TaskDetail

function setup(overrides: Partial<React.ComponentProps<typeof TaskFailedView>> = {}) {
  const onBack = vi.fn()
  const onRetry = vi.fn()
  const onConfirmDelete = vi.fn()
  render(
    <TaskFailedView
      task={failedTask}
      onBack={onBack}
      onRetry={onRetry}
      isRetrying={false}
      onConfirmDelete={onConfirmDelete}
      isDeleting={false}
      {...overrides}
    />,
  )
  return { onBack, onRetry, onConfirmDelete }
}

describe("TaskFailedView", () => {
  it("失败态 header 渲染删除按钮,且面板有重试按钮", () => {
    setup()
    // 删除按钮(header):aria/文案用 common.delete
    expect(screen.getAllByText("common.delete").length).toBeGreaterThan(0)
    // 重试按钮(TaskFailedPanel):task.retryProcessing
    expect(screen.getByText("task.retryProcessing")).toBeInTheDocument()
  })

  it("点删除按钮打开确认弹窗,确认调 onConfirmDelete", () => {
    const { onConfirmDelete } = setup()
    // 打开前弹窗标题不在
    expect(screen.queryByText("task.deleteConfirmTitle")).not.toBeInTheDocument()
    // header 删除按钮是第一个 common.delete(弹窗确认按钮在打开后才出现)
    fireEvent.click(screen.getByText("common.delete"))
    // 弹窗打开
    expect(screen.getByText("task.deleteConfirmTitle")).toBeInTheDocument()
    // 弹窗确认按钮:destructive Button 文案 common.delete(此时有两个 common.delete,取最后一个=弹窗内)
    const deletes = screen.getAllByText("common.delete")
    fireEvent.click(deletes[deletes.length - 1])
    expect(onConfirmDelete).toHaveBeenCalledTimes(1)
  })

  it("点重试按钮调 onRetry", () => {
    const { onRetry } = setup()
    fireEvent.click(screen.getByText("task.retryProcessing"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("isRetrying / isDeleting 为 true 时对应按钮 disabled", () => {
    setup({ isRetrying: true, isDeleting: false })
    expect(screen.getByText("common.processing").closest("button")).toBeDisabled()
  })
})
