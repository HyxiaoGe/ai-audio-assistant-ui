import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskDetailHeader } from "@/components/task/TaskDetailHeader"
import type { TaskDetail } from "@/types/api"
const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({
    formatRelativeTime: () => "2 hours ago",
  }),
}))

const baseTask: TaskDetail = {
  id: "task-1",
  title: "Meeting",
  status: "completed",
  source_type: "upload",
  source_url: undefined,
  language: "zh",
  duration_seconds: 360,
  progress: 100,
  error_message: undefined,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe("TaskDetailHeader", () => {
  it("renders metadata and status", () => {
    render(<TaskDetailHeader task={baseTask} />)

    expect(screen.getByText("Meeting")).toBeInTheDocument()
    expect(screen.getByText("task.status.completed")).toBeInTheDocument()
    expect(screen.getByText("task.createdAt 2 hours ago")).toBeInTheDocument()
    expect(screen.getByText("task.duration 6:00")).toBeInTheDocument()
    expect(screen.getByText("task.language: task.languageZh")).toBeInTheDocument()
  })

  it("navigates back to task list", () => {
    render(<TaskDetailHeader task={baseTask} />)

    fireEvent.click(screen.getByRole("button", { name: "task.actions.backToList" }))
    expect(push).toHaveBeenCalledWith("/tasks")
  })
})
