import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProcessingState } from "@/components/task/ProcessingState"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("ProcessingState", () => {
  it("renders progress and stage label for processing status", () => {
    render(<ProcessingState status="extracting" progress={150} />)

    expect(screen.getAllByText("processingState.extracting").length).toBeGreaterThan(0)
    expect(screen.getByText("100%")).toBeInTheDocument()
  })

  it("returns null when status is not processing", () => {
    const { container } = render(
      <ProcessingState status="completed" progress={100} />
    )

    expect(container.firstChild).toBeNull()
  })
})
