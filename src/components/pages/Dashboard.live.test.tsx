import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useGlobalStore } from "@/store/global-store"

// 概览页『最近任务』标题不实时:Dashboard 已订阅 globalTasks 并合并 status/progress/
// error_message,却独漏 title——与已上线的 TaskDetail PR#83 同源 bug 的遗漏跟修点。
// YouTube 任务初值标题为空,download(~15%)才解析出真标题,期间概览页一直显示空标题
// 直到下次全量 getTasks。这里用真实 store 锁定:title 必须随 WS 进度合并刷新,且 WS 未
// 携带标题时不以 undefined 覆盖本地已有标题。
//
// 注:同目录 Dashboard.test.tsx 把 store 整体 mock 成 {},无法驱动实时态;故本用例单独
// 用真实 Zustand store(不 mock @/store/global-store)。
const mockClient = vi.hoisted(() => ({ getTasks: vi.fn() }))
const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({ formatRelativeTime: () => "just now" }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/layout/Header", () => ({ default: () => null }))
vi.mock("@/components/layout/Sidebar", () => ({ default: () => null }))
vi.mock("@/components/task/NewTaskCard", () => ({ default: () => null }))
vi.mock("@/components/pages/PublicTaskList", () => ({ default: () => <div>public-task-list</div> }))
vi.mock("@/components/task/TaskCard", () => ({
  default: ({ id, title, status }: { id: string; title: string; status: string }) => (
    <div data-testid={`task-${id}`}>
      <span>{title}</span>
      <span>{status}</span>
    </div>
  ),
}))

import Dashboard from "./Dashboard"

describe("Dashboard 最近任务标题随 WS 实时刷新", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    act(() => useGlobalStore.setState({ tasks: {} }))
    mockClient.getTasks.mockResolvedValue({
      items: [
        {
          id: "y1",
          title: "",
          status: "processing",
          source_type: "youtube",
          duration_seconds: 0,
          created_at: "2026-06-18T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    })
  })

  it("download 阶段解析出真标题后,卡片标题随 store 即时刷新", async () => {
    render(<Dashboard isAuthenticated onOpenLogin={() => {}} onOpenNewTask={() => {}} />)

    const card = await screen.findByTestId("task-y1")

    act(() => {
      useGlobalStore
        .getState()
        .updateTask("y1", { status: "processing", progress: 15, title: "真实视频标题" })
    })

    await waitFor(() => {
      expect(screen.getByTestId("task-y1")).toHaveTextContent("真实视频标题")
    })
    void card
  })

  it("WS 未携带标题时不以 undefined 覆盖已有标题", async () => {
    mockClient.getTasks.mockResolvedValueOnce({
      items: [
        {
          id: "y1",
          title: "已有标题",
          status: "processing",
          source_type: "youtube",
          duration_seconds: 0,
          created_at: "2026-06-18T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 5,
    })
    render(<Dashboard isAuthenticated onOpenLogin={() => {}} onOpenNewTask={() => {}} />)

    await screen.findByTestId("task-y1")

    act(() => {
      useGlobalStore.getState().updateTask("y1", { status: "processing", progress: 50 })
    })

    await waitFor(() => {
      expect(screen.getByTestId("task-y1")).toHaveTextContent("已有标题")
    })
  })
})
