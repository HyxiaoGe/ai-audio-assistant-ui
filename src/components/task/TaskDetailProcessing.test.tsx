import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskDetailProcessing } from "@/components/task/TaskDetailProcessing"
import type { Task } from "@/types"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      vars?.minutes ? `${key}:${vars.minutes}` : key,
  }),
}))

vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({
    formatRelativeTime: () => "1 hour ago",
  }),
}))

const baseTask: Task = {
  id: "task-1",
  title: "Processing Task",
  duration: 120,
  status: "processing",
  createdAt: new Date(),
  updatedAt: new Date(),
  fileType: "audio",
  fileSize: 1048576,
  progress: 40,
}

describe("TaskDetailProcessing", () => {
  it("renders task info and progress", () => {
    render(<TaskDetailProcessing task={baseTask} />)

    expect(screen.getByText("Processing Task")).toBeInTheDocument()
    expect(screen.getByText("task.processingProgress")).toBeInTheDocument()
    expect(screen.getByText("40%")).toBeInTheDocument()
    expect(screen.getByText("task.eta:5")).toBeInTheDocument()
  })
})
