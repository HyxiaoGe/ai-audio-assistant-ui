import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import ProcessingState from "@/components/common/ProcessingState"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("ProcessingState (common)", () => {
  it("renders default step labels when no status is provided", () => {
    render(<ProcessingState progress={5} />)

    expect(screen.getByText("processingState.pending")).toBeInTheDocument()
    expect(screen.getByText("processingState.transcribing")).toBeInTheDocument()
    expect(screen.getByText("processingState.summarizing")).toBeInTheDocument()
  })
})
