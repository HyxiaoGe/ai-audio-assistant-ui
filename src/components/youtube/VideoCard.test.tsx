import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import VideoCard from "./VideoCard"
import type { YouTubeVideoItem } from "@/types/api"

// audit a11y #26/#42：悬停遮罩上的「在 YouTube 打开」按钮只有 title，没有 aria-label，
// 内部 ExternalLink 图标未 aria-hidden。title 作为可访问名优先级最低、不被所有 AT 可靠暴露。

// 提升 pushMock 为模块级变量，方便在测试中断言是否被调用
const pushMock = vi.fn()

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

// audit perf #18：缩略图与频道头像原本是裸 <img>，无懒加载，首屏列表会同时拉取全部图片。
// 改用 next/image 后浏览器原生懒加载（loading="lazy"），src/alt 保持不变（unoptimized 透传）。
const videoWithThumb = {
  video_id: "v1",
  title: "My Video",
  transcribed: false,
  thumbnail_url: "https://i.ytimg.com/vi/v1/hqdefault.jpg",
} as unknown as YouTubeVideoItem

describe("VideoCard images", () => {
  it("lazy-loads the video thumbnail and preserves its src/alt", () => {
    render(<VideoCard video={videoWithThumb} />)
    const thumb = screen.getByAltText("My Video")
    expect(thumb).toHaveAttribute("loading", "lazy")
    expect(thumb).toHaveAttribute("src", "https://i.ytimg.com/vi/v1/hqdefault.jpg")
  })

  it("lazy-loads the channel avatar and preserves its src", () => {
    const { container } = render(
      <VideoCard
        video={videoWithThumb}
        showChannel
        channelTitle="Chan"
        channelThumbnail="https://yt3.ggpht.com/abc"
      />
    )
    const avatar = container.querySelector('img[src="https://yt3.ggpht.com/abc"]')
    expect(avatar).not.toBeNull()
    expect(avatar).toHaveAttribute("loading", "lazy")
  })
})

// 三态测试：区分 未转 / 自己已转 / 别人已公开
describe("VideoCard 三态按钮", () => {
  beforeEach(() => {
    pushMock.mockClear()
  })

  it("①未转态 → 渲染「转写」按钮，点击触发 onTranscribe", async () => {
    const onTranscribe = vi.fn()
    const untranscribed = {
      video_id: "v1",
      title: "My Video",
      transcribed: false,
    } as unknown as YouTubeVideoItem

    render(<VideoCard video={untranscribed} onTranscribe={onTranscribe} />)

    // 应渲染「转写」按钮 key
    expect(screen.getByText("subscriptions.transcribeButton")).toBeTruthy()
    // 不应有「查看任务」或「查看公开转写」
    expect(screen.queryByText("subscriptions.viewTask")).toBeNull()
    expect(screen.queryByText("discover.existingPublicView")).toBeNull()

    await userEvent.click(screen.getByText("subscriptions.transcribeButton"))
    expect(onTranscribe).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=v1",
      "v1"
    )
  })

  it("②自己已转态(existing_is_owner 未设 + transcribed+task_id) → 渲染「查看任务」，点击 push 到 /tasks/<id>", async () => {
    const ownerVideo = {
      video_id: "v2",
      title: "Owner Video",
      transcribed: true,
      task_id: "task-abc",
      // existing_is_owner 未设 → undefined → 走 owner 分支
    } as unknown as YouTubeVideoItem

    render(<VideoCard video={ownerVideo} />)

    expect(screen.getByText("subscriptions.viewTask")).toBeTruthy()
    expect(screen.queryByText("discover.existingPublicView")).toBeNull()
    expect(screen.queryByText("discover.transcribeAnyway")).toBeNull()

    await userEvent.click(screen.getByText("subscriptions.viewTask"))
    expect(pushMock).toHaveBeenCalledWith("/tasks/task-abc")
  })

  it("③别人已公开态(existing_is_owner=false) → 同时渲染「已有公开转写·查看」与「仍要转写」", async () => {
    const onTranscribe = vi.fn()
    const otherPublicVideo = {
      video_id: "v3",
      title: "Other Public Video",
      transcribed: true,
      task_id: "task-xyz",
      existing_is_owner: false,
    } as unknown as YouTubeVideoItem

    render(<VideoCard video={otherPublicVideo} onTranscribe={onTranscribe} />)

    // 两个按钮都应出现
    expect(screen.getByText("discover.existingPublicView")).toBeTruthy()
    expect(screen.getByText("discover.transcribeAnyway")).toBeTruthy()
    // 不应有「查看任务」的旧文案
    expect(screen.queryByText("subscriptions.viewTask")).toBeNull()

    // 点「已有公开转写·查看」→ push 到公开详情 /explore/task-xyz(非 owner 不走 owner-gated /tasks/)
    await userEvent.click(screen.getByText("discover.existingPublicView"))
    expect(pushMock).toHaveBeenCalledWith("/explore/task-xyz")

    // 点「仍要转写」→ 触发 onTranscribe
    await userEvent.click(screen.getByText("discover.transcribeAnyway"))
    expect(onTranscribe).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=v3",
      "v3"
    )
  })
})
