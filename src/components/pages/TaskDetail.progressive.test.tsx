import { render, screen, waitFor, act } from "@testing-library/react"
import type { ComponentType } from "react"
import { useEffect, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGlobalStore } from "@/store/global-store"
import type {
  TaskDetail as ApiTaskDetail,
  SummaryResponse,
  TranscriptResponse,
} from "@/types/api"

// 稳定 mock 引用：Zustand/i18n selector 每次必须返回【同一引用】。若每次返回新对象字面量，
// 这些引用会流进 TaskDetail 的 useMemo(availableSpeakers[t])/useCallback(loadTask)/useEffect 依赖，
// 致 effect 每帧重跑 → loadTask 每帧 setState → 无限 render 循环 → 堆溢出 OOM。
// 真实 Zustand/i18n 返回稳定引用，故仅测试 mock 需显式稳定（实测：三者必须同时稳定才不崩）。
const mocks = vi.hoisted(() => {
  const t = (key: string) => key
  return {
    i18n: { locale: "zh", t },
    dateFormatter: { formatRelativeTime: () => "刚刚" },
    authState: { user: { id: "u1", name: "User" }, status: "authenticated" },
    router: { push: vi.fn() },
    audioState: {
      isPlaying: false,
      duration: 0,
      currentTime: 0,
      src: null,
      setSource: vi.fn(),
      toggle: vi.fn(),
      play: vi.fn(),
      seek: vi.fn(),
    },
  }
})

// ---- i18n: 回显 key，便于断言「生成中」「失败」文案存在（稳定引用）----
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => mocks.i18n,
}))

vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => mocks.dateFormatter,
}))

// ---- auth：已登录（稳定引用）----
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(mocks.authState),
}))

// ---- next/navigation：固定 task id（稳定 router 引用）----
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useParams: () => ({ id: "task-1" }),
}))

// ---- next/dynamic：同步解析真实组件，使真实 MarkdownContent 异步加载、配合 waitFor 断言。 ----
// loader 形如 () => import('...').then(m => m.MarkdownContent)，故 then 后的 m 即组件本身。
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
            m && typeof m === "object" && "default" in m ? m.default : (m as ComponentType<Record<string, unknown>>)
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

// ---- media token：直接给字符串 ----
vi.mock("@/lib/media-url", () => ({
  useMediaToken: () => "tok",
  appendMediaToken: (url: string | null | undefined, token: string | null) =>
    url ? (token ? `${url}?token=${token}` : url) : "",
}))

// ---- audio store：最小桩（稳定引用，含 TranscriptList 订阅的 currentTime）----
vi.mock("@/store/audio-store", () => ({
  useAudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(mocks.audioState),
}))

// ---- 顶层布局桩：不在被测范围，且会引入 ws/通知等依赖 ----
vi.mock("@/components/layout/Header", () => ({
  default: () => null,
}))
vi.mock("@/components/layout/Sidebar", () => ({
  default: () => null,
}))
vi.mock("@/components/task/PlayerBarContainer", () => ({
  PlayerBarContainer: () => null,
}))

// ---- notify：避免拉起 sonner toast ----
vi.mock("@/lib/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  notifyInfo: vi.fn(),
  notifyWarning: vi.fn(),
}))

// ---- API client：可按用例替换返回 ----
const apiMock = vi.hoisted(() => ({
  getTask: vi.fn(),
  getTranscript: vi.fn(),
  getSummary: vi.fn(),
  getLLMModels: vi.fn(),
}))
vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => apiMock,
}))

// 渲染入口须在 mock 之后 import
import TaskDetail from "./TaskDetail"

function task(over: Partial<ApiTaskDetail> = {}): ApiTaskDetail {
  return {
    id: "task-1",
    title: "演示任务",
    source_type: "youtube",
    status: "summarizing",
    progress: 80,
    created_at: "2026-06-03T00:00:00Z",
    updated_at: "2026-06-03T00:00:00Z",
    ...over,
  } as ApiTaskDetail
}

