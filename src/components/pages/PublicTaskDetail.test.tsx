import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useState, useEffect, type ComponentType } from "react"

import { ApiError } from "@/types/api"
import type { PublicSummaryResponse, PublicTaskDetail as PublicTaskDetailData } from "@/types/api"

const mockClient = vi.hoisted(() => ({
  getPublicTask: vi.fn(),
  getPublicTranscript: vi.fn(),
  getPublicSummary: vi.fn(),
}))

const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
// useDateFormatter 依赖 settings-context provider;公开页只在 YouTube 卡有 published_at 时才用它,
// 这里桩掉避免在测试里搭 provider。
vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => String(v),
    formatDateTime: (v: unknown) => String(v),
    formatRelativeTime: (v: unknown) => String(v),
  }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "t1" }),
}))
vi.mock("@/components/layout/Header", () => ({ default: () => null }))
vi.mock("@/components/layout/Sidebar", () => ({ default: () => null }))
// MarkdownContent 走 next/dynamic 惰性加载。
// 同 TaskDetail.progressive.test 教训:需同时 mock next/dynamic(同步解析 loader)
// + mock MarkdownContent 模块(返回纯文本桩),两者配合才能在 waitFor 内同步拿到渲染结果。
vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<ComponentType<Record<string, unknown>> | { default: ComponentType<Record<string, unknown>> }>
  ) => {
    function DynamicStub(props: Record<string, unknown>) {
      const [Comp, setComp] = useState<ComponentType<Record<string, unknown>> | null>(null)
      useEffect(() => {
        let active = true
        loader().then((m) => {
          if (!active) return
          const resolved =
            m && typeof m === "object" && "default" in m
              ? m.default
              : (m as ComponentType<Record<string, unknown>>)
          setComp(() => resolved)
        })
        return () => {
          active = false
        }
      }, [])
      if (!Comp) return null
      return <Comp {...props} />
    }
    return DynamicStub
  },
}))
vi.mock("@/components/task/MarkdownContent", () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}))
// 仅桩掉音频播放条叶子(无关本测试),保留 PlayerBarContainer / YouTubePlayerCard 真渲染以验证封面卡。
vi.mock("@/components/task/PlayerBar", () => ({ default: () => <div data-testid="player-bar" /> }))
vi.mock("@/lib/media-url", () => ({ usePublicMediaToken: () => "tok" }))
vi.mock("@/store/audio-store", () => ({
  useAudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      isPlaying: false,
      duration: 0,
      src: null,
      currentTime: 0,
      setSource: vi.fn(),
      toggle: vi.fn(),
      play: vi.fn(),
      seek: vi.fn(),
    }),
}))

import PublicTaskDetail from "./PublicTaskDetail"

const DETAIL_YOUTUBE: PublicTaskDetailData = {
  id: "t1",
  title: "公开详情标题",
  source_type: "youtube" as const,
  source_url: "https://www.youtube.com/watch?v=test123",
  audio_url: "/api/v1/media/upload/u1/t1.mp3",
  duration_seconds: 90,
  detected_language: "zh",
  detected_summary_style: "lecture",
  published_at: "2026-06-10T00:00:00Z",
  created_at: "2026-06-09T00:00:00Z",
}

const TRANSCRIPT_OK = {
  task_id: "t1",
  total: 1,
  items: [
    { sequence: 1, speaker_id: "S1", speaker_label: "讲话人 1", content: "转写第一段", start_time: 0, end_time: 5 },
  ],
}

const SUMMARY_OK: PublicSummaryResponse = {
  task_id: "t1",
  total: 3,
  items: [
    { summary_type: "overview", version: 1, content: "这是公开摘要正文", image_url: null, images: [], created_at: "2026-06-10T00:00:00Z" },
    { summary_type: "key_points", version: 1, content: "这是关键要点正文", image_url: null, images: [], created_at: "2026-06-10T00:00:00Z" },
  ],
}

