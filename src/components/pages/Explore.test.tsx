import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({
  getPublicTasks: vi.fn(),
}))

// t 必须跨渲染稳定,否则成为加载 effect 的不稳定依赖导致无限重拉。
const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
vi.mock("@/lib/use-date-formatter", () => ({ useDateFormatter: () => ({ formatDate: () => "2026-06-10" }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/layout/Header", () => ({ default: () => null }))
vi.mock("@/components/layout/Sidebar", () => ({ default: () => null }))

import Explore from "./Explore"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Explore 公开列表页", () => {
  it("渲染公开任务卡片", async () => {
    mockClient.getPublicTasks.mockResolvedValue({
      items: [
        {
          id: "t1",
          title: "公开任务一",
          source_type: "upload",
          duration_seconds: 90,
          detected_language: "zh",
          detected_summary_style: "lecture",
          published_at: "2026-06-10T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    })
    render(<Explore isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("公开任务一")).toBeInTheDocument())
    expect(mockClient.getPublicTasks).toHaveBeenCalledTimes(1)
  })

  it("空列表渲染空态", async () => {
    mockClient.getPublicTasks.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 })
    render(<Explore isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("explore.emptyTitle")).toBeInTheDocument())
  })

  it("加载失败显示错误与重试", async () => {
    mockClient.getPublicTasks.mockRejectedValue(new Error("boom"))
    render(<Explore isAuthenticated={false} onOpenLogin={() => {}} />)
    await waitFor(() => expect(screen.getByText("explore.loadFailed")).toBeInTheDocument())
    expect(screen.getByText("explore.retry")).toBeInTheDocument()
  })
})
