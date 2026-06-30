import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({ getPublicTasks: vi.fn() }))
// t 桩:带 vars 时把插值拼到 key 后(便于断言 publishedBy 里的名字);无 vars 返回原 key。
const i18n = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, string | number>) =>
    vars ? `${key} ${Object.values(vars).join(" ")}` : key,
}))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }))
vi.mock("@/lib/use-date-formatter", () => ({ useDateFormatter: () => ({ formatDate: () => "2026-06-10" }) }))
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
// PublicTaskList 挂载时 fire-and-forget 预取详情页重 chunk(prod 暖 chunk 优化)。测试里这些
// 动态 import 会拖入 media-ticket→api-client→auth-token→auth-store 链,用例毫秒级结束后 worker
// 关闭时该 fetch 仍 pending →「Closing rpc while fetch was pending」未处理拒绝(偶发 exit 1)。
// 预取对测试无意义,stub 成空模块,import() 即刻命中 mock,不再发起 worker RPC fetch。
vi.mock("@/components/task/MarkdownContent", () => ({ default: () => null }))
vi.mock("@/components/pages/PublicTaskDetail", () => ({ default: () => null }))

const authState = vi.hoisted(() => ({ status: "unauthenticated" as string }))
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (s: { status: string }) => unknown) => selector({ status: authState.status }),
}))

import PublicTaskList from "./PublicTaskList"
import type { PublicTaskListItem } from "@/types/api"
import { ApiError } from "@/types/api"

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
  authState.status = "unauthenticated"
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

  it("点击下一页拉取第 2 页,首页 prev 禁用", async () => {
    mockClient.getPublicTasks.mockResolvedValue({
      items: [makeItem({ id: "t2", title: "第二页任务" })],
      total: 40,
      page: 2,
      page_size: 20,
    })
    render(<PublicTaskList initialItems={[makeItem({ title: "第一页任务" })]} initialTotal={40} />)
    // seeded:首屏即第 1 页,挂载不拉取
    expect(await screen.findByText("第一页任务")).toBeInTheDocument()
    expect(mockClient.getPublicTasks).not.toHaveBeenCalled()
    // 第 1 页 prev 禁用
    expect(screen.getByRole("button", { name: "explore.prevPage" })).toBeDisabled()
    // 点下一页 → 拉第 2 页
    fireEvent.click(screen.getByRole("button", { name: "explore.nextPage" }))
    await waitFor(() => expect(screen.getByText("第二页任务")).toBeInTheDocument())
    expect(mockClient.getPublicTasks).toHaveBeenCalledWith({ page: 2, page_size: 20 })
  })

  it("拉取失败渲染错误态,重试成功后渲染列表", async () => {
    mockClient.getPublicTasks.mockRejectedValueOnce(new Error("boom"))
    render(<PublicTaskList />)
    // 错误态 + 重试按钮
    expect(await screen.findByText("explore.loadFailed")).toBeInTheDocument()
    const retry = screen.getByRole("button", { name: "common.retry" })
    // 重试成功
    mockClient.getPublicTasks.mockResolvedValueOnce({
      items: [makeItem({ title: "重试成功任务" })],
      total: 1,
      page: 1,
      page_size: 20,
    })
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByText("重试成功任务")).toBeInTheDocument())
    expect(screen.queryByText("explore.loadFailed")).not.toBeInTheDocument()
  })

  it("发布者署名:头像 + 名称 + 发布时间合成一条(融入信息行)", async () => {
    render(
      <PublicTaskList
        initialItems={[
          makeItem({
            owner: { name: "发布者甲", avatar_url: "https://lh3.googleusercontent.com/a/x" },
            published_at: "2026-06-10T00:00:00Z",
          }),
        ]}
        initialTotal={1}
      />,
    )
    // 名称经 publishedBy 署名(t 桩把 {name} 拼到 key 后)
    expect(await screen.findByText(/发布者甲/)).toBeInTheDocument()
    // 头像走同源代理
    expect(screen.getByAltText("发布者甲").getAttribute("src")).toContain("/api/v1/users/avatar")
    // 时间与署名同条出现(不再单独占 chips)
    expect(screen.getByText(/2026-06-10/)).toBeInTheDocument()
  })

  it("无发布者(owner=null)只回退普通「发布于 时间」,不渲染名称", async () => {
    render(<PublicTaskList initialItems={[makeItem({ owner: null, published_at: "2026-06-10T00:00:00Z" })]} initialTotal={1} />)
    await screen.findByText("公开任务一")
    expect(screen.queryByText(/发布者甲/)).not.toBeInTheDocument()
    // 仍展示发布时间(走 explore.publishedAt 前缀 + 日期)
    expect(screen.getByText(/2026-06-10/)).toBeInTheDocument()
    expect(screen.getByText(/explore\.publishedAt/)).toBeInTheDocument()
  })

  it("is_owner 卡片直链私有详情 /tasks/[id]", async () => {
    render(<PublicTaskList initialItems={[makeItem({ id: "t9", is_owner: true })]} initialTotal={1} />)
    const link = (await screen.findByText("公开任务一")).closest("a")
    expect(link).toHaveAttribute("href", "/tasks/t9")
  })

  it("非 is_owner 卡片走公开详情 /explore/[id]", async () => {
    render(<PublicTaskList initialItems={[makeItem({ id: "t9", is_owner: false })]} initialTotal={1} />)
    const link = (await screen.findByText("公开任务一")).closest("a")
    expect(link).toHaveAttribute("href", "/explore/t9")
  })

  it("登录用户挂载后带 token 二次刷新,合并 is_owner 使本人卡片改直链私有详情", async () => {
    authState.status = "authenticated"
    mockClient.getPublicTasks.mockImplementation(
      (_params: unknown, opts?: { authenticated?: boolean }) =>
        Promise.resolve({
          items: [makeItem({ id: "t9", is_owner: !!opts?.authenticated })],
          total: 1,
          page: 1,
          page_size: 20,
        }),
    )
    render(<PublicTaskList initialItems={[makeItem({ id: "t9", is_owner: false })]} initialTotal={1} />)
    // 初始 seeded is_owner=false → /explore/t9;二次带 token 刷新合并后 → /tasks/t9
    await waitFor(() => {
      const link = screen.getByText("公开任务一").closest("a")
      expect(link).toHaveAttribute("href", "/tasks/t9")
    })
    expect(mockClient.getPublicTasks).toHaveBeenCalledWith({ page: 1, page_size: 20 }, { authenticated: true })
  })

  it("匿名用户不发起带 token 的二次刷新", async () => {
    render(<PublicTaskList initialItems={[makeItem()]} initialTotal={1} />)
    await screen.findByText("公开任务一")
    expect(mockClient.getPublicTasks).not.toHaveBeenCalled()
  })

  it("翻页失败后「重试」拉的是失败的目标页(第2页),而非回到第1页", async () => {
    // seeded 第 1 页(total=40 → 2 页),挂载不拉取
    render(<PublicTaskList initialItems={[makeItem({ title: "第一页任务" })]} initialTotal={40} />)
    expect(await screen.findByText("第一页任务")).toBeInTheDocument()
    // 点下一页 → load(2) 失败 → 错误态
    mockClient.getPublicTasks.mockRejectedValueOnce(new Error("boom"))
    fireEvent.click(screen.getByRole("button", { name: "explore.nextPage" }))
    expect(await screen.findByText("explore.loadFailed")).toBeInTheDocument()
    // 重试 → 必须重试第 2 页(失败的目标页),成功后渲染第 2 页
    mockClient.getPublicTasks.mockResolvedValueOnce({
      items: [makeItem({ id: "t2", title: "第二页任务" })],
      total: 40,
      page: 2,
      page_size: 20,
    })
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }))
    await waitFor(() => expect(screen.getByText("第二页任务")).toBeInTheDocument())
    // 关键断言:重试调用的是 page:2,不是 page:1(旧 bug 会回到第 1 页)
    expect(mockClient.getPublicTasks).toHaveBeenLastCalledWith({ page: 2, page_size: 20 })
  })
})

