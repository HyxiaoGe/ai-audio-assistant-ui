import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { StatusFilter } from "@/components/task/StatusFilter"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("StatusFilter", () => {
  const counts = {
    all: 10,
    pending: 2,
    extracting: 1,
    transcribing: 1,
    summarizing: 1,
    completed: 4,
    failed: 1,
  }

  it("renders simplified statuses with aggregated processing count", () => {
    render(<StatusFilter value="all" onChange={() => {}} counts={counts} />)

    expect(screen.getByText("tasks.filterAll (10)")).toBeInTheDocument()
    expect(screen.getByText("tasks.filterProcessing (5)")).toBeInTheDocument()
    expect(screen.getByText("tasks.filterCompleted (4)")).toBeInTheDocument()
    expect(screen.getByText("tasks.filterFailed (1)")).toBeInTheDocument()
  })

  it("maps processing click to pending status", () => {
    const onChange = vi.fn()
    render(<StatusFilter value="all" onChange={onChange} counts={counts} />)

    fireEvent.click(screen.getByText("tasks.filterProcessing (5)"))
    expect(onChange).toHaveBeenCalledWith("pending")
  })

  it("marks processing as active when a processing sub-status is selected", () => {
    render(<StatusFilter value="transcribing" onChange={() => {}} counts={counts} />)

    const processing = screen.getByText("tasks.filterProcessing (5)")
    expect(processing).toHaveAttribute("data-active", "true")
  })
})
