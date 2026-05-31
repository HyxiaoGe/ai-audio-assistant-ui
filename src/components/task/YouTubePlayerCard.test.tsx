import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { YouTubePlayerCard } from "./YouTubePlayerCard"
import type { YouTubeVideoInfo } from "@/types/api"

// audit a11y：YouTube 播放卡的三处无障碍缺口（sweep #1/#2/#6）。
// 进度条是裸 div（无 role/键盘）、播放/暂停按钮无可访问名、在 YouTube 打开的链接
// 文本在窄屏被 hidden。i18n mock 返回 key，故可访问名即 key。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))
vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({ formatRelativeTime: () => "1 day ago" }),
}))

const youtubeInfo = {
  video_id: "vid-123",
  channel_id: "chan-1",
  title: "Test Video",
  channel_title: "Test Channel",
  view_count: 10,
  like_count: 2,
  comment_count: 1,
  duration_seconds: 100,
} as unknown as YouTubeVideoInfo

describe("YouTubePlayerCard a11y", () => {
  it("exposes the progress bar as a keyboard-operable slider", () => {
    const onSeek = vi.fn()
    render(
      <YouTubePlayerCard youtubeInfo={youtubeInfo} currentTime={10} duration={100} onSeek={onSeek} />
    )

    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-label", "player.seek")
    expect(slider).toHaveAttribute("aria-valuemin", "0")
    expect(slider).toHaveAttribute("aria-valuemax", "100")
    expect(slider).toHaveAttribute("aria-valuenow", "10")

    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(onSeek).toHaveBeenLastCalledWith(15)
    fireEvent.keyDown(slider, { key: "Home" })
    expect(onSeek).toHaveBeenLastCalledWith(0)
  })

  it("gives the play/pause overlay button a state-reflecting accessible name", () => {
    const onPlayPause = vi.fn()
    const { rerender } = render(
      <YouTubePlayerCard youtubeInfo={youtubeInfo} duration={100} isPlaying={false} onPlayPause={onPlayPause} />
    )

    const playBtn = screen.getByRole("button", { name: "player.play" })
    fireEvent.click(playBtn)
    expect(onPlayPause).toHaveBeenCalled()

    rerender(
      <YouTubePlayerCard youtubeInfo={youtubeInfo} duration={100} isPlaying onPlayPause={onPlayPause} />
    )
    expect(screen.getByRole("button", { name: "player.pause" })).toBeInTheDocument()
  })

  it("gives the open-on-YouTube link a stable accessible name independent of the viewport-hidden text", () => {
    render(<YouTubePlayerCard youtubeInfo={youtubeInfo} duration={100} />)

    const link = screen.getByText("task.youtubeInfo.openOnYouTube").closest("a")
    expect(link).toHaveAttribute("aria-label", "task.youtubeInfo.openOnYouTube")
  })
})