describe("PublicTaskList 三态", () => {
  it("加载中渲染公开卡骨架而非 spinner", async () => {
    mockClient.getPublicTasks.mockReturnValue(new Promise(() => {})); // pending
    render(<PublicTaskList />);
    expect(await screen.findAllByTestId("public-task-card-skeleton")).toHaveLength(5);
  });

  it("加载失败渲染 ErrorState,点重试重新拉取", async () => {
    mockClient.getPublicTasks.mockRejectedValue(new Error("boom"));
    render(<PublicTaskList />);
    const retry = await screen.findByText("common.retry");
    expect(mockClient.getPublicTasks).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() => expect(mockClient.getPublicTasks).toHaveBeenCalledTimes(2));
  });
})

describe("PublicTaskList 限流提示", () => {
  it("限流(40920):显示后端友好文案而非通用 loadFailed", async () => {
    mockClient.getPublicTasks.mockRejectedValue(
      new ApiError(40920, "操作过于频繁，请60秒后再试", "", undefined, undefined, 60),
    )
    render(<PublicTaskList />)
    await waitFor(() => {
      expect(screen.getByText("操作过于频繁，请60秒后再试")).toBeInTheDocument()
    })
    expect(screen.queryByText("explore.loadFailed")).not.toBeInTheDocument()
  })

  it("普通错误:仍显示通用 loadFailed 文案", async () => {
    mockClient.getPublicTasks.mockRejectedValue(new Error("network"))
    render(<PublicTaskList />)
    await waitFor(() => {
      expect(screen.getByText("explore.loadFailed")).toBeInTheDocument()
    })
  })
})
