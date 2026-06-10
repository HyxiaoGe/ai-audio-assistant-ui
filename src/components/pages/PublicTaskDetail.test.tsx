import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useState, useEffect, type ComponentType } from "react"

import { ApiError } from "@/types/api"

const mockClient = vi.hoisted(() => ({
  getPublicTask: vi.fn(),
  getPublicTranscript: vi.fn(),
  getPublicSummary: vi.fn(),
}))

const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
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
vi.mock("@/components/task/PlayerBarContainer", () => ({ PlayerBarContainer: () => null }))
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

function mockHappyPath() {
  mockClient.getPublicTask.mockResolvedValue({
    id: "t1",
    title: "公开详情标题",
    source_type: "upload",
    source_url: null,
    audio_url: "/api/v1/media/upload/u1/t1.mp3",
    duration_seconds: 90,
    detected_language: "zh",
    detected_summary_style: "lecture",
    published_at: "2026-06-10T00:00:00Z",
    created_at: "2026-06-09T00:00:00Z",
  })
  mockClient.getPublicTranscript.mockResolvedValue({
    task_id: "t1",
    total: 1,
    items: [
      { sequence: 1, speaker_id: "S1", speaker_label: "讲话人 1", content: "转写第一段", start_time: 0, end_time: 5 },
    ],
  })
  mockClient.getPublicSummary.mockResolvedValue({
    task_id: "t1",
    total: 1,
    items: [
      {
        summary_type: "overview",
        version: 1,
        content: "这是公开摘要正文",
        image_url: null,
        images: [],
        created_at: "2026-06-10T00:00:00Z",
      },
    ],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PublicTaskDetail 公开详情页", () => {
  it("渲染标题/摘要/转写", async () => {
    mockHappyPath()
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    // 标题、转写为同步渲染；MarkdownContent 由 DynamicStub 异步 setState，需在同一 waitFor 内联检
    await waitFor(() => {
      expect(screen.getByText("公开详情标题")).toBeInTheDocument()
      expect(screen.getByText("这是公开摘要正文")).toBeInTheDocument()
      expect(screen.getByText("转写第一段")).toBeInTheDocument()
      expect(screen.getByText("讲话人 1")).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it("40401(不存在/已取消公开)渲染 notFound 态", async () => {
    mockClient.getPublicTask.mockRejectedValue(new ApiError(40401, "TASK_NOT_FOUND", ""))
    mockClient.getPublicTranscript.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    mockClient.getPublicSummary.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("explore.notFoundTitle")).toBeInTheDocument())
  })

  it("瞬态失败渲染可重试错误而非 notFound", async () => {
    mockClient.getPublicTask.mockRejectedValue(new Error("network"))
    mockClient.getPublicTranscript.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    mockClient.getPublicSummary.mockResolvedValue({ task_id: "t1", total: 0, items: [] })
    render(<PublicTaskDetail isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("explore.loadFailed")).toBeInTheDocument())
    expect(screen.getByText("explore.retry")).toBeInTheDocument()
  })
})
