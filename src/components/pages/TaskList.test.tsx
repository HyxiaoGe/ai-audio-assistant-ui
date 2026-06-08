import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import TaskList from "./TaskList"

// 重试一个 failed 任务后，/tasks 列表既不重新拉取也不订阅实时更新，卡片停在 'failed'，
// 直到手动切筛选/翻页/刷新才前进（与全站实时 UX 相悖）。这里锁定：重试成功后必须再次
// 拉取列表，使卡片脱离 failed 态。
const mockClient = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getTaskStatusCounts: vi.fn(),
  retryTask: vi.fn(),
}))

// t 必须跨渲染稳定，否则会成为加载 effect 的不稳定依赖导致无限重拉。
const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

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
  useRouter: () => ({ push: vi.fn() }),
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
