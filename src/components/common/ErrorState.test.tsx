import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import ErrorState from "@/components/common/ErrorState"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

describe("ErrorState 图标用 lucide 而非 emoji", () => {
  it("network 类型:无 ❌ emoji,渲染 lucide svg", () => {
    const { container } = render(<ErrorState type="network" />)
    expect(screen.queryByText("❌")).toBeNull()
    expect(container.querySelector("svg.lucide")).not.toBeNull()
  })

  it("processing 类型:无 ⚠️ emoji,渲染 lucide svg", () => {
    const { container } = render(<ErrorState type="processing" />)
    expect(screen.queryByText("⚠️")).toBeNull()
    expect(container.querySelector("svg.lucide")).not.toBeNull()
  })
})
