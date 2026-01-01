import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import TaskCard from "@/components/task/TaskCard"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("TaskCard", () => {
  const baseProps = {
    id: "task-1",
    title: "Weekly Sync",
    duration: "12:34",
    timeAgo: "5 min ago",
    status: "processing" as const,
  }

  it("renders title and metadata", () => {
    render(<TaskCard {...baseProps} />)

    expect(screen.getByText("Weekly Sync")).toBeInTheDocument()
    expect(screen.getByText("12:34 · 5 min ago")).toBeInTheDocument()
  })

  it("calls onClick for click and Enter key", () => {
    const onClick = vi.fn()
    render(<TaskCard {...baseProps} onClick={onClick} />)

    const card = screen.getByRole("button")
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: "Enter" })

    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it("shows retry button and calls onRetry without bubbling", () => {
    const onClick = vi.fn()
    const onRetry = vi.fn()

    render(
      <TaskCard
        {...baseProps}
        status="failed"
        onClick={onClick}
        onRetry={onRetry}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})
