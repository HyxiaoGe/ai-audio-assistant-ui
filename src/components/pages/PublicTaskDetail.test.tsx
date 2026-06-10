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
// 桩在正文旁边把 streamingImages 各项的 url/fallbackUrl 吐成可断言的 DOM,
// 供「images[].proxy_url → StreamingImage.fallbackUrl」接线用例使用。
vi.mock("@/components/task/MarkdownContent", () => ({
  MarkdownContent: ({
    content,
    streamingImages,
  }: {
    content: string
    streamingImages?: Map<string, { url: string | null; fallbackUrl?: string | null }>
  }) => (
    <div>
      {content}
      {[...(streamingImages ?? new Map())].map(([key, img]) => (
        <span
          key={key}
          data-testid="streaming-image"
          data-url={img.url ?? ""}
          data-fallback={img.fallbackUrl ?? ""}
        />
      ))}
    </div>
  ),
}))
// 仅桩掉音频播放条叶子(无关本测试),保留 PlayerBarContainer / YouTubePlayerCard 真渲染以验证封面卡。
// 桩上保留 onPlayPause 入口(button),供直链播放接线用例触发 handlePlayPause。
vi.mock("@/components/task/PlayerBar", () => ({
  default: ({ onPlayPause }: { onPlayPause?: () => void }) => (
    <button data-testid="player-bar" onClick={onPlayPause} />
  ),
}))
vi.mock("@/lib/media-url", () => ({ usePublicMediaToken: () => "tok" }))
// audio-store 桩:共享单例 state,用例可改 src(模拟当前播放源)并断言 setSource/play/toggle 调用。
const audioStore = vi.hoisted(() => ({
  state: {
    isPlaying: false,
    duration: 0,
    src: null as string | null,
    currentTime: 0,
    setSource: vi.fn(),
    toggle: vi.fn(),
    play: vi.fn(),
    seek: vi.fn(),
  },
}))
vi.mock("@/store/audio-store", () => ({
  useAudioStore: (selector: (s: Record<string, unknown>) => unknown) => selector(audioStore.state),
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
  audioStore.state.src = null
  // jsdom 未实现 scrollIntoView;isActiveAudio=true 时 TranscriptList 的自动滚动副作用会调用它,补桩。
  Element.prototype.scrollIntoView = vi.fn()
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

  // ===== 音频 OSS 预签名直链(audio_direct_url,绕隧道)播放接线 =====

  const DETAIL_UPLOAD_BASE = {
    id: "t1",
    title: "上传任务",
    source_type: "upload" as const,
    source_url: null,
    audio_url: "/api/v1/media/upload/u1/t1.mp3",
    duration_seconds: 60,
    detected_language: "zh",
    detected_summary_style: "general",
    published_at: "2026-06-10T00:00:00Z",
    created_at: "2026-06-09T00:00:00Z",
  }
  const DIRECT_AUDIO = "https://oss.example.com/upload/u1/t1.mp3?Expires=1&Signature=sig"

  it("有 audio_direct_url:点击播放以直链为源,audio_url 代理路径登记为回落", async () => {
    mockClient.getPublicTask.mockResolvedValue({ ...DETAIL_UPLOAD_BASE, audio_direct_url: DIRECT_AUDIO })
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByTestId("player-bar")).toBeInTheDocument(), { timeout: 3000 })

    fireEvent.click(screen.getByTestId("player-bar"))

    expect(audioStore.state.setSource).toHaveBeenCalledWith(
      DIRECT_AUDIO,
      "t1",
      "上传任务",
      "/api/v1/media/upload/u1/t1.mp3" // 直链失败时 audio-store 据此回落到代理路径(走媒体票/重载链)
    )
    expect(audioStore.state.play).toHaveBeenCalledTimes(1)
    expect(audioStore.state.toggle).not.toHaveBeenCalled()
  })

  it("无 audio_direct_url(后端未上线/未签出):行为同现状,源=audio_url 且无回落登记", async () => {
    mockClient.getPublicTask.mockResolvedValue(DETAIL_UPLOAD_BASE)
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByTestId("player-bar")).toBeInTheDocument(), { timeout: 3000 })

    fireEvent.click(screen.getByTestId("player-bar"))

    expect(audioStore.state.setSource).toHaveBeenCalledWith(
      "/api/v1/media/upload/u1/t1.mp3",
      "t1",
      "上传任务",
      null
    )
    expect(audioStore.state.play).toHaveBeenCalledTimes(1)
  })

  it("直链失败已回落(currentSrc=audio_url 代理路径):点击只 toggle,绝不切回直链", async () => {
    audioStore.state.src = "/api/v1/media/upload/u1/t1.mp3" // audio-store 已把源回落为代理路径
    mockClient.getPublicTask.mockResolvedValue({ ...DETAIL_UPLOAD_BASE, audio_direct_url: DIRECT_AUDIO })
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue(SUMMARY_OK)
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByTestId("player-bar")).toBeInTheDocument(), { timeout: 3000 })

    fireEvent.click(screen.getByTestId("player-bar"))

    expect(audioStore.state.toggle).toHaveBeenCalledTimes(1)
    expect(audioStore.state.setSource).not.toHaveBeenCalled() // 回落源即本任务激活源,不重切
  })

  // ===== 摘要配图 OSS 直链回落通道接线(images[].proxy_url → StreamingImage.fallbackUrl)=====

  it("摘要配图带 proxy_url:转入 streamingImages.fallbackUrl 供直链过期自愈;无 proxy_url 则为空", async () => {
    mockClient.getPublicTask.mockResolvedValue(DETAIL_YOUTUBE)
    mockClient.getPublicTranscript.mockResolvedValue(TRANSCRIPT_OK)
    mockClient.getPublicSummary.mockResolvedValue({
      task_id: "t1",
      total: 1,
      items: [
        {
          summary_type: "overview",
          version: 1,
          content: "正文 {{IMAGE: 架构图}} {{IMAGE: 流程图}}",
          image_url: null,
          images: [
            {
              placeholder: "{{IMAGE: 架构图}}",
              status: "ready",
              url: "https://oss.example.com/img/arch.webp?Expires=1",
              alt: "架构图",
              proxy_url: "/api/v1/summaries/images/arch.webp",
            },
            {
              // url 已是代理回落形态(后端直链签发失败):proxy_url=null,无回落通道
              placeholder: "{{IMAGE: 流程图}}",
              status: "ready",
              url: "/api/v1/summaries/images/flow.webp",
              alt: "流程图",
              proxy_url: null,
            },
          ],
          created_at: "2026-06-10T00:00:00Z",
        },
      ],
    })
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)

    await waitFor(() => {
      expect(screen.getAllByTestId("streaming-image")).toHaveLength(2)
    }, { timeout: 3000 })
    const [arch, flow] = screen.getAllByTestId("streaming-image")
    expect(arch).toHaveAttribute("data-url", "https://oss.example.com/img/arch.webp?Expires=1")
    expect(arch).toHaveAttribute("data-fallback", "/api/v1/summaries/images/arch.webp")
    expect(flow).toHaveAttribute("data-url", "/api/v1/summaries/images/flow.webp")
    expect(flow).toHaveAttribute("data-fallback", "")
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
