import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({ getTasks: vi.fn() }))
const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
vi.mock("@/lib/use-date-formatter", () => ({ useDateFormatter: () => ({ formatRelativeTime: () => "just now" }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
// Dashboard 用 useGlobalStore((s) => s.tasks) 选择器形式;返回空对象即「无 WebSocket 更新」
vi.mock("@/store/global-store", () => ({ useGlobalStore: () => ({}) }))
vi.mock("@/components/layout/Header", () => ({ default: () => null }))
vi.mock("@/components/layout/Sidebar", () => ({ default: () => null }))
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
    render(<Dashboard isAuthenticated onOpenLogin={() => {}} onOpenNewTask={() => {}} />)
    await waitFor(() => expect(screen.getByText("public-task-list")).toBeInTheDocument())
    expect(screen.getByText("dashboard.exploreHint")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "dashboard.createTask" })).toBeInTheDocument()
  })

  it("已登录有任务:不嵌入探索列表", async () => {
    mockClient.getTasks.mockResolvedValue({
      items: [{ id: "x", title: "我的任务", source_type: "upload", status: "completed", duration_seconds: 10, created_at: "2026-06-10T00:00:00Z" }],
      total: 1,
      page: 1,
      page_size: 5,
    })
    render(<Dashboard isAuthenticated onOpenLogin={() => {}} onOpenNewTask={() => {}} />)
    await waitFor(() => expect(screen.getByText("task-card")).toBeInTheDocument())
    expect(screen.queryByText("public-task-list")).not.toBeInTheDocument()
  })
})
