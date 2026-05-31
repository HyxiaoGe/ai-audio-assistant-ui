import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PlayerBar from "./PlayerBar"

// 进度条必须是真正的 slider：可聚焦、被读屏宣告、可用键盘 seek（audit #3 a11y）。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "zh" }),
}))

describe("PlayerBar seek slider a11y", () => {
  it("exposes the progress bar as a labelled slider with current/min/max", () => {
    render(<PlayerBar currentTime={10} duration={100} />)
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-label", "player.seek")
    expect(slider).toHaveAttribute("aria-valuemin", "0")
    expect(slider).toHaveAttribute("aria-valuemax", "100")
    expect(slider).toHaveAttribute("aria-valuenow", "10")
    expect(slider).toHaveAttribute("tabindex", "0")
  })

  it("seeks forward/back with Arrow keys and jumps with Home/End", () => {
    const onSeek = vi.fn()
    render(<PlayerBar currentTime={10} duration={100} onSeek={onSeek} />)
    const slider = screen.getByRole("slider")

    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(onSeek).toHaveBeenLastCalledWith(15)

    fireEvent.keyDown(slider, { key: "ArrowLeft" })
    expect(onSeek).toHaveBeenLastCalledWith(5)

    fireEvent.keyDown(slider, { key: "Home" })
    expect(onSeek).toHaveBeenLastCalledWith(0)

    fireEvent.keyDown(slider, { key: "End" })
    expect(onSeek).toHaveBeenLastCalledWith(100)
  })

  it("ignores non-seek keys so Tab/navigation still works", () => {
    const onSeek = vi.fn()
    render(<PlayerBar currentTime={10} duration={100} onSeek={onSeek} />)
    fireEvent.keyDown(screen.getByRole("slider"), { key: "Tab" })
    expect(onSeek).not.toHaveBeenCalled()
  })
})
