import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({ getAdminUserTasks: vi.fn() }))
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock("next/navigation", () => ({
  useParams: () => ({ uid: "user-b" }),
  useRouter: () => ({ push: vi.fn() }),
}))
// useDateFormatter 依赖 settings-context provider;在 jsdom 中需 mock
vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({ formatDateTime: (s: string) => s }),
}))

import AdminUserTasks from "./AdminUserTasks"

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.getAdminUserTasks.mockResolvedValue({
    items: [
      { id: "t1", title: "标题一", source_type: "youtube", status: "completed",
        progress: 100, duration_seconds: 60, created_at: "2026-06-29T00:00:00Z",
        channel_title: "某频道", error_message: null },
    ],
    total: 1, page: 1, page_size: 20,
  })
})
afterEach(() => vi.restoreAllMocks())

describe("AdminUserTasks", () => {
  it("拉取并渲染目标用户任务,行链到 admin 详情", async () => {
    render(<AdminUserTasks />)
    await waitFor(() => expect(screen.getByText("标题一")).toBeInTheDocument())
    expect(mockClient.getAdminUserTasks).toHaveBeenCalledWith("user-b", expect.objectContaining({ page: 1 }))
    const link = screen.getByRole("link", { name: /标题一/ })
    expect(link).toHaveAttribute("href", "/admin/tasks/t1")
  })

  it("空列表显示空态", async () => {
    mockClient.getAdminUserTasks.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 })
    render(<AdminUserTasks />)
    await waitFor(() => expect(screen.getByText("admin.userTasks.empty")).toBeInTheDocument())
  })

  it("提交搜索时带 trim 后的 q 并回到第 1 页", async () => {
    render(<AdminUserTasks />)
    await waitFor(() => expect(screen.getByText("标题一")).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText("admin.userTasks.searchPlaceholder"), {
      target: { value: "  预算  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "admin.userTasks.search" }))
    await waitFor(() =>
      expect(mockClient.getAdminUserTasks).toHaveBeenLastCalledWith(
        "user-b",
        expect.objectContaining({ page: 1, q: "预算" })
      )
    )
  })

  it("搜索无结果显示 searchEmpty 而非 empty", async () => {
    render(<AdminUserTasks />)
    await waitFor(() => expect(screen.getByText("标题一")).toBeInTheDocument())
    mockClient.getAdminUserTasks.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 })
    fireEvent.change(screen.getByPlaceholderText("admin.userTasks.searchPlaceholder"), {
      target: { value: "zzz" },
    })
    fireEvent.click(screen.getByRole("button", { name: "admin.userTasks.search" }))
    await waitFor(() => expect(screen.getByText("admin.userTasks.searchEmpty")).toBeInTheDocument())
  })
})
