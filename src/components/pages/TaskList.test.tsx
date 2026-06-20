import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import TaskList from "./TaskList"
import { useGlobalStore } from "@/store/global-store"

// 重试一个 failed 任务后，/tasks 列表既不重新拉取也不订阅实时更新，卡片停在 'failed'，
// 直到手动切筛选/翻页/刷新才前进（与全站实时 UX 相悖）。这里锁定：重试成功后必须再次
// 拉取列表，使卡片脱离 failed 态。
const mockClient = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getTaskStatusCounts: vi.fn(),
  retryTask: vi.fn(),
  searchTranscripts: vi.fn(),
}))

// t 必须跨渲染稳定，否则会成为加载 effect 的不稳定依赖导致无限重拉。
const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

// 稳定的 push mock：用于断言搜索命中点击后的深链跳转（带时间戳）。
const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => mockClient,
}))

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ locale: "en", t: i18n.t }),
}))

vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({ formatRelativeTime: () => "just now" }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}))

vi.mock("@/lib/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

vi.mock("@/components/layout/Header", () => ({ default: () => null }))
vi.mock("@/components/layout/Sidebar", () => ({ default: () => null }))

vi.mock("@/components/task/TaskCard", () => ({
  default: ({
    id,
    title,
    status,
    onRetry,
  }: {
    id: string
    title: string
    status: string
    onRetry: (id: string) => void
  }) => (
    <div data-testid={`task-${id}`}>
      <span>{title}</span>
      <span>{status}</span>
      <button data-testid={`retry-${id}`} onClick={() => onRetry(id)}>
        retry
      </button>
    </div>
  ),
}))

describe("TaskList retry refetch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockClient.getTasks.mockResolvedValue({
      items: [
        {
          id: "t1",
          title: "Failed task",
          status: "failed",
          source_type: "file",
          duration_seconds: 0,
          created_at: "2026-05-30T00:00:00Z",
        },
      ],
      total: 1,
    })
    mockClient.getTaskStatusCounts.mockResolvedValue({
      all: 1,
      processing: 0,
      completed: 0,
      failed: 1,
    })
    // 非 duplicate_found 的成功返回 → 走 notifySuccess 成功路径。
    mockClient.retryTask.mockResolvedValue({})
  })

  it("refetches the task list after a successful retry", async () => {
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)

    await screen.findByTestId("retry-t1")
    await waitFor(() => expect(mockClient.getTasks).toHaveBeenCalled())

    const callsBefore = mockClient.getTasks.mock.calls.length

    fireEvent.click(screen.getByTestId("retry-t1"))

    await waitFor(() =>
      expect(mockClient.getTasks.mock.calls.length).toBeGreaterThan(callsBefore)
    )
    expect(mockClient.retryTask).toHaveBeenCalledWith("t1", false)
  })
})

// /tasks 主列表是用户最高频入口,但 TaskList 此前不订阅 global-store(纯 refetch),
// 处理中卡片的标题/状态徽章全程停在 mount 快照,连 completed 通知都不触发列表刷新。
// 这里锁定:订阅 store 后,卡片随 WS 进度即时刷新(无需重拉),且任务进入终态时
// 重新拉取后端权威状态计数(chips 数字不再停旧值)。对齐 Dashboard 已有正确范式。
describe("TaskList 实时订阅 store——处理中卡片随 WS 刷新", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    act(() => useGlobalStore.setState({ tasks: {} }))
    mockClient.getTasks.mockResolvedValue({
      items: [
        {
          id: "p1",
          title: "处理中任务",
          status: "processing",
          source_type: "file",
          duration_seconds: 0,
          created_at: "2026-06-18T00:00:00Z",
        },
      ],
      total: 1,
    })
    mockClient.getTaskStatusCounts.mockResolvedValue({
      all: 1,
      processing: 1,
      completed: 0,
      failed: 0,
    })
    mockClient.retryTask.mockResolvedValue({})
  })

  it("卡片的状态与标题随 store 更新即时刷新,且不重新拉取列表", async () => {
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)

    const card = await screen.findByTestId("task-p1")
    expect(card).toHaveTextContent("处理中任务")
    expect(card).toHaveTextContent("processing")

    act(() => {
      useGlobalStore
        .getState()
        .updateTask("p1", { status: "completed", title: "最终标题" })
    })

    await waitFor(() => {
      const c = screen.getByTestId("task-p1")
      expect(c).toHaveTextContent("completed")
      expect(c).toHaveTextContent("最终标题")
    })
    // 纯 store 驱动:不应触发列表重拉
    expect(mockClient.getTasks).toHaveBeenCalledTimes(1)
  })

  it("已知任务进入终态时重新拉取权威状态计数", async () => {
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)

    await screen.findByTestId("task-p1")
    await waitFor(() => expect(mockClient.getTaskStatusCounts).toHaveBeenCalled())
    const before = mockClient.getTaskStatusCounts.mock.calls.length

    act(() => {
      useGlobalStore.getState().updateTask("p1", { status: "completed" })
    })

    await waitFor(() =>
      expect(mockClient.getTaskStatusCounts.mock.calls.length).toBeGreaterThan(before)
    )
  })

  it("WS 未携带标题时不以 undefined 覆盖已有标题", async () => {
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)

    const card = await screen.findByTestId("task-p1")
    expect(card).toHaveTextContent("处理中任务")

    act(() => {
      // 仅进度推进,无 task_title → store 中 title 为 undefined
      useGlobalStore.getState().updateTask("p1", { status: "processing", progress: 50 })
    })

    await waitFor(() => {
      expect(screen.getByTestId("task-p1")).toHaveTextContent("处理中任务")
    })
  })
})

