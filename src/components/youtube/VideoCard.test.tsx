import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import VideoCard from "./VideoCard"
import type { YouTubeVideoItem } from "@/types/api"

// audit a11y #26/#42：悬停遮罩上的「在 YouTube 打开」按钮只有 title，没有 aria-label，
// 内部 ExternalLink 图标未 aria-hidden。title 作为可访问名优先级最低、不被所有 AT 可靠暴露。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const video = {
  video_id: "v1",
  title: "My Video",
  transcribed: false,
} as unknown as YouTubeVideoItem

describe("VideoCard a11y", () => {
  it("gives the open-on-YouTube overlay button an explicit aria-label and type", () => {
    render(<VideoCard video={video} />)
    const btn = screen.getByRole("button", { name: "subscriptions.openOnYouTube" })
    expect(btn).toHaveAttribute("aria-label", "subscriptions.openOnYouTube")
    expect(btn).toHaveAttribute("type", "button")
  })
})
