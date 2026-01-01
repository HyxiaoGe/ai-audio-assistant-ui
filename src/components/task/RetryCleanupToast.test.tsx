import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import RetryCleanupToast from "@/components/task/RetryCleanupToast"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      vars?.count ? `${key}:${vars.count}` : key,
  }),
}))

describe("RetryCleanupToast", () => {
  it("returns null when failedCount is 0", () => {
    const { container } = render(
      <RetryCleanupToast
        failedCount={0}
        isCleaning={false}
        onCleanup={() => {}}
        onDismiss={() => {}}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it("calls cleanup and dismiss handlers", () => {
    const onCleanup = vi.fn()
    const onDismiss = vi.fn()

    render(
      <RetryCleanupToast
        failedCount={2}
        isCleaning={false}
        onCleanup={onCleanup}
        onDismiss={onDismiss}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "task.cleanupNow" }))
    fireEvent.click(screen.getAllByRole("button", { name: "common.dismiss" })[0])

    expect(onCleanup).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