// 旧搜索框只对「当前页已加载」的任务按标题做客户端 includes 过滤(P1-6):翻页之外的命中被漏,
// 且完全搜不到转写正文。这里锁定新行为:输入查询 → 防抖后打 GET /tasks/search(后端 pg_jieba
// 中文分词全文检索)→ 渲染带高亮片段的命中,点击深链到 /tasks/{id}?t={start_time} 跳播;
// 空查询不打服务端、回落正常列表。
describe("TaskList 服务端转写搜索（替换纯客户端标题过滤）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    act(() => useGlobalStore.setState({ tasks: {} }))
    mockClient.getTasks.mockResolvedValue({
      items: [
        {
          id: "list-1",
          title: "列表里的任务",
          status: "completed",
          source_type: "file",
          duration_seconds: 0,
          created_at: "2026-06-18T00:00:00Z",
        },
      ],
      total: 1,
    })
    mockClient.getTaskStatusCounts.mockResolvedValue({
      all: 1,
      processing: 0,
      completed: 1,
      failed: 0,
    })
    mockClient.searchTranscripts.mockResolvedValue({
      query: "谷歌",
      hits: [
        {
          task_id: "task-1",
          title: "AI 周报",
          snippet: "这期聊到<mark>谷歌</mark>的新模型",
          start_time: 12.5,
          rank: 0.08,
        },
      ],
    })
  })

  it("输入查询后向服务端发起转写搜索并渲染带高亮片段的命中", async () => {
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)
    await screen.findByTestId("task-list-1")

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "谷歌" } })

    await waitFor(() => expect(mockClient.searchTranscripts).toHaveBeenCalledWith("谷歌"))

    const hit = await screen.findByTestId("search-hit-task-1")
    expect(hit).toHaveTextContent("AI 周报")
    expect(hit).toHaveTextContent("这期聊到谷歌的新模型")
    // 搜索激活时用结果替换常规列表，避免「当前页过滤」的旧语义
    expect(screen.queryByTestId("task-list-1")).toBeNull()
  })

  it("点击命中深链到 /tasks/{id}?t={start_time} 以便跳播", async () => {
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)
    await screen.findByTestId("task-list-1")

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "谷歌" } })
    const hit = await screen.findByTestId("search-hit-task-1")

    fireEvent.click(hit)
    expect(routerMock.push).toHaveBeenCalledWith("/tasks/task-1?t=12.5")
  })

  it("空白查询不打服务端，回落正常任务列表", async () => {
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)
    await screen.findByTestId("task-list-1")

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } })

    // 给防抖留出时间，确认未触发服务端搜索
    await new Promise((r) => setTimeout(r, 400))
    expect(mockClient.searchTranscripts).not.toHaveBeenCalled()
    expect(screen.getByTestId("task-list-1")).toBeInTheDocument()
  })

  it("查询无命中时显示空状态，不渲染任何命中卡片", async () => {
    mockClient.searchTranscripts.mockResolvedValue({ query: "不存在", hits: [] })
    render(<TaskList isAuthenticated onOpenLogin={vi.fn()} />)
    await screen.findByTestId("task-list-1")

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "不存在" } })

    await waitFor(() => expect(mockClient.searchTranscripts).toHaveBeenCalledWith("不存在"))
    await waitFor(() => expect(screen.queryByTestId("search-hit-task-1")).toBeNull())
    expect(screen.queryByTestId("task-list-1")).toBeNull()
  })
})