function mockHappyPath() {
  mockClient.getPublicTask.mockResolvedValue(DETAIL_YOUTUBE)
  mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
  mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PublicTaskDetail 公开详情页", () => {
  it("渲染标题/摘要/转写", async () => {
    mockHappyPath()
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText("公开详情标题")).toBeInTheDocument()
      expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument()
      expect(screen.getByText("转写第一段")).toBeInTheDocument()
      // 富转写经共享调色板映射:说话人显示为按出现顺序分配的具名色标签(speakerA…),
      // 而非后端原始 speaker_label —— 与私有页同款。
      expect(screen.getByText("transcript.speakerA")).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it("detail 回来即渲染骨架:转写仍 pending 时标题/页签可见", async () => {
    mockClient.getPublicTask.mockResolvedValue(DETAIL_YOUTUBE)
    // 转写永不 resolve → 左栏停在 loading;骨架(标题/页签)必须已可见,不被转写拖住。
    mockClient.getPublicTranscript.mockReturnValue(new Promise(() => {}))
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText("公开详情标题")).toBeInTheDocument()
      // 三页签来自 TabSwitch 真渲染
      expect(screen.getByRole("tab", { name: "task.tabs.summary" })).toBeInTheDocument()
    }, { timeout: 3000 })
    // 转写仍 loading(共享 TranscriptList 的 transcript.loading 文案),不报错
    expect(screen.getByText("transcript.loading")).toBeInTheDocument()
  })

  it("转写失败而摘要正常:左栏局部错误+重试可恢复,右栏内容仍在", async () => {
    mockClient.getPublicTask.mockResolvedValue(DETAIL_YOUTUBE)
    mockClient.getPublicTranscript.mockRejectedValueOnce(new Error("network"))
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    // 左栏局部错误(TranscriptList 内建 task.transcriptLoadFailed)+ 右栏内容并存
    await waitFor(() => {
      expect(screen.getByText("task.transcriptLoadFailed")).toBeInTheDocument()
      expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument()
    }, { timeout: 3000 })
    // 整页未进 notFound / loadError
    expect(screen.queryByText("explore.notFoundTitle")).not.toBeInTheDocument()
    expect(screen.queryByText("explore.loadFailed")).not.toBeInTheDocument()
    // 局部重试:第二次成功 → 左栏恢复内容
    mockClient.getPublicTranscript.mockResolvedValueOnce(TRANSCRIPT_OK)
    fireEvent.click(screen.getByText("common.retry"))
    await waitFor(() => {
      expect(screen.getByText("转写第一段")).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  // 注:loader 的代际守卫(过期响应丢弃)防的是 StrictMode 双跑/路由复用等场景,
  // 同 id 下 UI 无入口在请求在途时触发第二次请求(retry 仅在前一请求 settle 后可见),
  // 黑盒不可达故不设用例;id 切换场景由路由层 key={id} 整树重挂覆盖。
  it("摘要失败而转写正常:右栏局部错误+可重试,左栏转写仍在", async () => {
    mockClient.getPublicTask.mockResolvedValue(DETAIL_YOUTUBE)
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockRejectedValue(new Error("boom"))
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText("explore.summaryLoadFailed")).toBeInTheDocument()
      expect(screen.getByText("转写第一段")).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(screen.queryByText("explore.loadFailed")).not.toBeInTheDocument()
  })

  it("页签切换:从摘要切到要点显示要点正文", async () => {
    mockHappyPath()
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument(), { timeout: 3000 })
    fireEvent.click(screen.getByRole("tab", { name: "task.tabs.keypoints" }))
    await waitFor(() => expect(screen.getByText("这是关键要点正文")).toBeInTheDocument(), { timeout: 3000 })
  })

  it("缺失的节显示空态文案(行动项无数据)", async () => {
    mockHappyPath()
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument(), { timeout: 3000 })
    fireEvent.click(screen.getByRole("tab", { name: "task.tabs.actions" }))
    await waitFor(() => expect(screen.getByText("task.actionItemsEmpty")).toBeInTheDocument(), { timeout: 3000 })
  })

  it("youtube_info 有值时渲染封面卡(频道链接 /channel/<id>)", async () => {
    mockClient.getPublicTask.mockResolvedValue({
      ...DETAIL_YOUTUBE,
      youtube_info: {
        video_id: "vid42",
        title: "视频标题",
        thumbnail_url: "https://i.ytimg.com/vi/vid42/hq.jpg",
        duration_seconds: 90,
        channel_id: "UC_real_channel",
        channel_title: "某频道",
      },
    })
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText("某频道")).toBeInTheDocument()
    }, { timeout: 3000 })
    const channelLink = screen.getByRole("link", { name: /某频道/ })
    expect(channelLink).toHaveAttribute("href", "https://www.youtube.com/channel/UC_real_channel")
    // 有封面卡时不重复展示顶部「查看原视频」链接
    expect(screen.queryByText("explore.viewSource")).not.toBeInTheDocument()
  })

  it("youtube_info.channel_id 为 null 时绝不渲染 /channel/null 链接", async () => {
    mockClient.getPublicTask.mockResolvedValue({
      ...DETAIL_YOUTUBE,
      youtube_info: {
        video_id: "vid42",
        title: "视频标题",
        thumbnail_url: null,
        duration_seconds: 90,
        channel_id: null,
        channel_title: null,
      },
    })
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("公开详情标题")).toBeInTheDocument(), { timeout: 3000 })
    // channel_title null → 降级 common.unknown;绝无任何指向 /channel/null 的链接
    const channelNullLinks = screen
      .queryAllByRole("link")
      .filter((el) => (el.getAttribute("href") || "").includes("/channel/null"))
    expect(channelNullLinks).toHaveLength(0)
  })

  it("youtube_info 字段完全缺失(undefined)不渲封面卡且不崩;source_url 在则保留来源链接", async () => {
    // 后端 feature 分支未上线前 youtube_info 整体缺失:回退普通播放条 + 顶部「查看原视频」。
    mockClient.getPublicTask.mockResolvedValue(DETAIL_YOUTUBE) // 无 youtube_info 字段
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("公开详情标题")).toBeInTheDocument(), { timeout: 3000 })
    const link = screen.getByRole("link", { name: "explore.viewSource" })
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=test123")
    // 普通音频播放条渲染(非封面卡)
    expect(screen.getByTestId("player-bar")).toBeInTheDocument()
  })

  it("非 YouTube 来源时不渲染来源链接", async () => {
    mockClient.getPublicTask.mockResolvedValue({
      id: "t1",
      title: "上传任务",
      source_type: "upload",
      source_url: null,
      audio_url: null,
      duration_seconds: 60,
      detected_language: "zh",
      detected_summary_style: "general",
      published_at: "2026-06-10T00:00:00Z",
      created_at: "2026-06-09T00:00:00Z",
    })
    mockClient.getPublicTranscript.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    mockClient.getPublicSummary.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("上传任务")).toBeInTheDocument(), { timeout: 3000 })
    expect(screen.queryByRole("link", { name: "explore.viewSource" })).not.toBeInTheDocument()
  })

  it("40401(不存在/已取消公开)渲染 notFound 态", async () => {
    mockClient.getPublicTask.mockRejectedValue(new ApiError(40401, "TASK_NOT_FOUND", ""))
    mockClient.getPublicTranscript.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    mockClient.getPublicSummary.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("explore.notFoundTitle")).toBeInTheDocument())
  })

  it("detail 瞬态失败渲染整页可重试错误而非 notFound", async () => {
    mockClient.getPublicTask.mockRejectedValue(new Error("network"))
    mockClient.getPublicTranscript.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    mockClient.getPublicSummary.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("explore.loadFailed")).toBeInTheDocument())
    expect(screen.getByText("explore.retry")).toBeInTheDocument()
  })

  // ===== 服务端 LAN 预取初值(initialDetail / initialSummary)=====

  it("传 initialDetail/initialSummary:立即渲染标题/摘要,且不发对应客户端请求(转写照常)", async () => {
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    render(
      <PublicTaskDetail
        isAuthenticated={false}
        onOpenLogin={() => {}}
        initialDetail={DETAIL_YOUTUBE}
        initialSummary={SUMMARY_OK}
      />
    )
    // detail 有初值:标题同步可见(无整页 spinner 阶段)
    expect(screen.getByText("公开详情标题")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument()
      expect(screen.getByText("转写第一段")).toBeInTheDocument()
    }, { timeout: 3000 })
    // 有初值的两路绝不重复发客户端初始请求;转写刻意不内嵌,仍走客户端拉取
    expect(mockClient.getPublicTask).not.toHaveBeenCalled()
    expect(mockClient.getPublicSummary).not.toHaveBeenCalled()
    expect(mockClient.getPublicTranscript).toHaveBeenCalledTimes(1)
  })

  it("只传 initialDetail:summary 照常客户端拉取", async () => {
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(
      <PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} initialDetail={DETAIL_YOUTUBE} />
    )
    expect(screen.getByText("公开详情标题")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(mockClient.getPublicTask).not.toHaveBeenCalled()
    expect(mockClient.getPublicSummary).toHaveBeenCalledTimes(1)
  })

  it("initialSummary 摘要失败路独立:有初值时右栏不可能进错误态,局部重试仍走客户端", async () => {
    // 初值即数据,右栏直接渲染;此用例兼回归「summaryLoading 初值 false」不闪 spinner
    mockClient.getPublicTask.mockResolvedValue(DETAIL_YOUTUBE)
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    render(
      <PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} initialSummary={SUMMARY_OK} />
    )
    await waitFor(() => {
      expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(mockClient.getPublicSummary).not.toHaveBeenCalled()
    expect(mockClient.getPublicTask).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("explore.summaryLoadFailed")).not.toBeInTheDocument()
  })
})
