import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import type { TaskDetail } from "@/types/api"
import { TaskFailedPanel } from "./TaskFailedPanel"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(" ")}` : key,
  }),
}))

describe("TaskFailedPanel", () => {
  const baseTask = { error_message: "网络错误" } as unknown as TaskDetail

  it("渲染失败标题与错误信息,点击重试触发 onRetry", () => {
    const onRetry = vi.fn()
    render(<TaskFailedPanel task={baseTask} onRetry={onRetry} isRetrying={false} />)
    expect(screen.getByText("task.error.processingFailed")).toBeInTheDocument()
    expect(screen.getByText("网络错误")).toBeInTheDocument()
    fireEvent.click(screen.getByText("task.retryProcessing"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("isRetrying 时按钮禁用且文案为处理中", () => {
    render(<TaskFailedPanel task={baseTask} onRetry={() => {}} isRetrying />)
    const btn = screen.getByText("common.processing")
    expect(btn).toBeDisabled()
  })

  it("无 error_message 时回退默认文案", () => {
    render(<TaskFailedPanel task={{} as unknown as TaskDetail} onRetry={() => {}} isRetrying={false} />)
    expect(screen.getByText("task.error.transcribeUnavailable")).toBeInTheDocument()
  })
})
