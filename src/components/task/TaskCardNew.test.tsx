import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskCardNew } from "@/components/task/TaskCardNew"
import type { TaskListItem } from "@/types/api"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({
    formatRelativeTime: () => "5 min ago",
  }),
}))

const baseTask: TaskListItem = {
  id: "task-1",
  title: "New Task",
  source_type: "upload",
  status: "processing",
  progress: 42,
  duration_seconds: 120,
  error_message: undefined,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe("TaskCardNew", () => {
  it("renders title, progress, and status badge", () => {
    render(<TaskCardNew task={baseTask} />)

    expect(screen.getByText("New Task")).toBeInTheDocument()
    expect(screen.getByText("task.processingProgress")).toBeInTheDocument()
    expect(screen.getByText("42%")).toBeInTheDocument()
    expect(screen.getByText("task.status.processing")).toBeInTheDocument()
  })

  it("calls onClick and onRetry with failure state", () => {
    const onClick = vi.fn()
    const onRetry = vi.fn()
    const failedTask = { ...baseTask, status: "failed" as const, error_message: "Oops" }

    render(
      <TaskCardNew task={failedTask} onClick={onClick} onRetry={onRetry} />
    )

    const card = screen.getByText("New Task").closest('[role="button"]') as HTMLElement

    fireEvent.click(card)
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
