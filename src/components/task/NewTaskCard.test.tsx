import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import NewTaskCard from "@/components/task/NewTaskCard"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("NewTaskCard", () => {
  it("renders label and triggers onClick", () => {
    const onClick = vi.fn()
    render(<NewTaskCard onClick={onClick} />)

    fireEvent.click(screen.getByRole("button", { name: "task.newTask" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
