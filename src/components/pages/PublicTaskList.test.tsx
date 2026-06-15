import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({ getPublicTasks: vi.fn() }))
const i18n = vi.hoisted(() => ({ t: (key: string) => key }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
vi.mock("@/lib/use-date-formatter", () => ({ useDateFormatter: () => ({ formatDate: () => "2026-06-10" }) }))
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import PublicTaskList from "./PublicTaskList"
import type { PublicTaskListItem } from "@/types/api"

function makeItem(overrides: Partial<PublicTaskListItem> = {}): PublicTaskListItem {
  return {
    id: "t1",
    title: "公开任务一",
    source_type: "youtube",
    duration_seconds: 90,
    detected_language: "zh",
    detected_summary_style: "lecture",
    published_at: new Date(Date.now() - 1000).toISOString(),
    cover_url: null,
    excerpt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PublicTaskList", () => {
  it("SSR 预取(seeded)时跳过客户端首拉,直接渲染初始卡片", async () => {
    render(<PublicTaskList initialItems={[makeItem()]} initialTotal={1} />)
    expect(await screen.findByText("公开任务一")).toBeInTheDocument()
    expect(mockClient.getPublicTasks).not.toHaveBeenCalled()
  })

  it("未预取时客户端拉取第 1 页", async () => {
    mockClient.getPublicTasks.mockResolvedValue({
      items: [makeItem({ title: "拉取任务" })],
      total: 1,
      page: 1,
      page_size: 20,
    })
    render(<PublicTaskList />)
    await waitFor(() => expect(screen.getByText("拉取任务")).toBeInTheDocument())
    expect(mockClient.getPublicTasks).toHaveBeenCalledTimes(1)
  })

  it("有封面渲染 <img>", async () => {
    render(<PublicTaskList initialItems={[makeItem({ cover_url: "/api/v1/summaries/images/u/t/a.webp" })]} initialTotal={1} />)
    const img = await screen.findByRole("img")
    expect(img).toHaveAttribute("src", "/api/v1/summaries/images/u/t/a.webp")
  })

  it("无封面不渲染 <img>(占位)", async () => {
    render(<PublicTaskList initialItems={[makeItem({ cover_url: null })]} initialTotal={1} />)
    await screen.findByText("公开任务一")
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("excerpt 存在时渲染摘录行", async () => {
    render(<PublicTaskList initialItems={[makeItem({ excerpt: "一句摘要摘录" })]} initialTotal={1} />)
    expect(await screen.findByText("一句摘要摘录")).toBeInTheDocument()
  })

  it("近 7 天公开显示 NEW 角标", async () => {
    render(<PublicTaskList initialItems={[makeItem()]} initialTotal={1} />)
    expect(await screen.findByText("explore.newBadge")).toBeInTheDocument()
  })

  it("陈旧公开不显示 NEW 角标", async () => {
    render(<PublicTaskList initialItems={[makeItem({ published_at: "2020-01-01T00:00:00Z" })]} initialTotal={1} />)
    await screen.findByText("公开任务一")
    expect(screen.queryByText("explore.newBadge")).not.toBeInTheDocument()
  })
})
