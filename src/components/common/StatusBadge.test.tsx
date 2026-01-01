import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusBadge } from "@/components/common/StatusBadge"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("StatusBadge", () => {
  it("renders completed label", () => {
    render(<StatusBadge status="completed" />)
    expect(screen.getByText("task.status.completed")).toBeInTheDocument()
  })

  it("renders failed label", () => {
    render(<StatusBadge status="failed" />)
    expect(screen.getByText("task.status.failed")).toBeInTheDocument()
  })
})
