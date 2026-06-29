import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import { TaskStatusBadge } from "./TaskStatusBadge"

describe("TaskStatusBadge", () => {
  it("completed → 绿色 completed 变体 + i18n 文案", () => {
    render(<TaskStatusBadge status="completed" />)
    const el = screen.getByText("task.status.completed")
    expect(el.className).toContain("bg-[var(--app-success-bg)]")
  })

  it("failed → 红色 failed 变体", () => {
    render(<TaskStatusBadge status="failed" />)
    const el = screen.getByText("task.status.failed")
    expect(el.className).toContain("bg-[var(--app-danger-bg)]")
  })

  it("中间处理态(transcribing)归 processing 变体", () => {
    render(<TaskStatusBadge status="transcribing" />)
    const el = screen.getByText("task.status.transcribing")
    expect(el.className).toContain("bg-[var(--app-primary-soft)]")
  })

  it("pending/queued 归 pending 变体", () => {
    render(<TaskStatusBadge status="queued" />)
    const el = screen.getByText("task.status.queued")
    expect(el.className).toContain("bg-[var(--app-warning-bg)]")
  })

  it("未知状态回退 outline 变体", () => {
    render(<TaskStatusBadge status="weird_unknown" />)
    const el = screen.getByText("task.status.weird_unknown")
    expect(el.className).toContain("border")
  })
})
