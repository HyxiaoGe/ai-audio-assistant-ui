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
  getSummaryStyles: vi.fn(),
}))
vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => apiMock,
}))

// 渲染入口须在 mock 之后 import
import TaskDetail from "./TaskDetail"
// 预热：静态 import 真实 MarkdownContent（含 react-markdown 全家桶），让其模块树在测试开始前
// 就被 vitest 加载/执行/缓存。否则本文件唯一【经 next/dynamic 动态 import】首次拉起该重模块的
// 用例（test 3），会在 waitFor 计时窗口内现加载几十个 micromark/mdast 模块——慢 CI runner 上
// 易 >1000ms 默认超时，DynamicStub 一直返回 null、占位符不渲染而被误判失败。此 import 仅预热，
// 实际渲染仍走 TaskDetail 内部的 next/dynamic（命中同一模块缓存后瞬时解析）。
import "@/components/task/MarkdownContent"

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
  apiMock.getSummaryStyles.mockReset()
  apiMock.getLLMModels.mockResolvedValue({ models: [] })
  apiMock.getSummaryStyles.mockResolvedValue({ styles: [] })
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

    // 初始：占位符 pending（ImagePlaceholder 显示「等待生成...」）。
    // 超时放宽到 5s：loadTask 异步 + next/dynamic stub 的 effect/microtask 解析叠加，慢 CI runner
    // 上偶超默认 1s（已配合上面的模块预热消除主要延迟，这里只作余量保险）。
    await waitFor(
      () => {
        expect(screen.getByText("等待生成...")).toBeInTheDocument()
      },
      { timeout: 5000 }
    )

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

  it("re-fetches the transcript at the polishing/summarizing stage when the first fetch came back empty (plan B 提早整块)", async () => {
    // 模拟 live 观看：进入可见阶段时 loadTask 首拉转写尚未就绪（empty-success），
    // 「进入可见阶段补拉」effect 应再拉一次，把已落库的完整转写提早显示出来，而非停在「转写生成中」。
    apiMock.getTask.mockResolvedValue(task({ status: "polishing", progress: 72 }))
    const { ApiError } = await import("@/types/api")
    apiMock.getSummary.mockRejectedValue(new ApiError(40401, "not found", "tr"))
    const empty = { ...transcript, total: 0, items: [] } as unknown as TranscriptResponse
    apiMock.getTranscript.mockReset()
    apiMock.getTranscript.mockResolvedValueOnce(empty).mockResolvedValue(transcript)

    render(<TaskDetail />)

    // 补拉成功后完整转写出现（而不是一直停在「转写生成中」占位）
    await waitFor(() => {
      expect(screen.getByText("这是一段转写文本")).toBeInTheDocument()
    })
    // 证明确实发生了「补拉」：getTranscript 被调用不止一次（首拉空 + 可见阶段补拉）
    expect(apiMock.getTranscript.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it("completed 同步重拉时静默替换转写——不清空、不闪 loading spinner", async () => {
    // 回归：任务变 completed 时（摘要落库）会重拉以换上润色版转写，但应『静默替换』：
    // 保留已显示的转写、不闪 spinner，仅在数据回来后原位替换。旧行为会先 setTranscript([])+loading=true
    // 把整列闪成 spinner（用户报告的「转写又重新加载一遍」）。
    apiMock.getTask
      .mockResolvedValueOnce(task({ status: "summarizing" }))
      .mockResolvedValue(task({ status: "completed", progress: 100 }))
    const { ApiError } = await import("@/types/api")
    apiMock.getSummary
      .mockRejectedValueOnce(new ApiError(40401, "not found", "tr")) // summarizing：摘要未就绪
      .mockResolvedValue(summaryResp()) // completed 重拉：摘要已就绪

    // 转写：mount 拿到已显示的转写；completed 同步重拉时这一拉【受控挂起】，以便在「重拉进行中」断言静默。
    let resolveReload: ((v: TranscriptResponse) => void) | undefined
    const polished = {
      ...transcript,
      items: [{ ...transcript.items[0], content: "这是润色后的转写" }],
    } as unknown as TranscriptResponse
    apiMock.getTranscript.mockReset()
    apiMock.getTranscript
      .mockResolvedValueOnce(transcript)
      .mockReturnValueOnce(new Promise<TranscriptResponse>((res) => { resolveReload = res }))

    render(<TaskDetail />)
    await waitFor(() => {
      expect(screen.getByText("这是一段转写文本")).toBeInTheDocument()
    })

    // 驱动任务 completed → 触发 completed 同步重拉
    act(() => {
      useGlobalStore.setState({
        tasks: { "task-1": { task_id: "task-1", status: "completed", progress: 100, updated_at: 1 } },
      })
    })

    // 等重拉真正发起（getTranscript 第二次被调用），此刻这一拉仍挂起
    await waitFor(() => {
      expect(apiMock.getTranscript.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    // 关键断言：重拉进行中，已显示的转写不被清空、不闪 loading spinner（transcript.loading 文案不出现）
    expect(screen.getByText("这是一段转写文本")).toBeInTheDocument()
    expect(screen.queryByText("transcript.loading")).toBeNull()

    // 放出润色版转写 → 原位替换为润色版
    act(() => {
      resolveReload?.(polished)
    })
    await waitFor(() => {
      expect(screen.getByText("这是润色后的转写")).toBeInTheDocument()
    })
  })

  it("completed 后配图对账兜底：WS 漏收时靠轮询从 DB 拉到 ready 并显示", async () => {
    // 回归：配图在 completed 之后才异步生成，前端只在 completed 拉过一次摘要（那时图还 pending）。
    // 若 WS image_ready 漏收，旧逻辑会停在占位直到 90s 兜底翻 failed；新增的对账轮询应每隔数秒重拉
    // getSummary，从 DB 读到 ready 后把占位换成真图——本用例【不】推送任何 image_ready 事件。
    apiMock.getTask.mockResolvedValue(task({ status: "completed" }))
    const readyResp = summaryResp({
      images: [
        {
          placeholder: "{{IMAGE: 时间轴}}",
          status: "ready",
          url: "/api/v1/summaries/images/t.png",
          alt: "时间轴",
          model_id: null,
          error: null,
        },
      ],
    })
    // 首拉(loadTask)：图仍 pending；此后对账轮询重拉：DB 已 ready
    apiMock.getSummary.mockResolvedValueOnce(summaryResp()).mockResolvedValue(readyResp)

    render(<TaskDetail />)

    // 初始 pending 占位
    await waitFor(
      () => {
        expect(screen.getByText("等待生成...")).toBeInTheDocument()
      },
      { timeout: 5000 }
    )

    // 不推送 image_ready，仅靠对账轮询（每 4s）从 DB 拉到 ready
    await waitFor(
      () => {
        const img = screen.getByRole("img", { name: "时间轴" })
        expect(img).toHaveAttribute("src", "/api/v1/summaries/images/t.png?token=tok")
      },
      { timeout: 8000 }
    )
    // 至少发生过一次对账重拉（首拉 + 轮询）
    expect(apiMock.getSummary.mock.calls.length).toBeGreaterThanOrEqual(2)
    // 显式抬高本用例超时：对账轮询真实定时器(4s 间隔)+ 两个内层 waitFor(5s+8s 上界)之和会超过
    // vitest 默认 testTimeout=5000ms（未在 config/CLI 覆盖），慢 CI runner 上极易间歇超时红。
  }, 20000)
})

describe("TaskDetail — detected summary style", () => {
  it("renders the detected-style line when detected_summary_style matches a loaded style", async () => {
    apiMock.getTask.mockResolvedValue(
      task({ status: "completed", detected_summary_style: "meeting" })
    )
    apiMock.getSummary.mockResolvedValue(summaryResp())
    apiMock.getSummaryStyles.mockResolvedValue({
      styles: [
        {
          id: "meeting",
          name: "会议纪要",
          description: "d",
          focus: "f",
          icon: undefined,
          recommended_visual_types: [],
        },
      ],
    })

    render(<TaskDetail />)

    await waitFor(() => {
      expect(screen.getByText("task.detectedStyle")).toBeInTheDocument()
    })
  })

  it("does not render the detected-style line when detected_summary_style is absent", async () => {
    apiMock.getTask.mockResolvedValue(task({ status: "completed" }))
    apiMock.getSummary.mockResolvedValue(summaryResp())
    apiMock.getSummaryStyles.mockResolvedValue({
      styles: [
        {
          id: "meeting",
          name: "会议纪要",
          description: "d",
          focus: "f",
          icon: undefined,
          recommended_visual_types: [],
        },
      ],
    })

    render(<TaskDetail />)

    await waitFor(() => {
      expect(screen.getByText("task.summaryOverview")).toBeInTheDocument()
    })
    expect(screen.queryByText("task.detectedStyle")).toBeNull()
  })
})
