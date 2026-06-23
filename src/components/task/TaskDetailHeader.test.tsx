import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TaskDetailHeader } from "./TaskDetailHeader"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(" ")}` : key,
  }),
}))

describe("TaskDetailHeader", () => {
  it("渲染标题与返回按钮,点击返回触发 onBack", () => {
    const onBack = vi.fn()
    render(<TaskDetailHeader title="我的任务" onBack={onBack} />)
    expect(screen.getByText("我的任务")).toBeInTheDocument()
    fireEvent.click(screen.getByText("common.back"))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("渲染 right slot 内容", () => {
    render(<TaskDetailHeader title="t" onBack={() => {}} right={<span>动作区</span>} />)
    expect(screen.getByText("动作区")).toBeInTheDocument()
  })

  it("withBackground 为真时容器带玻璃态背景", () => {
    const { container } = render(<TaskDetailHeader title="t" onBack={() => {}} withBackground />)
    const bar = container.firstChild as HTMLElement
    expect(bar.style.background).toContain("--app-glass-bg")
  })

  it("withBackground 缺省时容器无背景", () => {
    const { container } = render(<TaskDetailHeader title="t" onBack={() => {}} />)
    const bar = container.firstChild as HTMLElement
    expect(bar.style.background).toBe("")
  })
})
