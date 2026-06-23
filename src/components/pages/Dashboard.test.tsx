import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({ getTasks: vi.fn() }))
const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
vi.mock("@/lib/use-date-formatter", () => ({ useDateFormatter: () => ({ formatRelativeTime: () => "just now" }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
// Dashboard 用 useGlobalStore((s) => s.tasks) 选择器形式;返回空对象即「无 WebSocket 更新」
vi.mock("@/store/global-store", () => ({ useGlobalStore: () => ({}) }))
vi.mock("@/store/ui-store", () => ({
  useUIStore: (sel: (s: { openLogin: () => void; openNewTask: () => void }) => unknown) =>
    sel({ openLogin: vi.fn(), openNewTask: vi.fn() }),
}))
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: { name: string } | null }) => unknown) =>
    sel({ user: { name: "Sean" } }),
}))
vi.mock("@/components/task/NewTaskCard", () => ({ default: () => null }))
vi.mock("@/components/task/TaskCard", () => ({ default: () => <div>task-card</div> }))
vi.mock("@/components/pages/PublicTaskList", () => ({ default: () => <div>public-task-list</div> }))

import Dashboard from "./Dashboard"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Dashboard 零任务软引导", () => {
  it("已登录 0 任务:嵌入探索列表 + 保留新建 CTA", async () => {
    mockClient.getTasks.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 })
    const { container } = render(<Dashboard />)
    await waitFor(() => expect(screen.getByText("public-task-list")).toBeInTheDocument())
    expect(screen.getByText("dashboard.exploreHint")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "dashboard.createTask" })).toBeInTheDocument()
    expect(container.querySelector(".h-screen")).toBeNull()
  })

  it("已登录有任务:不嵌入探索列表", async () => {
    mockClient.getTasks.mockResolvedValue({
      items: [{ id: "x", title: "我的任务", source_type: "upload", status: "completed", duration_seconds: 10, created_at: "2026-06-10T00:00:00Z" }],
      total: 1,
      page: 1,
      page_size: 5,
    })
    render(<Dashboard />)
    await waitFor(() => expect(screen.getByText("task-card")).toBeInTheDocument())
    expect(screen.queryByText("public-task-list")).not.toBeInTheDocument()
  })
})

describe("Dashboard 标题层级", () => {
  it("页标题是页级 h1 且不含 👋", async () => {
    mockClient.getTasks.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });
    render(<Dashboard />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("dashboard.welcome");
    expect(h1.textContent).not.toContain("👋");
  });

  it("最近任务是 h2,不与页级 h1 跳级(避免 h1→h3)", async () => {
    mockClient.getTasks.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 });
    render(<Dashboard />);
    // 页标题升 h1 后,区块标题须为 h2(下一级),否则 h1→h3 跳级违反标题层级
    const recent = screen.getByRole("heading", { level: 2 });
    expect(recent.textContent).toContain("dashboard.recentTasks");
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});

describe("Dashboard 三态", () => {
  beforeEach(() => { vi.clearAllMocks(); })

  it("加载中渲染骨架屏而非裸文本", async () => {
    mockClient.getTasks.mockReturnValue(new Promise(() => {})); // pending
    render(<Dashboard />);
    expect(await screen.findAllByTestId("task-card-skeleton")).toHaveLength(4);
  });

  it("加载失败渲染 ErrorState,点重试重新拉取", async () => {
    mockClient.getTasks.mockRejectedValue(new Error("boom"));
    render(<Dashboard />);
    const retry = await screen.findByText("common.retry");
    expect(mockClient.getTasks).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() => expect(mockClient.getTasks).toHaveBeenCalledTimes(2));
  });
});