const transcript: TranscriptResponse = {
  task_id: "task-1",
  total: 1,
  page: 1,
  page_size: 50,
  items: [
    {
      id: "seg-1",
      start_time: 0,
      end_time: 3,
      content: "这是一段转写文本",
      speaker_id: "spk1",
    },
  ],
} as unknown as TranscriptResponse

function summaryResp(
  over: Partial<SummaryResponse["items"][number]> = {}
): SummaryResponse {
  return {
    task_id: "task-1",
    total: 1,
    items: [
      {
        id: "sum-1",
        summary_type: "overview",
        version: 1,
        is_active: true,
        content: "概览正文 {{IMAGE: 时间轴}}",
        model_used: "gemini",
        prompt_version: null,
        token_count: null,
        created_at: "2026-06-03T00:00:00Z",
        images: [
          {
            placeholder: "{{IMAGE: 时间轴}}",
            status: "pending",
            url: null,
            alt: "时间轴",
            model_id: null,
            error: null,
          },
        ],
        ...over,
      },
    ],
  }
}

beforeEach(() => {
  apiMock.getTask.mockReset()
  apiMock.getTranscript.mockReset()
  apiMock.getSummary.mockReset()
  apiMock.getLLMModels.mockReset()
  apiMock.getLLMModels.mockResolvedValue({ models: [] })
  apiMock.getTranscript.mockResolvedValue(transcript)
  useGlobalStore.setState({ tasks: {}, imageReadyEvents: {} })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("TaskDetail — progressive disclosure", () => {
  it("renders the transcript left column during the summarizing stage (no full-screen gate)", async () => {
    apiMock.getTask.mockResolvedValue(task({ status: "summarizing" }))
    // 摘要尚未就绪 → 40401
    const { ApiError } = await import("@/types/api")
    apiMock.getSummary.mockRejectedValue(new ApiError(40401, "not found", "tr"))

    render(<TaskDetail />)

    await waitFor(() => {
      expect(screen.getByText("这是一段转写文本")).toBeInTheDocument()
    })
    // 右栏处于「摘要生成中」
    expect(screen.getByText("task.summaryGenerating")).toBeInTheDocument()
  })

  it("shows a summary-only error without hiding the transcript when summary fails", async () => {
    apiMock.getTask.mockResolvedValue(task({ status: "completed" }))
    const { ApiError } = await import("@/types/api")
    // 非 40401 = 摘要文字失败（task 仍 completed）
    apiMock.getSummary.mockRejectedValue(new ApiError(50000, "摘要生成失败", "tr"))

    render(<TaskDetail />)

    await waitFor(() => {
      expect(screen.getByText("这是一段转写文本")).toBeInTheDocument()
    })
    expect(screen.getByText("摘要生成失败")).toBeInTheDocument()
  })

  it("replaces a pending placeholder with a ready image when an image_ready event arrives", async () => {
    apiMock.getTask.mockResolvedValue(task({ status: "completed" }))
    apiMock.getSummary.mockResolvedValue(summaryResp())

    render(<TaskDetail />)

    // 初始：占位符 pending（ImagePlaceholder 显示「等待生成...」）
    await waitFor(() => {
      expect(screen.getByText("等待生成...")).toBeInTheDocument()
    })

    // 推送 image_ready → ready
    act(() => {
      useGlobalStore.getState().applyImageReady({
        task_id: "task-1",
        summary_id: "sum-1",
        summary_type: "overview",
        placeholder: "{{IMAGE: 时间轴}}",
        status: "ready",
        url: "/api/v1/summaries/images/t.png",
        model_id: "gemini",
      })
    })

    await waitFor(() => {
      const img = screen.getByRole("img", { name: "时间轴" })
      expect(img).toHaveAttribute("src", "/api/v1/summaries/images/t.png?token=tok")
    })
  })
})
