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

// audit a11y：主播放/暂停按钮原为图标按钮，无可访问名、无 type（WCAG 4.1.2）。
describe("PlayerBar play/pause button a11y", () => {
  it("has a state-reflecting accessible name and an explicit button type", () => {
    const onPlayPause = vi.fn()
    const { rerender } = render(
      <PlayerBar duration={100} isPlaying={false} onPlayPause={onPlayPause} />
    )

    const playBtn = screen.getByRole("button", { name: "player.play" })
    expect(playBtn).toHaveAttribute("type", "button")
    fireEvent.click(playBtn)
    expect(onPlayPause).toHaveBeenCalled()

    rerender(<PlayerBar duration={100} isPlaying onPlayPause={onPlayPause} />)
    expect(screen.getByRole("button", { name: "player.pause" })).toBeInTheDocument()
  })
})

// audit a11y：metadata 加载前 duration 可能是 0 / NaN / Infinity；slider 的
// aria-valuemax/valuenow 直接取 duration 会被读屏宣告成 'NaN'/'Infinity'，
// 且 valuenow 可能 > valuemax。修复后须 clamp 到合法区间。
describe("PlayerBar slider bounds guard", () => {
  it("clamps aria bounds when duration is NaN (pre-metadata)", () => {
    render(<PlayerBar currentTime={10} duration={NaN} />)
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-valuemax", "0")
    expect(slider).toHaveAttribute("aria-valuenow", "0")
  })

  it("clamps aria bounds when duration is Infinity (streaming)", () => {
    render(<PlayerBar currentTime={50} duration={Infinity} />)
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-valuemax", "0")
    expect(slider).toHaveAttribute("aria-valuenow", "0")
  })

  it("never lets aria-valuenow exceed aria-valuemax", () => {
    render(<PlayerBar currentTime={999} duration={100} />)
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-valuemax", "100")
    expect(slider).toHaveAttribute("aria-valuenow", "100")
  })
})
